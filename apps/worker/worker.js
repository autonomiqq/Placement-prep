/**
 * PlacementPrep — Question Bank Worker
 *
 * Dedicated queue service: BRPOP jobs from Redis list `qbank:queue`,
 * generate MCQ questions via Ollama, insert into Supabase question_bank,
 * and write progress to Redis `gen:job:{jobId}` (polled by Next.js API).
 *
 * Queue protocol:
 *   Enqueue: LPUSH qbank:queue <JSON job>
 *   Job fields: { jobId, topic, category, difficulty, count }
 *   Progress key: gen:job:{jobId}  (JSON, EX 7200s)
 */

"use strict";

const Redis = require("ioredis").default ?? require("ioredis");
const { createClient } = require("@supabase/supabase-js");

// ── Config ────────────────────────────────────────────────────────
const REDIS_URL        = process.env.REDIS_URL        || "redis://localhost:6379";
const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OLLAMA_BANK_URL  = process.env.OLLAMA_FAST_URL  || "http://localhost:11434";
const OLLAMA_MCQ_URL   = process.env.OLLAMA_FAST_URL  || "http://localhost:11434";
const BANK_MODEL       = process.env.OLLAMA_BANK_MODEL || "qwen2:0.5b";
const MCQ_MODEL        = process.env.OLLAMA_MCQ_MODEL  || "phi3:mini";

const QUEUE_KEY   = "qbank:queue";
const JOB_TTL     = 7200;   // 2 hours
const BATCH_SIZE  = 3;
const CONCURRENCY = 2;
const TIMEOUT_MS  = 120_000;

// ── Redis client ──────────────────────────────────────────────────
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  lazyConnect: true,
});

// Separate blocking client (BRPOP requires its own connection)
const blockingRedis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // retry forever for blocking connection
  enableReadyCheck: false,
  lazyConnect: true,
});

// ── Supabase client ───────────────────────────────────────────────
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("[worker] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ───────────────────────────────────────────────────────
async function setJobState(jobId, state) {
  try {
    await redis.set(`gen:job:${jobId}`, JSON.stringify(state), "EX", JOB_TTL);
  } catch (e) {
    console.warn("[worker] setJobState error:", e.message);
  }
}

async function isPaused(jobId) {
  try {
    return !!(await redis.get(`gen:pause:${jobId}`));
  } catch {
    return false;
  }
}

async function clearPauseSignal(jobId) {
  try { await redis.del(`gen:pause:${jobId}`); } catch {}
}

function extractJSON(text) {
  const m = text.match(/\{[\s\S]*\}/);
  return m ? m[0] : text;
}

function buildPrompt(category, topic, difficulty, count) {
  return `Generate ${count} ${difficulty} ${category} MCQ questions about "${topic}". Return ONLY JSON:\n{"questions":[{"content":"...","options":{"A":"...","B":"...","C":"...","D":"..."},"correct":"A","explanation":"brief","tags":["tag"]}]}`;
}

async function ollamaGenerate(prompt, model, baseUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.6, num_predict: 700 } }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const data = await res.json();
    return (data.response ?? "").trim();
  } finally {
    clearTimeout(timer);
  }
}

async function generateBatch(prompt) {
  let raw;
  try {
    raw = await ollamaGenerate(prompt, BANK_MODEL, OLLAMA_BANK_URL);
  } catch {
    raw = await ollamaGenerate(prompt, MCQ_MODEL, OLLAMA_MCQ_URL);
  }

  let parsed;
  try {
    parsed = JSON.parse(extractJSON(raw));
  } catch {
    const retry = await ollamaGenerate(
      prompt + "\n\nReturn ONLY the JSON object, nothing else.",
      BANK_MODEL, OLLAMA_BANK_URL
    ).catch(() => "");
    try { parsed = JSON.parse(extractJSON(retry)); } catch { return []; }
  }

  return Array.isArray(parsed?.questions) ? parsed.questions : [];
}

// ── Core job runner ───────────────────────────────────────────────
async function runJob(jobId, { topic, category, difficulty, count, alreadyCreated = 0 }) {
  // Preserve existing log when resuming
  let existingLog = [];
  try {
    const raw = await redis.get(`gen:job:${jobId}`);
    if (raw) existingLog = JSON.parse(raw).log ?? [];
  } catch {}

  const log = existingLog.length > 0
    ? [...existingLog]
    : [`Starting bulk generation of ${count} questions...`];

  let totalCreated = alreadyCreated;
  const totalBatches = Math.ceil(count / BATCH_SIZE);

  try {
    for (let i = 0; i < totalBatches; i += CONCURRENCY) {
      const group = Array.from(
        { length: Math.min(CONCURRENCY, totalBatches - i) },
        (_, j) => {
          const batchCount = Math.min(BATCH_SIZE, count - (i + j) * BATCH_SIZE);
          return generateBatch(buildPrompt(category, topic, difficulty, batchCount));
        }
      );

      const results = await Promise.allSettled(group);

      for (const result of results) {
        const questions = result.status === "fulfilled" ? result.value : [];
        for (const q of questions) {
          const { data: newQ, error: qErr } = await supabase
            .from("question_bank")
            .insert({
              type: "mcq",
              category,
              difficulty,
              topic,
              content: String(q.content ?? ""),
              explanation: String(q.explanation ?? ""),
              tags: Array.isArray(q.tags) ? q.tags : [],
            })
            .select("id")
            .single();

          if (qErr || !newQ) continue;
          totalCreated++;

          if (q.options && typeof q.options === "object") {
            const correct = String(q.correct ?? "A");
            await supabase.from("question_bank_options").insert(
              Object.entries(q.options).map(([key, content]) => ({
                question_id: newQ.id,
                option_key: key,
                content: String(content),
                is_correct: key === correct,
              }))
            );
          }
        }
      }

      const doneBatches = Math.min(i + CONCURRENCY, totalBatches);
      const doneCount = Math.min(doneBatches * BATCH_SIZE, count);
      log.push(`Batch complete — ${totalCreated} of ${count} saved to bank`);
      await setJobState(jobId, {
        status: "running", topic, category, difficulty,
        total: count, done: doneCount, created: totalCreated, log: [...log],
      });

      // Check for pause signal after every batch group
      if (await isPaused(jobId)) {
        await clearPauseSignal(jobId);
        log.push(`Paused after ${totalCreated} questions. Click Resume to continue.`);
        await setJobState(jobId, {
          status: "paused", topic, category, difficulty,
          total: count, done: doneCount, created: totalCreated, log: [...log],
        });
        console.log(`[worker] job ${jobId} paused — ${totalCreated}/${count} created`);
        return;
      }
    }

    log.push(`Done! ${totalCreated} questions added to bank.`);
    await setJobState(jobId, {
      status: "done", topic, category, difficulty,
      total: count, done: count, created: totalCreated, log: [...log],
    });
    console.log(`[worker] job ${jobId} done — ${totalCreated}/${count} created`);
  } catch (err) {
    console.error(`[worker] job ${jobId} error:`, err);
    log.push(`Error: ${String(err)}`);
    await setJobState(jobId, {
      status: "error", topic, category, difficulty,
      total: count, done: 0, created: totalCreated,
      error: String(err), log: [...log],
    });
  }
}

// ── Main loop ─────────────────────────────────────────────────────
async function main() {
  await redis.connect();
  await blockingRedis.connect();
  console.log(`[worker] Connected to Redis at ${REDIS_URL}`);
  console.log(`[worker] Waiting for jobs on queue: ${QUEUE_KEY}`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      // BRPOP with 10s timeout; returns [key, value] or null on timeout
      const result = await blockingRedis.brpop(QUEUE_KEY, 10);
      if (!result) continue;

      const [, raw] = result;
      let job;
      try {
        job = JSON.parse(raw);
      } catch {
        console.warn("[worker] Invalid job payload, skipping:", raw);
        continue;
      }

      const { jobId, topic, category, difficulty, count, alreadyCreated = 0 } = job;
      if (!jobId || !topic || !category || !difficulty || !count) {
        console.warn("[worker] Incomplete job, skipping:", job);
        continue;
      }

      console.log(`[worker] Processing job ${jobId}: ${count}x ${category}/${difficulty}/${topic} (offset: ${alreadyCreated})`);
      await runJob(jobId, { topic, category, difficulty, count, alreadyCreated });
    } catch (err) {
      // Redis connection errors — wait and retry
      console.error("[worker] Loop error:", err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

main().catch((err) => {
  console.error("[worker] Fatal:", err);
  process.exit(1);
});

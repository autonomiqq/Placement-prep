// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { requireAdminAPI } from "@/lib/supabase/admin-guard";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getRedis } from "@/lib/redis";
import { generate } from "@/lib/ollama/client";
import { OLLAMA_ROUTES } from "@/lib/ollama/router";

const bodySchema = z.object({
  topic: z.string().min(2).max(100),
  category: z.enum(["aptitude", "verbal", "technical", "coding"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  count: z.number().int().min(10).max(1000),
});

function extractJSON(text: string): string {
  const m = text.match(/\{[\s\S]*\}/);
  return m ? m[0] : text;
}

const BATCH_SIZE = 3;
const CONCURRENCY = 2;
const MAX_TOKENS = 700;
const JOB_TTL = 7200; // 2 hours

function buildPrompt(category: string, topic: string, difficulty: string, count: number): string {
  return `Generate ${count} ${difficulty} ${category} MCQ questions about "${topic}". Return ONLY JSON:
{"questions":[{"content":"...","options":{"A":"...","B":"...","C":"...","D":"..."},"correct":"A","explanation":"brief","tags":["tag"]}]}`;
}

async function generateBatch(
  prompt: string,
  opts: Record<string, unknown>
): Promise<Record<string, unknown>[]> {
  const bankRoute = OLLAMA_ROUTES.bank;
  let raw: string;
  try {
    raw = await generate(prompt, { ...opts, model: bankRoute.model, baseUrl: bankRoute.baseUrl });
  } catch {
    raw = await generate(prompt, {
      ...opts,
      model: OLLAMA_ROUTES.mcq.model,
      baseUrl: OLLAMA_ROUTES.mcq.baseUrl,
    });
  }

  let parsed: { questions?: unknown[] };
  try {
    parsed = JSON.parse(extractJSON(raw));
  } catch {
    const retryRaw = await generate(
      prompt + "\n\nReturn ONLY the JSON object, nothing else.",
      { ...opts, temperature: 0.2, model: bankRoute.model, baseUrl: bankRoute.baseUrl }
    ).catch(() => "");
    try {
      parsed = JSON.parse(extractJSON(retryRaw));
    } catch {
      return [];
    }
  }

  return Array.isArray(parsed.questions)
    ? (parsed.questions as Record<string, unknown>[])
    : [];
}

async function setJobState(jobId: string, state: object) {
  try {
    await getRedis().set(`gen:job:${jobId}`, JSON.stringify(state), "EX", JOB_TTL);
  } catch { /* non-fatal */ }
}

async function getJobState(jobId: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await getRedis().get(`gen:job:${jobId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Runs entirely in Node.js background — client disconnecting does NOT stop this.
 * Progress is written to Redis after every batch group.
 */
async function runJob(
  jobId: string,
  params: { topic: string; category: string; difficulty: string; count: number }
) {
  const { topic, category, difficulty, count } = params;
  const supabase = await getSupabaseServiceClient();
  const log: string[] = [`Starting bulk generation of ${count} questions...`];
  let totalCreated = 0;
  const totalBatches = Math.ceil(count / BATCH_SIZE);
  const opts = { temperature: 0.6, maxTokens: MAX_TOKENS, timeout: 120_000 };

  try {
    for (let i = 0; i < totalBatches; i += CONCURRENCY) {
      const group = Array.from(
        { length: Math.min(CONCURRENCY, totalBatches - i) },
        (_, j) => {
          const batchCount = Math.min(BATCH_SIZE, count - (i + j) * BATCH_SIZE);
          return generateBatch(buildPrompt(category, topic, difficulty, batchCount), opts);
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
            const options = q.options as Record<string, string>;
            const correct = String(q.correct ?? "A");
            await supabase.from("question_bank_options").insert(
              Object.entries(options).map(([key, content]) => ({
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
        status: "running",
        topic, category, difficulty,
        total: count, done: doneCount, created: totalCreated,
        log: [...log],
      });
    }

    log.push(`Done! ${totalCreated} questions added to bank.`);
    await setJobState(jobId, {
      status: "done",
      topic, category, difficulty,
      total: count, done: count, created: totalCreated,
      log: [...log],
    });
  } catch (err) {
    log.push(`Error: ${String(err)}`);
    await setJobState(jobId, {
      status: "error",
      topic, category, difficulty,
      total: count, done: 0, created: totalCreated,
      error: String(err),
      log: [...log],
    });
  }
}

/** POST — enqueues job to dedicated worker, returns jobId immediately */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireAdminAPI(req);
  if (authErr) return authErr;

  const parseResult = bodySchema.safeParse(await req.json());
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.flatten() }, { status: 400 });
  }

  const { topic, category, difficulty, count } = parseResult.data;
  const jobId = randomUUID();

  // Write initial state to Redis so the GET poll endpoint returns immediately
  await setJobState(jobId, {
    status: "running",
    topic, category, difficulty,
    total: count, done: 0, created: 0,
    log: [`Job queued — worker will start shortly...`],
  });

  // Enqueue to dedicated worker queue (durable — survives web restarts)
  try {
    await getRedis().lpush("qbank:queue", JSON.stringify({ jobId, topic, category, difficulty, count }));
  } catch {
    // Worker queue unavailable — fall back to in-process generation
    runJob(jobId, { topic, category, difficulty, count }).catch(() => {});
  }

  return NextResponse.json({ jobId });
}

/**
 * PATCH — pause / resume / retry a running job
 * body: { jobId: string, action: "pause" | "resume" | "retry" }
 *
 * pause  — sets gen:pause:{jobId} signal; worker breaks after current batch
 * resume — clears pause signal, re-enqueues remaining work
 * retry  — resets progress to 0, re-enqueues full count from scratch
 */
export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireAdminAPI(req);
  if (authErr) return authErr;

  const { jobId, action } = await req.json() as { jobId?: string; action?: string };
  if (!jobId || !["pause", "resume", "retry"].includes(action ?? "")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const redis = getRedis();

  if (action === "pause") {
    await redis.set(`gen:pause:${jobId}`, "1", "EX", JOB_TTL);
    return NextResponse.json({ ok: true });
  }

  const state = await getJobState(jobId);
  if (!state) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (action === "resume") {
    const { topic, category, difficulty, total, created } = state as Record<string, unknown>;
    const remaining = (total as number) - (created as number);
    if (remaining <= 0) return NextResponse.json({ error: "Nothing left to resume" }, { status: 400 });

    await redis.del(`gen:pause:${jobId}`);
    await setJobState(jobId, {
      ...state,
      status: "running",
      log: [...((state as Record<string, unknown>).log as string[] ?? []), `Resuming — ${remaining} questions remaining...`],
    });

    try {
      await redis.lpush("qbank:queue", JSON.stringify({
        jobId, topic, category, difficulty,
        count: remaining,
        alreadyCreated: created,
      }));
    } catch {
      runJob(jobId, {
        topic: topic as string,
        category: category as string,
        difficulty: difficulty as string,
        count: remaining as number,
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "retry") {
    const { topic, category, difficulty, total } = state as Record<string, unknown>;

    await redis.del(`gen:pause:${jobId}`);
    await setJobState(jobId, {
      status: "running",
      topic, category, difficulty,
      total, done: 0, created: 0,
      log: [`Retrying — generating ${total} questions from scratch...`],
    });

    try {
      await redis.lpush("qbank:queue", JSON.stringify({
        jobId, topic, category, difficulty,
        count: total,
        alreadyCreated: 0,
      }));
    } catch {
      runJob(jobId, {
        topic: topic as string,
        category: category as string,
        difficulty: difficulty as string,
        count: total as number,
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }
}

/** GET ?jobId=xxx — poll job status */
export async function GET(req: NextRequest) {
  const { error } = await requireAdminAPI(req);
  if (error) return error;

  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

  const state = await getJobState(jobId);
  if (!state) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json(state);
}

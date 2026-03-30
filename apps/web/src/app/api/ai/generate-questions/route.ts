// @ts-nocheck
export const maxDuration = 300; // 5 minutes — needed for long AI generation
import { NextRequest } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/supabase/server";
import { generate } from "@/lib/ollama/client";
import { OLLAMA_ROUTES } from "@/lib/ollama/router";
import { PROMPTS } from "@/lib/ollama/prompts";
import { getRedis } from "@/lib/redis";

const bodySchema = z.object({
  testId: z.string().uuid(),
  topic: z.string().min(2).max(100),
  category: z.enum(["aptitude", "verbal", "technical", "coding"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  count: z.number().int().min(1).max(50),
  type: z.enum(["mcq", "coding"]).default("mcq"),
});

function extractJSON(text: string): string {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : text;
}

function batchCacheKey(category: string, difficulty: string, topic: string, count: number): string {
  const hash = crypto.createHash("md5")
    .update(`${category}:${difficulty}:${topic.toLowerCase().trim()}:${count}`)
    .digest("hex");
  return `mcq:batch:${hash}`;
}

async function generateWithFallback(prompt: string, opts: Record<string, unknown>): Promise<string> {
  // Try the optimized placement-mcq model first; fall back to base model
  const mcqRoute = OLLAMA_ROUTES.mcq;
  try {
    return await generate(prompt, { ...opts, model: mcqRoute.model, baseUrl: mcqRoute.baseUrl });
  } catch {
    const fallback = OLLAMA_ROUTES.fast;
    return await generate(prompt, { ...opts, model: fallback.model, baseUrl: fallback.baseUrl });
  }
}

const BATCH_SIZE = 5;
const CACHE_TTL = 60 * 60 * 24 * 7; // 7 days

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parseResult = bodySchema.safeParse(await req.json());
  if (!parseResult.success) {
    return new Response(
      JSON.stringify({ error: parseResult.error.flatten() }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { testId, topic, category, difficulty, count, type } = parseResult.data;

  // Verify test belongs to user or user is admin
  const { data: test } = await supabase
    .from("tests")
    .select("id")
    .eq("id", testId)
    .eq("created_by", user.id)
    .single();

  if (!test) {
    return new Response(
      JSON.stringify({ error: "Test not found or access denied" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const serviceClient = await getSupabaseServiceClient();

  // Get current max question number
  const { data: existingQuestions } = await serviceClient
    .from("questions")
    .select("question_number")
    .eq("test_id", testId)
    .order("question_number", { ascending: false })
    .limit(1);

  let nextNumber = (existingQuestions?.[0]?.question_number ?? 0) + 1;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let totalCreated = 0;
      const totalBatches = Math.ceil(count / BATCH_SIZE);
      const redis = getRedis();

      try {
        for (let b = 0; b < totalBatches; b++) {
          const batchCount = Math.min(BATCH_SIZE, count - b * BATCH_SIZE);

          // Check Redis cache first — skip AI call if same topic was generated before
          const cacheKey = batchCacheKey(category, difficulty, topic, batchCount);
          let parsed: { questions?: unknown[] };
          let fromCache = false;

          try {
            const cached = await redis.get(cacheKey);
            if (cached) {
              parsed = { questions: JSON.parse(cached) };
              fromCache = true;
            }
          } catch { /* Redis unavailable — proceed without cache */ }

          if (!fromCache) {
            const prompt = PROMPTS.generateMcq(category, topic, difficulty, batchCount);
            let raw: string;
            try {
              raw = await generateWithFallback(prompt, { temperature: 0.65, maxTokens: 2048, timeout: 300_000 });
            } catch (err) {
              send({ type: "error", message: `AI generation failed: ${String(err)}` });
              controller.close();
              return;
            }

            try {
              parsed = JSON.parse(extractJSON(raw));
            } catch {
              try {
                const retryRaw = await generateWithFallback(
                  prompt + "\n\nReturn ONLY valid JSON, nothing else.",
                  { temperature: 0.2, maxTokens: 2048, timeout: 300_000 }
                );
                parsed = JSON.parse(extractJSON(retryRaw));
              } catch {
                send({
                  type: "progress",
                  done: Math.min((b + 1) * BATCH_SIZE, count),
                  total: count,
                  created: totalCreated,
                });
                continue;
              }
            }

            // Cache the successful batch for future use
            if (parsed.questions?.length) {
              redis.set(cacheKey, JSON.stringify(parsed.questions), "EX", CACHE_TTL).catch(() => {});
            }
          }

          if (!parsed.questions || !Array.isArray(parsed.questions)) {
            send({
              type: "progress",
              done: Math.min((b + 1) * BATCH_SIZE, count),
              total: count,
              created: totalCreated,
            });
            continue;
          }

          // Insert questions
          for (const q of parsed.questions as Record<string, unknown>[]) {
            const { data: newQuestion, error: qError } = await serviceClient
              .from("questions")
              .insert({
                test_id: testId,
                question_number: nextNumber++,
                type,
                category,
                difficulty,
                content: String(q.content ?? ""),
                marks: 1,
                negative_marks: 0.25,
                explanation: String(q.explanation ?? ""),
                tags: Array.isArray(q.tags) ? q.tags : [],
              })
              .select("id")
              .single();

            if (qError || !newQuestion) continue;
            totalCreated++;

            if (type === "mcq" && q.options && typeof q.options === "object") {
              const options = q.options as Record<string, string>;
              const correct = String(q.correct ?? "A");
              const optionRows = Object.entries(options).map(([key, content]) => ({
                question_id: newQuestion.id,
                option_key: key as "A" | "B" | "C" | "D",
                content: String(content),
                is_correct: key === correct,
              }));
              await serviceClient.from("mcq_options").insert(optionRows);
            }
          }

          send({
            type: "progress",
            done: Math.min((b + 1) * BATCH_SIZE, count),
            total: count,
            created: totalCreated,
          });
        }

        // Mark test as AI generated
        await serviceClient
          .from("tests")
          .update({ is_ai_generated: true })
          .eq("id", testId);

        send({ type: "done", created: totalCreated });
        controller.close();
      } catch (err) {
        send({ type: "error", message: String(err) });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

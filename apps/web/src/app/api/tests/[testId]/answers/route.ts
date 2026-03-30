import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getRedis } from "@/lib/redis";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const bodySchema = z.object({
  attemptId: z.string().uuid(),
  questionId: z.string().uuid(),
  selectedOption: z.string().nullable(),
  timeSpentSecs: z.number().int().optional(),
});

// Buffer key for a student's in-progress answers
function bufKey(attemptId: string) {
  return `answers:buf:${attemptId}`;
}

/**
 * PUT /api/tests/[testId]/answers
 * Buffers the answer in Redis (TTL 3h). Actual DB write happens at flush or submit.
 * This reduces DB writes from N-per-answer to 1-batch-per-30s.
 */
export async function PUT(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 300 answer saves per minute per user is more than enough (30 questions × 10 changes)
  const rl = await rateLimit(`answers:${user.id}`, 300, 60);
  if (!rl.allowed) return rateLimitResponse(rl.resetInSecs);

  const parseResult = bodySchema.safeParse(await req.json());
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.flatten() }, { status: 400 });
  }

  const { attemptId, questionId, selectedOption, timeSpentSecs } = parseResult.data;

  try {
    const redis = getRedis();
    const key = bufKey(attemptId);

    // Store each answer as a JSON field in a Redis hash
    await redis.hset(key, questionId, JSON.stringify({
      selectedOption,
      isSkipped: selectedOption === null,
      timeSpentSecs: timeSpentSecs ?? null,
    }));
    // Keep buffer alive for up to 3 hours (longest possible exam + buffer)
    await redis.expire(key, 10_800);
  } catch {
    // Redis unavailable — fall back to direct DB write
    const { error } = await supabase.from("answers").upsert(
      {
        attempt_id: attemptId,
        question_id: questionId,
        selected_option: selectedOption,
        is_skipped: selectedOption === null,
        time_spent_secs: timeSpentSecs,
      },
      { onConflict: "attempt_id,question_id" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/supabase/server";
import { getRedis } from "@/lib/redis";
import { bufKey } from "@/lib/exam/flush-buffer";

const bodySchema = z.object({
  attemptId: z.string().uuid(),
  answers: z.record(z.string().nullable()), // questionId -> selectedOption
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const { testId } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parseResult = bodySchema.safeParse(await req.json());
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.flatten() }, { status: 400 });
  }

  const { attemptId, answers } = parseResult.data;

  // Verify attempt ownership
  const { data: attempt } = await supabase
    .from("test_attempts")
    .select("id, status, test_id")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .eq("test_id", testId)
    .single();

  if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  if (attempt.status !== "in_progress") {
    return NextResponse.json({ error: "Attempt already submitted" }, { status: 409 });
  }

  // Merge: Redis buffer + client state (client state wins for conflicts)
  const mergedAnswers: Record<string, { selectedOption: string | null; isSkipped: boolean; timeSpentSecs: number | null }> = {};

  // 1. Load Redis buffer
  try {
    const redis = getRedis();
    const raw = await redis.hgetall(bufKey(attemptId));
    if (raw) {
      for (const [questionId, json] of Object.entries(raw)) {
        mergedAnswers[questionId] = JSON.parse(json);
      }
    }
  } catch {
    // Redis unavailable — use client-submitted answers only
  }

  // 2. Client state overwrites buffer (most up-to-date)
  for (const [questionId, selectedOption] of Object.entries(answers)) {
    mergedAnswers[questionId] = {
      selectedOption,
      isSkipped: selectedOption === null,
      timeSpentSecs: mergedAnswers[questionId]?.timeSpentSecs ?? null,
    };
  }

  // 3. Batch upsert all answers
  const answerRows = Object.entries(mergedAnswers).map(([questionId, a]) => ({
    attempt_id: attemptId,
    question_id: questionId,
    selected_option: a.selectedOption,
    is_skipped: a.isSkipped,
    time_spent_secs: a.timeSpentSecs,
  }));

  if (answerRows.length > 0) {
    await supabase.from("answers").upsert(answerRows, {
      onConflict: "attempt_id,question_id",
    });
  }

  // 4. Score atomically via DB function (service client bypasses RLS)
  const serviceClient = await getSupabaseServiceClient();
  const { data: result, error: scoreError } = await serviceClient.rpc("score_attempt", {
    p_attempt_id: attemptId,
  });

  if (scoreError) {
    return NextResponse.json({ error: "Scoring failed", detail: scoreError.message }, { status: 500 });
  }

  // 4b. Refresh leaderboard ranks (non-blocking)
  serviceClient.rpc("refresh_ranks").then(() => {}).catch(() => {});

  // 5. Clean up Redis buffer — no longer needed
  try {
    await getRedis().del(bufKey(attemptId));
  } catch {
    // Non-fatal
  }

  // 6. Return scored answers for results page
  const { data: scoredAnswers } = await supabase
    .from("answers")
    .select("question_id, selected_option, is_correct, marks_awarded, is_skipped")
    .eq("attempt_id", attemptId);

  return NextResponse.json({ result, answers: scoredAnswers });
}

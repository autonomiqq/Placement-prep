import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/supabase/server";
import { getCachedTest, setCachedTest, getCachedQuestions, setCachedQuestions } from "@/lib/cache/tests";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const { testId } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only students can take tests
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role === "admin") {
    return NextResponse.json({ error: "Admins cannot take tests" }, { status: 403 });
  }

  // Rate limit: max 5 exam starts per user per 5 minutes (prevents spam)
  const rl = await rateLimit(`attempt:${user.id}`, 5, 300);
  if (!rl.allowed) return rateLimitResponse(rl.resetInSecs);

  // Check for existing active attempt — resume it instead of creating a new one
  const { data: activeAttempt } = await supabase
    .from("test_attempts")
    .select("id, started_at")
    .eq("user_id", user.id)
    .eq("test_id", testId)
    .eq("status", "in_progress")
    .single();

  const serviceClient = await getSupabaseServiceClient();

  // Fetch test — try cache first (avoids DB hit when 2000 students start together)
  let test = await getCachedTest(testId);
  if (!test) {
    const { data, error: testError } = await serviceClient
      .from("tests")
      .select("*")
      .eq("id", testId)
      .eq("is_published", true)
      .single();

    if (testError || !data) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }
    test = data;
    await setCachedTest(testId, test);
  }

  // Use existing attempt or create a new one
  let attempt: { id: string; started_at: string };
  if (activeAttempt) {
    attempt = activeAttempt as { id: string; started_at: string };
  } else {
    const { data: newAttempt, error: attemptError } = await supabase
      .from("test_attempts")
      .insert({ user_id: user.id, test_id: testId })
      .select("id, started_at")
      .single();

    if (attemptError || !newAttempt) {
      return NextResponse.json({ error: "Failed to create attempt" }, { status: 500 });
    }
    attempt = newAttempt as { id: string; started_at: string };
  }

  // Compute expiry from when the attempt actually started
  const expiresAt = new Date(
    new Date(attempt.started_at).getTime() + (test as { duration_mins: number }).duration_mins * 60 * 1000
  ).toISOString();

  // If the attempt has already expired, mark it as abandoned and reject
  if (activeAttempt && new Date(expiresAt) <= new Date()) {
    await supabase
      .from("test_attempts")
      .update({ status: "submitted", score: 0, total_marks: (test as { total_marks: number }).total_marks, submitted_at: new Date().toISOString() })
      .eq("id", attempt.id);
    return NextResponse.json({ error: "Attempt has expired" }, { status: 410 });
  }

  // Fetch questions — try cache first (this is the big win for concurrent starts)
  let questions = await getCachedQuestions(testId);
  if (!questions) {
    const { data } = await serviceClient
      .from("questions")
      .select("*, mcq_options(id, option_key, content)")
      .eq("test_id", testId)
      .order("question_number", { ascending: true });

    // Transform to camelCase to match TypeScript Question type
    questions = (data ?? []).map((q: Record<string, unknown>) => ({
      id: q.id,
      questionNumber: q.question_number,
      type: q.type,
      category: q.category,
      difficulty: q.difficulty,
      content: q.content,
      codeSnippet: q.code_snippet ?? null,
      language: q.language ?? null,
      marks: q.marks,
      negativeMarks: q.negative_marks,
      timeLimitSecs: q.time_limit_secs ?? null,
      tags: q.tags ?? [],
      options: Array.isArray(q.mcq_options)
        ? (q.mcq_options as { id: string; option_key: string; content: string }[])
            .map((o) => ({ key: o.option_key, content: o.content }))
        : undefined,
    }));
    await setCachedQuestions(testId, questions);
  }

  // Transform test to camelCase to match TypeScript Test type
  const rawTest = test as Record<string, unknown>;
  const testOut = {
    id: rawTest.id,
    title: rawTest.title,
    description: rawTest.description ?? null,
    category: rawTest.category,
    difficulty: rawTest.difficulty,
    durationMins: rawTest.duration_mins,
    totalMarks: rawTest.total_marks,
    passingMarks: rawTest.passing_marks,
    isAiGenerated: rawTest.is_ai_generated,
    tags: rawTest.tags ?? [],
  };

  return NextResponse.json({
    attemptId: attempt.id,
    startedAt: attempt.started_at,
    expiresAt,
    test: testOut,
    questions,
  });
}

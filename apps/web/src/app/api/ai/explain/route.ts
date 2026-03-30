import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/supabase/server";
import { generate } from "@/lib/ollama/client";
import { PROMPTS } from "@/lib/ollama/prompts";
import { getRedis } from "@/lib/redis";

const EXPLAIN_TTL = 86400; // 24 hours

const bodySchema = z.object({
  questionId: z.string().uuid(),
  selectedOption: z.string().nullable(),
  attemptId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parseResult = bodySchema.safeParse(await req.json());
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.flatten() }, { status: 400 });
  }

  const { questionId, selectedOption, attemptId } = parseResult.data;

  // Check Redis cache first (fastest path)
  const cacheKey = `explain:${questionId}`;
  try {
    const cached = await getRedis().get(cacheKey);
    if (cached) {
      return NextResponse.json({ explanation: cached, cached: true });
    }
  } catch {
    // Redis unavailable — fall through to DB/generation
  }

  // Verify attempt belongs to user
  const { data: attempt } = await supabase
    .from("test_attempts")
    .select("id, status")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .single();

  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  // Fetch question with correct answer
  const serviceClient = await getSupabaseServiceClient();
  const { data: question } = await serviceClient
    .from("questions")
    .select("content, explanation, ai_explanation, mcq_options(*)")
    .eq("id", questionId)
    .single();

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  // Return DB-cached explanation (also warm Redis)
  if (question.ai_explanation) {
    try { await getRedis().set(cacheKey, question.ai_explanation, "EX", EXPLAIN_TTL); } catch {}
    return NextResponse.json({ explanation: question.ai_explanation, cached: true });
  }

  const correctOption = (question as any).mcq_options?.find(
    (o: { is_correct: boolean; option_key: string; content: string }) => o.is_correct
  );
  const correctAnswer = correctOption
    ? `${correctOption.option_key}: ${correctOption.content}`
    : "N/A";

  const studentAnswer = selectedOption
    ? `${selectedOption}: ${(question as any).mcq_options?.find((o: { option_key: string; content: string }) => o.option_key === selectedOption)?.content ?? ""}`
    : "Not answered";

  const explanation = await generate(
    PROMPTS.explainAnswer(
      question.content,
      correctAnswer,
      question.explanation ?? "",
      studentAnswer
    ),
    { temperature: 0.5 }
  );

  // Cache in Redis (fast) and DB (persistent)
  try { await getRedis().set(cacheKey, explanation, "EX", EXPLAIN_TTL); } catch {}
  await serviceClient
    .from("questions")
    .update({ ai_explanation: explanation })
    .eq("id", questionId);

  return NextResponse.json({ explanation, cached: false });
}

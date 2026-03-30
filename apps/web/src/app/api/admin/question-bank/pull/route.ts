import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAPI } from "@/lib/supabase/admin-guard";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  testId: z.string().uuid(),
  category: z.enum(["aptitude", "verbal", "technical", "coding"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  count: z.number().int().min(1).max(200),
  topic: z.string().min(1).max(100).optional(),
});

/**
 * POST /api/admin/question-bank/pull
 * Copies N random questions from the bank into the target test.
 * Responds instantly — no AI call needed.
 */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireAdminAPI(req);
  if (authErr) return authErr;

  const parseResult = bodySchema.safeParse(await req.json());
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.flatten() }, { status: 400 });
  }

  const { testId, category, difficulty, count, topic } = parseResult.data;
  const supabase = await getSupabaseServiceClient();

  // Get random questions from bank
  let bankQuery = supabase
    .from("question_bank")
    .select("id, content, explanation, tags, question_bank_options(*)")
    .eq("category", category)
    .eq("difficulty", difficulty)
    .limit(count * 3) // over-fetch then randomise
    .order("used_count", { ascending: true }); // prefer least-used questions

  if (topic) bankQuery = bankQuery.eq("topic", topic);

  const { data: bankQuestions, error: fetchErr } = await bankQuery;

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!bankQuestions || bankQuestions.length === 0) {
    const topicSuffix = topic ? `/${topic}` : "";
    return NextResponse.json(
      { error: `No questions found in bank for ${category}/${difficulty}${topicSuffix}. Generate some first.` },
      { status: 404 }
    );
  }

  // Shuffle and take 'count'
  const shuffled = [...bankQuestions].sort(() => Math.random() - 0.5).slice(0, count);

  // Get current max question_number in the test
  const { data: existing } = await supabase
    .from("questions")
    .select("question_number")
    .eq("test_id", testId)
    .order("question_number", { ascending: false })
    .limit(1);

  let nextNumber = (existing?.[0]?.question_number ?? 0) + 1;

  let inserted = 0;
  const bankIdsToIncrement: string[] = [];

  for (const bq of shuffled) {
    const { data: newQ, error: qErr } = await supabase
      .from("questions")
      .insert({
        test_id: testId,
        question_number: nextNumber++,
        type: "mcq",
        category,
        difficulty,
        content: bq.content,
        marks: 1,
        negative_marks: 0.25,
        explanation: bq.explanation ?? "",
        tags: bq.tags ?? [],
      })
      .select("id")
      .single();

    if (qErr || !newQ) continue;
    inserted++;
    bankIdsToIncrement.push(bq.id);

    const opts = (bq as Record<string, unknown>).question_bank_options as Array<{
      option_key: string;
      content: string;
      is_correct: boolean;
    }>;

    if (opts?.length) {
      await supabase.from("mcq_options").insert(
        opts.map((o) => ({
          question_id: newQ.id,
          option_key: o.option_key,
          content: o.content,
          is_correct: o.is_correct,
        }))
      );
    }
  }

  // Increment used_count for pulled questions
  if (bankIdsToIncrement.length) {
    await supabase.rpc("increment_bank_used_count", { ids: bankIdsToIncrement }).maybeSingle();
  }

  // Mark test as AI generated
  await supabase.from("tests").update({ is_ai_generated: true }).eq("id", testId);

  return NextResponse.json({ inserted, available: bankQuestions.length });
}

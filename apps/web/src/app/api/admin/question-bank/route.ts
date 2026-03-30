import { NextRequest, NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/supabase/admin-guard";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

/** GET /api/admin/question-bank — stats + optional list */
export async function GET(req: NextRequest) {
  const { error } = await requireAdminAPI(req);
  if (error) return error;

  const supabase = await getSupabaseServiceClient();
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const difficulty = searchParams.get("difficulty");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);

  // Stats: count per category × difficulty, and per topic
  const { data: allRows } = await supabase
    .from("question_bank")
    .select("category, difficulty, topic, id");

  const counts: Record<string, number> = {};
  const topicCounts: Record<string, number> = {};
  for (const row of allRows ?? []) {
    const catDiffKey = `${row.category}__${row.difficulty}`;
    counts[catDiffKey] = (counts[catDiffKey] ?? 0) + 1;
    if (row.topic) {
      const tKey = `${row.category}__${row.difficulty}__${row.topic}`;
      topicCounts[tKey] = (topicCounts[tKey] ?? 0) + 1;
    }
  }
  const stats = counts;

  // Optional: list questions filtered by category/difficulty
  let query = supabase
    .from("question_bank")
    .select("id, category, difficulty, topic, content, used_count, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  const topic = searchParams.get("topic");
  if (category) query = query.eq("category", category);
  if (difficulty) query = query.eq("difficulty", difficulty);
  if (topic) query = query.eq("topic", topic);

  const { data: questions, error: qErr } = await query;
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  return NextResponse.json({ stats, topicStats: topicCounts, questions, total: questions?.length ?? 0 });
}

/** DELETE /api/admin/question-bank?id=uuid — delete one question */
export async function DELETE(req: NextRequest) {
  const { error } = await requireAdminAPI(req);
  if (error) return error;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = await getSupabaseServiceClient();
  const { error: dbErr } = await supabase.from("question_bank").delete().eq("id", id);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

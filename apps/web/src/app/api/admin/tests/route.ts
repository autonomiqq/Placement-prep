import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAPI } from "@/lib/supabase/admin-guard";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: z.enum(["aptitude", "verbal", "technical", "coding"]),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  duration_mins: z.number().int().min(5).max(180),
  total_marks: z.number().int().min(1),
  passing_marks: z.number().int().min(1),
  tags: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const { user, error } = await requireAdminAPI(req);
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = await getSupabaseServiceClient();
  const { data: test, error: dbError } = await supabase
    .from("tests")
    .insert({ ...parsed.data, created_by: user!.id, is_published: false })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ test }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdminAPI(req);
  if (error) return error;

  const supabase = await getSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("tests")
    .select("*, questions(count), test_attempts(count)")
    .order("created_at", { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ tests: data });
}

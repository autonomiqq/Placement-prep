import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAPI } from "@/lib/supabase/admin-guard";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { invalidateTestCache } from "@/lib/cache/tests";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  duration_mins: z.number().int().min(5).max(180).optional(),
  total_marks: z.number().int().min(1).optional(),
  passing_marks: z.number().int().min(1).optional(),
  is_published: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ testId: string }> }) {
  const { error } = await requireAdminAPI(req);
  if (error) return error;
  const { testId } = await params;

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = await getSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("tests")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", testId)
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  // Bust cache so students get fresh questions/metadata after any admin change
  await invalidateTestCache(testId);
  return NextResponse.json({ test: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ testId: string }> }) {
  const { error } = await requireAdminAPI(req);
  if (error) return error;
  const { testId } = await params;

  const supabase = await getSupabaseServiceClient();

  // Only allow deleting unpublished tests
  const { data: test } = await supabase.from("tests").select("is_published").eq("id", testId).single();
  if (test?.is_published) {
    return NextResponse.json({ error: "Cannot delete a published test. Unpublish it first." }, { status: 409 });
  }

  const { error: dbError } = await supabase.from("tests").delete().eq("id", testId);
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

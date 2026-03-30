import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAPI } from "@/lib/supabase/admin-guard";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const createSchema = z.object({
  test_id:  z.string().uuid(),
  college:  z.string().min(1).max(200).nullable().optional(),
  branch:   z.string().min(1).max(100).nullable().optional(),
  section:  z.string().min(1).max(10).nullable().optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAdminAPI(req);
  if (error) return error;

  const testId = req.nextUrl.searchParams.get("testId");
  if (!testId) return NextResponse.json({ error: "testId required" }, { status: 400 });

  const supabase = await getSupabaseServiceClient();
  const { data, error: dbErr } = await supabase
    .from("test_assignments")
    .select("*")
    .eq("test_id", testId)
    .order("created_at", { ascending: true });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ assignments: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdminAPI(req);
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = await getSupabaseServiceClient();
  const { data, error: dbErr } = await supabase
    .from("test_assignments")
    .insert({
      test_id: parsed.data.test_id,
      college: parsed.data.college ?? null,
      branch:  parsed.data.branch  ?? null,
      section: parsed.data.section ?? null,
    })
    .select()
    .single();

  if (dbErr) {
    if (dbErr.code === "23505")
      return NextResponse.json({ error: "This assignment already exists." }, { status: 409 });
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({ assignment: data }, { status: 201 });
}

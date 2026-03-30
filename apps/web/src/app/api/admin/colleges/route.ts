import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAPI } from "@/lib/supabase/admin-guard";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const createSchema = z.object({
  name: z.string().min(2).max(200),
  code: z.string().min(1).max(20).toUpperCase(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAdminAPI(req);
  if (error) return error;

  const supabase = await getSupabaseServiceClient();

  // Colleges with student count
  const { data: colleges, error: dbErr } = await supabase
    .from("colleges")
    .select("*")
    .order("name", { ascending: true });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  // Count students per college
  const { data: counts } = await supabase
    .from("profiles")
    .select("college")
    .eq("role", "student")
    .not("college", "is", null);

  const studentCount: Record<string, number> = {};
  for (const row of counts ?? []) {
    if (row.college) studentCount[row.college] = (studentCount[row.college] ?? 0) + 1;
  }

  return NextResponse.json({
    colleges: (colleges ?? []).map((c) => ({
      ...c,
      student_count: studentCount[c.name] ?? 0,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdminAPI(req);
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = await getSupabaseServiceClient();
  const { data, error: dbErr } = await supabase
    .from("colleges")
    .insert(parsed.data)
    .select()
    .single();

  if (dbErr) {
    if (dbErr.code === "23505")
      return NextResponse.json({ error: "A college with that name or code already exists." }, { status: 409 });
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({ college: data }, { status: 201 });
}

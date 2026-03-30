import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAPI } from "@/lib/supabase/admin-guard";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const createSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).max(100),
  password: z.string().min(6),
  college: z.string().max(200).optional(),
  branch: z.string().max(100).optional(),
  section: z.string().max(10).optional(),
  graduation_year: z.number().int().min(2024).max(2035).optional(),
});

export async function POST(req: NextRequest) {
  const { error } = await requireAdminAPI(req);
  if (error) return error;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { email, full_name, password, college, branch, section, graduation_year } = parsed.data;
  const supabase = await getSupabaseServiceClient();

  // Create auth user — pass role:"admin" in metadata to skip the trigger's
  // user_category_stats insert (which fails in the trigger context due to RLS).
  // We then fix the role and insert stats manually, mirroring /api/auth/register.
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name,
      role: "admin", // skip broken trigger stats insert
    },
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? "Failed to create auth user" }, { status: 400 });
  }

  const userId = authData.user.id;

  // Fix role back to "student" and apply optional profile fields
  await supabase
    .from("profiles")
    .update({ role: "student", college: college ?? null, branch: branch ?? null, section: section ?? null, graduation_year: graduation_year ?? null })
    .eq("id", userId);

  // Insert category stats manually (trigger skipped them)
  const CATEGORIES = ["aptitude", "verbal", "technical", "coding"] as const;
  for (const category of CATEGORIES) {
    await supabase
      .from("user_category_stats")
      .upsert({ user_id: userId, category }, { onConflict: "user_id,category" });
  }

  return NextResponse.json({ user: { id: userId, email, full_name } }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdminAPI(req);
  if (error) return error;

  const supabase = await getSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("profiles")
    .select("id, full_name, college, branch, graduation_year, total_points, last_active, created_at, user_category_stats(category, tests_taken, avg_score)")
    .eq("role", "student")
    .order("created_at", { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ students: data });
}

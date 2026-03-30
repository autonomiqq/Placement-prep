// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
  college: z.string().max(150).optional(),
  branch: z.string().max(100).optional(),
  graduation_year: z.number().int().min(2000).max(2040).nullable().optional(),
});

/** PATCH /api/profile — update own profile */
export async function PATCH(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parseResult = updateSchema.safeParse(await req.json());
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.flatten() }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ ...parseResult.data, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** DELETE /api/profile — delete own account */
export async function DELETE(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = await getSupabaseServiceClient();

  // Null out tests.created_by for any tests this user created
  // (FK has no ON DELETE SET NULL, so we must clear it manually)
  await service.from("tests").update({ created_by: null }).eq("created_by", user.id);

  // Now delete the auth user — profiles/attempts cascade automatically
  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

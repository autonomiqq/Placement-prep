import { NextRequest, NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/supabase/admin-guard";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminAPI(req);
  if (error) return error;

  const { id } = await params;
  const supabase = await getSupabaseServiceClient();

  const { error: dbErr } = await supabase
    .from("test_assignments")
    .delete()
    .eq("id", id);

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

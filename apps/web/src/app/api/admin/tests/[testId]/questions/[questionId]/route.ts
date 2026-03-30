import { NextRequest, NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/supabase/admin-guard";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string; questionId: string }> }
) {
  const { error } = await requireAdminAPI(req);
  if (error) return error;
  const { testId, questionId } = await params;

  const supabase = await getSupabaseServiceClient();
  const { error: dbError } = await supabase
    .from("questions")
    .delete()
    .eq("id", questionId)
    .eq("test_id", testId);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

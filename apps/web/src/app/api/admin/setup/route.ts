import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * One-time admin promotion endpoint.
 * POST /api/admin/setup  with body { secret: "<ADMIN_SETUP_SECRET>" }
 * Promotes the currently logged-in user to admin role.
 *
 * Set ADMIN_SETUP_SECRET in .env.local before using.
 * Once you have at least one admin, you don't need this anymore.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_SETUP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "ADMIN_SETUP_SECRET not configured" }, { status: 403 });
  }

  const { secret: provided } = await req.json();
  if (provided !== secret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
  }

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const serviceClient = await getSupabaseServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (serviceClient as any)
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, message: `User ${user.email} promoted to admin` });
}

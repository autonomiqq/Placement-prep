import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "./server";

/** Use in admin Server Components — redirects away if not admin. */
export async function requireAdmin() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirectTo=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");
  return { user, profile };
}

/** Use in admin API routes — returns error response if not admin. */
export async function requireAdminAPI(_req: NextRequest): Promise<
  | { user: { id: string }; error: null }
  | { user: null; error: NextResponse }
> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { user: null, error: NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 }) };
  }

  return { user, error: null };
}

// @ts-nocheck
import { getSupabaseServerClient } from "@/lib/supabase/server";
import ProfileClient from "./_components/ProfileClient";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, username, full_name, college, branch, graduation_year, total_points, rank, streak_days, created_at, role")
    .eq("id", user!.id)
    .single();

  // Only create a missing profile if the error is "no rows found" (PGRST116).
  // Any other error (transient failure, RLS, etc.) must NOT trigger an upsert —
  // that would silently overwrite an existing admin's role with "student".
  if (!profile && profileErr?.code === "PGRST116") {
    const username = (user!.email!.split("@")[0] + "_" + user!.id.slice(0, 4)).replace(/[^a-z0-9_]/gi, "_");
    await supabase.from("profiles").upsert({
      id: user!.id,
      username,
      full_name: null,
      role: "student",
    }, { onConflict: "id", ignoreDuplicates: true });
    const { data: newProfile } = await supabase
      .from("profiles")
      .select("id, username, full_name, college, branch, graduation_year, total_points, rank, streak_days, created_at, role")
      .eq("id", user!.id)
      .single();

    if (!newProfile) {
      return (
        <div className="max-w-2xl mx-auto">
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center">
            <p className="text-sm text-destructive font-medium">Could not load profile. Please try refreshing.</p>
          </div>
        </div>
      );
    }

    return <ProfileClient profile={newProfile} email={user!.email!} />;
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive font-medium">Could not load profile. Please try refreshing.</p>
        </div>
      </div>
    );
  }

  return <ProfileClient profile={profile} email={user!.email!} />;
}

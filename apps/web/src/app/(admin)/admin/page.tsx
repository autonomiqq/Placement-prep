// @ts-nocheck
import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { Users, ClipboardList, TrendingUp, Activity, Plus, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/utils/formatters";

export const metadata = { title: "Admin — Overview" };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const supabase = await getSupabaseServiceClient();

  const [
    { count: totalStudents },
    { count: totalTests },
    { count: totalAttempts },
    { data: recentAttempts },
    { data: recentStudents },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("tests").select("*", { count: "exact", head: true }),
    supabase.from("test_attempts").select("*", { count: "exact", head: true }).eq("status", "submitted"),
    supabase
      .from("test_attempts")
      .select("id, percentage, submitted_at, profiles(full_name), tests(title)")
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false })
      .limit(6),
    supabase
      .from("profiles")
      .select("id, full_name, college, created_at")
      .eq("role", "student")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const { data: avgData } = await supabase
    .from("test_attempts")
    .select("percentage")
    .eq("status", "submitted");
  const avgScore =
    avgData && avgData.length > 0
      ? (avgData.reduce((s, a) => s + (a.percentage ?? 0), 0) / avgData.length).toFixed(1)
      : "—";

  const stats = [
    { label: "Total Students", value: totalStudents ?? 0, icon: Users, color: "text-blue-600 bg-blue-50", href: "/admin/students" },
    { label: "Tests Created", value: totalTests ?? 0, icon: ClipboardList, color: "text-purple-600 bg-purple-50", href: "/admin/tests" },
    { label: "Tests Submitted", value: totalAttempts ?? 0, icon: Activity, color: "text-green-600 bg-green-50", href: "/admin/analytics" },
    { label: "Avg. Score", value: `${avgScore}%`, icon: TrendingUp, color: "text-orange-600 bg-orange-50", href: "/admin/analytics" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage students, tests, and analytics</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/students/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Student
          </Link>
          <Link
            href="/admin/tests/new"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Plus className="h-4 w-4" /> New Test
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, href }) => (
          <Link key={label} href={href} className="rounded-xl border border-border bg-white p-5 hover:shadow-sm transition-shadow">
            <div className={`inline-flex rounded-lg p-2 mb-3 ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent test submissions */}
        <div className="rounded-xl border border-border bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Recent Submissions</h2>
            <Link href="/admin/analytics" className="text-xs text-primary flex items-center gap-1 hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentAttempts && recentAttempts.length > 0 ? (
              recentAttempts.map((a) => {
                const student = a.profiles as { full_name: string } | null;
                const test = a.tests as { title: string } | null;
                const pct = a.percentage ?? 0;
                return (
                  <div key={a.id} className="flex items-center justify-between py-1">
                    <div>
                      <p className="text-sm font-medium text-foreground">{student?.full_name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{test?.title ?? "—"}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold ${pct >= 60 ? "text-green-600" : "text-destructive"}`}>
                        {pct.toFixed(1)}%
                      </span>
                      <p className="text-xs text-muted-foreground">{formatDate(a.submitted_at)}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No submissions yet.</p>
            )}
          </div>
        </div>

        {/* Recent students */}
        <div className="rounded-xl border border-border bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Recently Joined</h2>
            <Link href="/admin/students" className="text-xs text-primary flex items-center gap-1 hover:underline">
              All students <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentStudents && recentStudents.length > 0 ? (
              recentStudents.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{s.college ?? "College not set"}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(s.created_at)}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No students yet.</p>
            )}
          </div>
          <Link
            href="/admin/students/new"
            className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="h-4 w-4" /> Add student
          </Link>
        </div>
      </div>
    </div>
  );
}

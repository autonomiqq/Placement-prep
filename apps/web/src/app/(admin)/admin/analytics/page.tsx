// @ts-nocheck
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin — Analytics" };
export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  aptitude: "Aptitude", verbal: "Verbal", technical: "Technical", coding: "Coding",
};

export default async function AdminAnalyticsPage() {
  await requireAdmin();
  const supabase = await getSupabaseServiceClient();

  const [
    { data: students },
    { data: categoryStats },
    { data: testStats },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, college, branch, total_points, last_active, user_category_stats(category, tests_taken, avg_score, best_score, correct_count, questions_seen)")
      .eq("role", "student")
      .order("total_points", { ascending: false }),
    supabase
      .from("user_category_stats")
      .select("category, tests_taken, avg_score, correct_count, questions_seen"),
    supabase
      .from("tests")
      .select("id, title, category, is_published, test_attempts(id, percentage)")
      .eq("is_published", true),
  ]);

  // Aggregate category data across all students
  type StatRow = { category: string; tests_taken: number; avg_score: number; correct_count: number; questions_seen: number };
  const catAgg = ["aptitude", "verbal", "technical", "coding"].map((cat) => {
    const rows = (categoryStats as StatRow[] | null)?.filter((r) => r.category === cat) ?? [];
    const totalTests = rows.reduce((s, r) => s + r.tests_taken, 0);
    const avgScore = totalTests > 0
      ? rows.reduce((s, r) => s + r.avg_score * r.tests_taken, 0) / totalTests
      : 0;
    const accuracy = rows.reduce((s, r) => s + r.questions_seen, 0) > 0
      ? (rows.reduce((s, r) => s + r.correct_count, 0) / rows.reduce((s, r) => s + r.questions_seen, 0)) * 100
      : 0;
    return { cat, totalTests, avgScore, accuracy };
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Platform-wide performance overview</p>
      </div>

      {/* Category breakdown */}
      <div>
        <h2 className="font-semibold text-foreground mb-3">Category Performance (All Students)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {catAgg.map(({ cat, totalTests, avgScore, accuracy }) => (
            <div key={cat} className="rounded-xl border border-border bg-white p-5">
              <p className="text-sm font-semibold text-foreground capitalize">{CATEGORY_LABEL[cat]}</p>
              <p className="text-2xl font-bold text-foreground mt-2">{avgScore.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">avg score</p>
              <div className="mt-3 pt-3 border-t border-border flex justify-between text-xs text-muted-foreground">
                <span>{totalTests} attempts</span>
                <span>{accuracy.toFixed(0)}% accuracy</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Test participation */}
      {(testStats as unknown[])?.length > 0 && (
        <div>
          <h2 className="font-semibold text-foreground mb-3">Test Participation</h2>
          <div className="rounded-xl border border-border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Test</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Attempts</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Avg Score</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Pass Rate</th>
                </tr>
              </thead>
              <tbody>
                {(testStats as Array<{ id: string; title: string; category: string; test_attempts: Array<{ id: string; percentage: number }> }>).map((t) => {
                  const allAttempts = t.test_attempts ?? [];
                  const count = allAttempts.length;
                  const avgPct = count > 0
                    ? allAttempts.filter((a) => a.percentage != null).reduce((s, a) => s + (a.percentage ?? 0), 0) / count
                    : 0;
                  const passRate = count > 0
                    ? (allAttempts.filter((a) => (a.percentage ?? 0) >= 60).length / count) * 100
                    : 0;
                  return (
                    <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium text-foreground">{t.title}</td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{t.category}</td>
                      <td className="px-4 py-3 text-center font-medium">{count}</td>
                      <td className="px-4 py-3 text-center font-medium">{count > 0 ? `${avgPct.toFixed(1)}%` : "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-medium ${passRate >= 60 ? "text-green-600" : passRate > 0 ? "text-orange-600" : "text-muted-foreground"}`}>
                          {count > 0 ? `${passRate.toFixed(0)}%` : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student leaderboard */}
      <div>
        <h2 className="font-semibold text-foreground mb-3">Student Performance</h2>
        <div className="rounded-xl border border-border bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rank</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Student</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">College</th>
                  {["Aptitude", "Verbal", "Technical", "Coding"].map((c) => (
                    <th key={c} className="text-center px-3 py-3 font-medium text-muted-foreground">{c}</th>
                  ))}
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Points</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {students && students.length > 0 ? (
                  (students as Array<{ id: string; full_name: string | null; college: string | null; branch: string | null; total_points: number; last_active: string | null; user_category_stats: Array<{ category: string; avg_score: number; tests_taken: number }> }>).map((s, idx) => {
                    const stats = s.user_category_stats;
                    const getScore = (cat: string) => {
                      const c = stats?.find((r) => r.category === cat);
                      return c && c.tests_taken > 0 ? `${c.avg_score.toFixed(0)}%` : "—";
                    };
                    return (
                      <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3 text-center font-bold text-muted-foreground">#{idx + 1}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{s.full_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{s.branch ?? ""}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{s.college ?? "—"}</td>
                        {["aptitude", "verbal", "technical", "coding"].map((cat) => (
                          <td key={cat} className="px-3 py-3 text-center text-sm font-medium">
                            <span className={getScore(cat) === "—" ? "text-muted-foreground" : parseFloat(getScore(cat)) >= 60 ? "text-green-600" : "text-orange-600"}>
                              {getScore(cat)}
                            </span>
                          </td>
                        ))}
                        <td className="px-4 py-3 text-center font-bold text-foreground">{s.total_points}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {s.last_active ? new Date(s.last_active).toLocaleDateString() : "Never"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">No students yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

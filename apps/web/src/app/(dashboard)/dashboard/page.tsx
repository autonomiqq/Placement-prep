// @ts-nocheck
export const dynamic = "force-dynamic";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatPercentage } from "@/lib/utils/formatters";
import {
  BookOpen, Brain, Target, TrendingUp, ArrowRight, Zap,
  AlertTriangle, CheckCircle2, Clock, BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Dashboard" };

const CATEGORIES = [
  { key: "aptitude",  label: "Aptitude",  color: "text-blue-600 bg-blue-50",   icon: Target },
  { key: "verbal",    label: "Verbal",    color: "text-purple-600 bg-purple-50", icon: Brain },
  { key: "technical", label: "Technical", color: "text-orange-600 bg-orange-50", icon: TrendingUp },
  { key: "coding",    label: "Coding",    color: "text-green-600 bg-green-50",  icon: Zap },
];

const CATEGORY_COLORS: Record<string, string> = {
  aptitude:  "bg-blue-100 text-blue-700 border-blue-200",
  verbal:    "bg-purple-100 text-purple-700 border-purple-200",
  technical: "bg-orange-100 text-orange-700 border-orange-200",
  coding:    "bg-green-100 text-green-700 border-green-200",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy:   "text-green-600",
  medium: "text-amber-600",
  hard:   "text-red-600",
};

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profile }, { data: stats }, { data: recentAttempts }, { data: attempts }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, total_points, rank, streak_days")
        .eq("id", user!.id)
        .single(),
      supabase
        .from("user_category_stats")
        .select("*")
        .eq("user_id", user!.id),
      supabase
        .from("test_attempts")
        .select("id, status, score, total_marks, percentage, started_at, test_id, tests(title, category)")
        .eq("user_id", user!.id)
        .eq("status", "submitted")
        .order("started_at", { ascending: false })
        .limit(5),
      supabase
        .from("test_attempts")
        .select("test_id")
        .eq("user_id", user!.id)
        .eq("status", "submitted"),
    ]);

  const totalTests = stats?.reduce((sum, s) => sum + s.tests_taken, 0) ?? 0;
  const avgScore =
    totalTests > 0
      ? stats!.reduce((sum, s) => sum + s.avg_score * s.tests_taken, 0) / totalTests
      : 0;

  // ── Weakness detection ─────────────────────────────────────────────────────
  const takenTestIds = [...new Set((attempts ?? []).map((a) => a.test_id))];

  // Rank categories by accuracy (worst first)
  const rankedCategories = (stats ?? [])
    .filter((s) => s.tests_taken > 0)
    .map((s) => ({
      category: s.category,
      label: CATEGORIES.find((c) => c.key === s.category)?.label ?? s.category,
      avgScore: Math.round(s.avg_score ?? 0),
      accuracy:
        s.questions_seen > 0
          ? Math.round((s.correct_count / s.questions_seen) * 100)
          : null,
      testsTaken: s.tests_taken,
      questionsSeen: s.questions_seen ?? 0,
    }))
    .sort((a, b) => (a.accuracy ?? 100) - (b.accuracy ?? 100));

  const weakestCategory = rankedCategories[0] ?? null;

  // Fetch recommended tests for the two weakest categories
  const focusCategories =
    rankedCategories.length > 0
      ? rankedCategories.slice(0, 2).map((c) => c.category)
      : ["aptitude", "verbal"];

  const { data: recommendedTests } = await supabase
    .from("tests")
    .select("id, title, category, difficulty, duration_mins, total_marks, tags")
    .eq("is_published", true)
    .in("category", focusCategories)
    .limit(12);

  // Prefer untaken tests
  const sortedRecommended = (recommendedTests ?? [])
    .map((t) => ({ ...t, alreadyTaken: takenTestIds.includes(t.id) }))
    .sort((a, b) => {
      if (a.alreadyTaken !== b.alreadyTaken) return a.alreadyTaken ? 1 : -1;
      // Prioritize weakest category
      const aIdx = focusCategories.indexOf(a.category);
      const bIdx = focusCategories.indexOf(b.category);
      return aIdx - bIdx;
    })
    .slice(0, 3);

  const hasInsights = rankedCategories.length > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {profile?.full_name?.split(" ")[0] ?? "Student"}!
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {profile?.streak_days && profile.streak_days > 0
            ? `🔥 You're on a ${profile.streak_days}-day streak. Keep it up!`
            : "Start a test to build your streak."}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Points", value: profile?.total_points ?? 0, suffix: "pts" },
          { label: "Rank",         value: profile?.rank ? `#${profile.rank}` : "—", suffix: "" },
          { label: "Tests Taken",  value: totalTests, suffix: "" },
          { label: "Avg. Score",   value: formatPercentage(avgScore), suffix: "" },
        ].map(({ label, value, suffix }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {value}
              {suffix && <span className="text-base font-normal text-muted-foreground ml-1">{suffix}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* ── Weakness Insights ────────────────────────────────────────────── */}
      {hasInsights ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-red-50 p-1.5">
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Focus Areas</p>
                <p className="text-xs text-muted-foreground">Based on your answer history</p>
              </div>
            </div>
            <Link
              href="/analytics"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              Full breakdown <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Weak categories ranked */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Category Accuracy
              </p>
              {rankedCategories.map((cat) => {
                const catMeta = CATEGORIES.find((c) => c.key === cat.category);
                const Icon = catMeta?.icon ?? Target;
                const accuracy = cat.accuracy ?? 0;
                const isWeak = accuracy < 60;
                return (
                  <div key={cat.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-3.5 w-3.5", isWeak ? "text-red-500" : "text-green-500")} />
                        <span className="font-medium text-foreground">{cat.label}</span>
                        <span className="text-xs text-muted-foreground">({cat.testsTaken} tests)</span>
                      </div>
                      <span className={cn("text-sm font-bold", isWeak ? "text-red-600" : "text-green-600")}>
                        {cat.accuracy !== null ? `${cat.accuracy}%` : "—"}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          accuracy >= 75 ? "bg-green-500" :
                          accuracy >= 50 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${accuracy}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: Recommended tests */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {weakestCategory
                  ? `Recommended — Focus on ${weakestCategory.label}`
                  : "Recommended for You"}
              </p>
              {sortedRecommended.length > 0 ? (
                <div className="space-y-2">
                  {sortedRecommended.map((test) => (
                    <Link
                      key={test.id}
                      href={`/tests/${test.id}`}
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/50 transition-colors group",
                        test.alreadyTaken ? "border-border opacity-60" : "border-border"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-xs font-semibold capitalize",
                              CATEGORY_COLORS[test.category]
                            )}
                          >
                            {test.category}
                          </span>
                          <span className={cn("text-xs font-medium capitalize", DIFFICULTY_COLORS[test.difficulty])}>
                            {test.difficulty}
                          </span>
                          {test.alreadyTaken && (
                            <span className="text-xs text-muted-foreground">(retake)</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground truncate">{test.title}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {test.duration_mins} min · {test.total_marks} marks
                        </p>
                      </div>
                      <ChevronRightIcon />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-400 mb-2" />
                  <p className="text-sm font-medium text-foreground">All caught up!</p>
                  <p className="text-xs text-muted-foreground">No untaken tests available in your focus areas.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* No data yet — encourage first test */
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
          <BarChart2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1">No insights yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            Take at least one test to see your personalized weakness analysis and recommendations.
          </p>
          <Link
            href="/tests"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            Start your first test
          </Link>
        </div>
      )}

      {/* Category stats */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Category Performance</h2>
          <Link href="/analytics" className="text-sm text-primary flex items-center gap-1 hover:underline">
            Full analytics <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {CATEGORIES.map(({ key, label, color, icon: Icon }) => {
            const s = stats?.find((s) => s.category === key);
            return (
              <div key={key} className="rounded-xl border border-border bg-card p-5">
                <div className={`inline-flex rounded-lg p-2 mb-3 ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {s?.tests_taken > 0 ? formatPercentage(s.avg_score) : "—"}
                </p>
                <p className="text-xs text-muted-foreground">{s?.tests_taken ?? 0} tests</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick actions + recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Quick Practice</h2>
          <div className="space-y-2">
            {CATEGORIES.map(({ key, label }) => (
              <Link
                key={key}
                href={`/tests?category=${key}`}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
              >
                {label}
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">Recent Attempts</h2>
          </div>
          {recentAttempts && recentAttempts.length > 0 ? (
            <div className="space-y-3">
              {recentAttempts.map((attempt) => {
                const test = attempt.tests as { title: string; category: string } | null;
                const passed = (attempt.percentage ?? 0) >= 60;
                return (
                  <Link
                    key={attempt.id}
                    href={`/tests/${attempt.test_id ?? ""}/results?attemptId=${attempt.id}`}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-3 hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{test?.title ?? "Unknown Test"}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {test?.category} · {formatDate(attempt.started_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${passed ? "text-green-600" : "text-destructive"}`}>
                        {formatPercentage(attempt.percentage ?? 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {attempt.score}/{attempt.total_marks}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No tests taken yet.</p>
              <Link href="/tests" className="mt-3 text-sm font-semibold text-primary hover:underline">
                Take your first test
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted-foreground shrink-0 ml-2"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

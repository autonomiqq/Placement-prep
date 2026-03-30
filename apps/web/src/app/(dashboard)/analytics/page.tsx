// @ts-nocheck
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatPercentage, formatDuration } from "@/lib/utils/formatters";
import {
  Target, Brain, TrendingUp, Zap, AlertTriangle,
  CheckCircle2, BookOpen, Clock, ArrowRight, TrendingDown,
} from "lucide-react";
import AnalyticsCharts from "@/components/analytics/AnalyticsCharts";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Analytics" };

const CATEGORIES = [
  { key: "aptitude",  label: "Aptitude",  icon: Target,      color: "blue" },
  { key: "verbal",    label: "Verbal",    icon: Brain,       color: "purple" },
  { key: "technical", label: "Technical", icon: TrendingUp,  color: "orange" },
  { key: "coding",    label: "Coding",    icon: Zap,         color: "green" },
];

const colorMap: Record<string, string> = {
  blue:   "bg-blue-50 text-blue-600",
  purple: "bg-purple-50 text-purple-600",
  orange: "bg-orange-50 text-orange-600",
  green:  "bg-green-50 text-green-600",
};

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

export default async function AnalyticsPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: stats }, { data: recentAttempts }, { data: attempts }] = await Promise.all([
    supabase
      .from("user_category_stats")
      .select("*")
      .eq("user_id", user!.id),
    supabase
      .from("test_attempts")
      .select("percentage, started_at, tests(category)")
      .eq("user_id", user!.id)
      .eq("status", "submitted")
      .order("started_at", { ascending: true })
      .limit(30),
    supabase
      .from("test_attempts")
      .select("id, test_id")
      .eq("user_id", user!.id)
      .eq("status", "submitted"),
  ]);

  const radarData = CATEGORIES.map(({ key, label }) => {
    const s = stats?.find((s) => s.category === key);
    return { category: label, score: s?.avg_score ?? 0, fullMark: 100 };
  });

  // ── Accuracy per category ──────────────────────────────────────────────────
  const categoryInsights = CATEGORIES.map(({ key, label, icon: Icon, color }) => {
    const s = stats?.find((s) => s.category === key);
    const accuracy =
      s && s.questions_seen > 0
        ? Math.round((s.correct_count / s.questions_seen) * 100)
        : null;
    return {
      key, label, Icon, color,
      avgScore:      Math.round(s?.avg_score ?? 0),
      accuracy,
      testsTaken:    s?.tests_taken ?? 0,
      questionsSeen: s?.questions_seen ?? 0,
      correctCount:  s?.correct_count ?? 0,
      totalTimeSecs: s?.total_time_secs ?? 0,
    };
  });

  const activeCategories = categoryInsights.filter((c) => c.testsTaken > 0);
  const rankedByAccuracy = [...activeCategories].sort(
    (a, b) => (a.accuracy ?? 100) - (b.accuracy ?? 100)
  );

  // ── Weak topics from wrong answers ─────────────────────────────────────────
  const attemptIds = (attempts ?? []).map((a) => a.id);
  const takenTestIds = [...new Set((attempts ?? []).map((a) => a.test_id))];

  let weakTopics: { tag: string; wrongCount: number; totalCount: number; accuracy: number }[] = [];
  if (attemptIds.length > 0) {
    const { data: allAnswers } = await supabase
      .from("answers")
      .select("is_correct, questions(tags)")
      .in("attempt_id", attemptIds)
      .limit(500);

    const tagStats: Record<string, { wrong: number; total: number }> = {};
    for (const ans of allAnswers ?? []) {
      const q = ans.questions as { tags: string[] } | null;
      for (const tag of q?.tags ?? []) {
        if (!tagStats[tag]) tagStats[tag] = { wrong: 0, total: 0 };
        tagStats[tag].total += 1;
        if (!ans.is_correct) tagStats[tag].wrong += 1;
      }
    }

    weakTopics = Object.entries(tagStats)
      .filter(([, s]) => s.total >= 3)
      .map(([tag, s]) => ({
        tag,
        wrongCount: s.wrong,
        totalCount: s.total,
        accuracy: Math.round(((s.total - s.wrong) / s.total) * 100),
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 8);
  }

  // ── Recommended tests ──────────────────────────────────────────────────────
  const weakCats = rankedByAccuracy.slice(0, 2).map((c) => c.key);
  const focusCats = weakCats.length > 0 ? weakCats : ["aptitude", "verbal"];

  const { data: recommendedTests } = await supabase
    .from("tests")
    .select("id, title, category, difficulty, duration_mins, total_marks, tags")
    .eq("is_published", true)
    .in("category", focusCats)
    .limit(12);

  const sortedRecommended = (recommendedTests ?? [])
    .map((t) => ({ ...t, alreadyTaken: takenTestIds.includes(t.id) }))
    .sort((a, b) => {
      if (a.alreadyTaken !== b.alreadyTaken) return a.alreadyTaken ? 1 : -1;
      return focusCats.indexOf(a.category) - focusCats.indexOf(b.category);
    })
    .slice(0, 4);

  const hasData = activeCategories.length > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your performance across all categories</p>
      </div>

      {/* ── Category overview cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {categoryInsights.map(({ key, label, Icon, color, avgScore, accuracy, testsTaken, correctCount, questionsSeen, totalTimeSecs }) => (
          <div key={key} className="rounded-xl border border-border bg-card p-5">
            <div className={`inline-flex rounded-lg p-2 mb-3 ${colorMap[color]}`}>
              <Icon className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground">
              {testsTaken > 0 ? formatPercentage(avgScore) : "—"}
            </p>
            <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              <p>{testsTaken} tests · {correctCount} correct</p>
              {accuracy !== null && (
                <p>Accuracy: <span className={cn("font-semibold", accuracy < 60 ? "text-red-500" : "text-green-600")}>{accuracy}%</span></p>
              )}
              <p>Time: {formatDuration(totalTimeSecs)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Weakness summary ─────────────────────────────────────────────── */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Category accuracy bars */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h2 className="text-base font-semibold text-foreground">Accuracy by Category</h2>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Correct answers ÷ total questions attempted
            </p>
            <div className="space-y-4">
              {rankedByAccuracy.map(({ key, label, Icon, accuracy, questionsSeen, correctCount }) => {
                const acc = accuracy ?? 0;
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-3.5 w-3.5", acc < 50 ? "text-red-500" : acc < 70 ? "text-amber-500" : "text-green-500")} />
                        <span className="font-medium text-foreground">{label}</span>
                      </div>
                      <div className="text-right">
                        <span className={cn("font-bold text-sm", acc < 50 ? "text-red-600" : acc < 70 ? "text-amber-600" : "text-green-600")}>
                          {accuracy !== null ? `${acc}%` : "—"}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1.5">({correctCount}/{questionsSeen})</span>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          acc >= 75 ? "bg-green-500" :
                          acc >= 50 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${acc}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-500" /> &lt;50% Needs work</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> 50–75% Improving</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green-500" /> &gt;75% Strong</span>
            </div>
          </div>

          {/* Weak topics */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <h2 className="text-base font-semibold text-foreground">Weak Topics</h2>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Topics where you miss the most questions (min. 3 attempts)
            </p>
            {weakTopics.length > 0 ? (
              <div className="space-y-3">
                {weakTopics.map(({ tag, wrongCount, totalCount, accuracy }) => (
                  <div key={tag} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground capitalize">{tag}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{wrongCount} wrong / {totalCount}</span>
                        <span className={cn("text-xs font-bold", accuracy < 50 ? "text-red-600" : accuracy < 70 ? "text-amber-600" : "text-green-600")}>
                          {accuracy}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", accuracy < 50 ? "bg-red-500" : accuracy < 70 ? "bg-amber-500" : "bg-green-500")}
                        style={{ width: `${accuracy}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-400 mb-2" />
                <p className="text-sm font-medium text-foreground">No weak topics found</p>
                <p className="text-xs text-muted-foreground">Take more tests to see topic-level breakdown</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Charts ───────────────────────────────────────────────────────── */}
      <AnalyticsCharts radarData={radarData} recentAttempts={recentAttempts ?? []} />

      {/* ── Recommended tests ────────────────────────────────────────────── */}
      {sortedRecommended.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Recommended Tests</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Targeted at your weakest categories
              </p>
            </div>
            <Link href="/tests" className="text-sm text-primary hover:underline flex items-center gap-1">
              Browse all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sortedRecommended.map((test) => (
              <Link
                key={test.id}
                href={`/tests/${test.id}`}
                className={cn(
                  "rounded-xl border border-border bg-card p-5 hover:shadow-md hover:border-primary/30 transition-all group",
                  test.alreadyTaken && "opacity-70"
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold capitalize", CATEGORY_COLORS[test.category])}>
                    {test.category}
                  </span>
                  {test.alreadyTaken && (
                    <span className="text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
                      Retake
                    </span>
                  )}
                </div>
                <p className="font-semibold text-foreground group-hover:text-primary transition-colors mb-3">
                  {test.title}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{test.duration_mins} min</span>
                  <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{test.total_marks} marks</span>
                  <span className={cn("font-medium capitalize", DIFFICULTY_COLORS[test.difficulty])}>{test.difficulty}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* No data state */}
      {!hasData && (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-12 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-sm font-semibold text-foreground mb-1">No data yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            Complete tests to unlock your full analytics dashboard.
          </p>
          <Link
            href="/tests"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Browse Tests
          </Link>
        </div>
      )}
    </div>
  );
}

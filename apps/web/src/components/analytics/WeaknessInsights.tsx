"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, TrendingDown, BookOpen,
  Clock, Loader2, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { InsightsPayload } from "@/app/api/analytics/insights/route";

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

/**
 * Client component — fetches /api/analytics/insights and renders
 * a condensed weakness summary. Use this anywhere in the app.
 */
export default function WeaknessInsights({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/analytics/insights");
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Analysing your performance...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <button onClick={load} className="flex items-center gap-2 text-primary hover:underline">
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  if (!data || !data.hasData) {
    return (
      <div className="py-6 text-center">
        <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Take at least one test to unlock insights.
        </p>
        <Link href="/tests" className="mt-2 inline-block text-sm font-semibold text-primary hover:underline">
          Browse tests →
        </Link>
      </div>
    );
  }

  if (compact) {
    // Minimal version — 2 weak category badges + 1 CTA
    return (
      <div className="space-y-2">
        {data.weakCategories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.weakCategories.map((cat) => (
              <div key={cat.category} className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                <span className="text-xs font-semibold text-red-700">{cat.label}</span>
                {cat.accuracy !== null && (
                  <span className="text-xs text-red-500">{cat.accuracy}% accuracy</span>
                )}
              </div>
            ))}
          </div>
        )}
        <Link href="/analytics" className="text-xs font-semibold text-primary hover:underline">
          View full breakdown →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Weak categories */}
      {data.weakCategories.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-foreground">Focus Areas</h3>
          </div>
          {data.weakCategories.map((cat) => (
            <div key={cat.category} className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-foreground">{cat.label}</span>
                <span className={cn("font-bold", (cat.accuracy ?? 0) < 60 ? "text-red-600" : "text-amber-600")}>
                  {cat.accuracy !== null ? `${cat.accuracy}% accuracy` : `${cat.avgScore}% avg`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full", (cat.accuracy ?? 0) < 50 ? "bg-red-500" : "bg-amber-500")}
                  style={{ width: `${cat.accuracy ?? cat.avgScore}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {cat.testsTaken} tests · {cat.correctCount}/{cat.questionsSeen} correct
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Weak topics */}
      {data.weakTopics.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-semibold text-foreground">Weak Topics</h3>
          </div>
          <div className="space-y-2">
            {data.weakTopics.slice(0, 4).map(({ tag, wrongCount, totalCount, accuracy }) => (
              <div key={tag} className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-foreground capitalize truncate">{tag}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", accuracy < 50 ? "bg-red-500" : "bg-amber-500")}
                      style={{ width: `${accuracy}%` }}
                    />
                  </div>
                  <span className={cn("text-xs font-bold w-8 text-right", accuracy < 50 ? "text-red-600" : "text-amber-600")}>
                    {accuracy}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended tests */}
      {data.recommendedTests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Recommended for You</h3>
          {data.recommendedTests.slice(0, 2).map((test) => (
            <Link
              key={test.id}
              href={`/tests/${test.id}`}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 hover:bg-muted/50 transition-colors group"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold capitalize", CATEGORY_COLORS[test.category])}>
                    {test.category}
                  </span>
                  <span className={cn("text-xs font-medium capitalize", DIFFICULTY_COLORS[test.difficulty])}>
                    {test.difficulty}
                  </span>
                </div>
                <p className="text-xs font-medium text-foreground truncate">{test.title}</p>
              </div>
              <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0 ml-2">
                <Clock className="h-3 w-3" />
                {test.durationMins}m
              </span>
            </Link>
          ))}
          <Link
            href="/analytics"
            className="block text-center text-xs font-semibold text-primary hover:underline pt-1"
          >
            See full analytics →
          </Link>
        </div>
      )}

      {/* Overall accuracy */}
      {data.overallAccuracy !== null && (
        <div className="rounded-lg bg-muted/50 px-4 py-3 text-center">
          <p className="text-xs text-muted-foreground">Overall accuracy</p>
          <p className={cn(
            "text-2xl font-bold mt-0.5",
            data.overallAccuracy >= 75 ? "text-green-600" :
            data.overallAccuracy >= 50 ? "text-amber-600" : "text-red-600"
          )}>
            {data.overallAccuracy}%
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            across {data.totalQuestionsAttempted} questions
          </p>
        </div>
      )}
    </div>
  );
}

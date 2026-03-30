// @ts-nocheck
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Clock, BookOpen, Target, ChevronRight, AlertCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const difficultyColors: Record<string, string> = {
  easy: "text-green-600 bg-green-50 border-green-200",
  medium: "text-amber-600 bg-amber-50 border-amber-200",
  hard: "text-red-600 bg-red-50 border-red-200",
};

export default async function TestDetailPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profile }, { data: test }, { count: questionCount }, { data: lastAttempt }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
    supabase
      .from("tests")
      .select("*")
      .eq("id", testId)
      .eq("is_published", true)
      .single(),
    supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("test_id", testId),
    supabase
      .from("test_attempts")
      .select("id, status, percentage, score, total_marks, started_at")
      .eq("user_id", user!.id)
      .eq("test_id", testId)
      .order("started_at", { ascending: false })
      .limit(1)
      .single(),
  ]);

  if (!test) notFound();

  const isAdmin = profile?.role === "admin";
  const hasActiveAttempt = lastAttempt?.status === "in_progress";
  const count = questionCount ?? 0;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/tests" className="hover:text-foreground">Tests</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{test.title}</span>
      </div>

      <div className="rounded-2xl border border-border bg-card p-8 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="rounded-full border px-3 py-1 text-xs font-semibold capitalize bg-muted">
              {test.category}
            </span>
            <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold capitalize", difficultyColors[test.difficulty])}>
              {test.difficulty}
            </span>
            {test.is_ai_generated && (
              <span className="flex items-center gap-1 text-xs text-primary font-medium">
                <Zap className="h-3 w-3" />
                AI Generated
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-foreground">{test.title}</h1>
          {test.description && (
            <p className="mt-2 text-sm text-muted-foreground">{test.description}</p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Clock, label: "Duration", value: `${test.duration_mins} mins` },
            { icon: BookOpen, label: "Questions", value: count },
            { icon: Target, label: "Passing", value: `${test.passing_marks}/${test.total_marks}` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl bg-muted/50 p-4 text-center">
              <Icon className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-base font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {/* Tags */}
        {test.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {test.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Instructions */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
            <AlertCircle className="h-4 w-4" />
            Before you begin
          </div>
          <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
            <li>You have {test.duration_mins} minutes once you start — the timer cannot be paused.</li>
            <li>Each correct MCQ answer earns 1 mark. Wrong answers deduct 0.25 marks.</li>
            <li>You can navigate between questions freely and review before submitting.</li>
            <li>The test auto-submits when the timer runs out.</li>
            <li>Stable internet is required — answers are auto-saved every 30 seconds.</li>
          </ul>
        </div>

        {/* Previous attempt */}
        {lastAttempt && lastAttempt.status === "submitted" && (
          <div className="rounded-xl bg-muted/50 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Previous attempt</p>
              <p className="text-xs text-muted-foreground">
                {lastAttempt.score}/{lastAttempt.total_marks} marks · {lastAttempt.percentage?.toFixed(1)}%
              </p>
            </div>
            <Link
              href={`/tests/${testId}/results?attemptId=${lastAttempt.id}`}
              className="text-xs font-semibold text-primary hover:underline"
            >
              View results
            </Link>
          </div>
        )}

        {/* CTA */}
        {isAdmin ? (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-slate-500 flex-shrink-0" />
            <p className="text-sm text-slate-700">Admins can preview tests but cannot take them. Switch to a student account to attempt.</p>
          </div>
        ) : count === 0 ? (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">This test has no questions yet. Contact your admin.</p>
            </div>
            <div className="block w-full rounded-xl bg-muted py-3.5 text-center text-sm font-bold text-muted-foreground cursor-not-allowed opacity-60">
              {hasActiveAttempt ? "Resume active attempt" : "Start test"}
            </div>
          </>
        ) : hasActiveAttempt ? (
          <Link
            href={`/tests/${testId}/attempt`}
            className="block w-full rounded-xl bg-amber-500 py-3.5 text-center text-sm font-bold text-white hover:bg-amber-600 transition-colors"
          >
            Resume active attempt
          </Link>
        ) : (
          <Link
            href={`/tests/${testId}/attempt`}
            className="block w-full rounded-xl bg-primary py-3.5 text-center text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Start test
          </Link>
        )}
      </div>
    </div>
  );
}

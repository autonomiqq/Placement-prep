// @ts-nocheck
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/supabase/server";
import { formatPercentage, formatDuration } from "@/lib/utils/formatters";
import { CheckCircle, XCircle, MinusCircle, Trophy, RotateCcw, Home, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import ExplainButton from "@/components/tests/ExplainButton";

interface SearchParams {
  attemptId?: string;
}

export const dynamic = "force-dynamic";
export const metadata = { title: "Test Results" };

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ testId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { testId } = await params;
  const { attemptId } = await searchParams;

  if (!attemptId) notFound();

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: attempt } = await supabase
    .from("test_attempts")
    .select("*, tests(title, category, passing_marks)")
    .eq("id", attemptId)
    .eq("user_id", user!.id)
    .single();

  if (!attempt) notFound();

  const serviceClient = await getSupabaseServiceClient();
  const [{ data: answers }, { data: questions }] = await Promise.all([
    supabase
      .from("answers")
      .select("question_id, selected_option, is_correct, marks_awarded, is_skipped")
      .eq("attempt_id", attemptId),
    serviceClient
      .from("questions")
      .select("id, question_number, content, explanation, mcq_options(*)")
      .eq("test_id", testId)
      .order("question_number", { ascending: true }),
  ]);

  const test = attempt.tests as { title: string; category: string; passing_marks: number } | null;
  const passed = (attempt.percentage ?? 0) >= ((test?.passing_marks ?? 0) / (attempt.total_marks ?? 1)) * 100;
  const answersMap = Object.fromEntries((answers ?? []).map((a) => [a.question_id, a]));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/tests" className="hover:text-foreground">Tests</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/tests/${testId}`} className="hover:text-foreground">{test?.title}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">Results</span>
      </div>

      {/* Score card */}
      <div className={cn(
        "rounded-2xl p-8 text-center",
        passed ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
      )}>
        <div className="mb-4">
          {passed ? (
            <Trophy className="h-16 w-16 mx-auto text-yellow-500" />
          ) : (
            <div className="h-16 w-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-10 w-10 text-red-500" />
            </div>
          )}
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-1">
          {formatPercentage(attempt.percentage ?? 0)}
        </h1>
        <p className={cn("text-lg font-semibold mb-4", passed ? "text-green-700" : "text-red-700")}>
          {passed ? "Passed!" : "Not passed"}
        </p>
        <div className="flex items-center justify-center gap-8 text-sm">
          <div>
            <p className="text-muted-foreground">Score</p>
            <p className="font-bold text-foreground">{attempt.score}/{attempt.total_marks}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Correct</p>
            <p className="font-bold text-green-600">
              {(answers ?? []).filter((a) => a.is_correct).length}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Wrong</p>
            <p className="font-bold text-red-600">
              {(answers ?? []).filter((a) => !a.is_correct && !a.is_skipped).length}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Time</p>
            <p className="font-bold text-foreground">{formatDuration(attempt.time_taken_secs ?? 0)}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href={`/tests/${testId}`}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Retake test
        </Link>
        <Link
          href="/dashboard"
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Home className="h-4 w-4" />
          Dashboard
        </Link>
      </div>

      {/* Question review */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-4">Question Review</h2>
        <div className="space-y-4">
          {(questions ?? []).map((q) => {
            const answer = answersMap[q.id];
            const isCorrect = answer?.is_correct;
            const isSkipped = answer?.is_skipped || !answer;
            const options = (q as any).mcq_options as Array<{
              option_key: string;
              content: string;
              is_correct: boolean;
            }>;
            const correctOption = options?.find((o) => o.is_correct);

            return (
              <div
                key={q.id}
                className={cn(
                  "rounded-xl border p-5 space-y-3",
                  isCorrect && "border-green-200 bg-green-50/50",
                  !isCorrect && !isSkipped && "border-red-200 bg-red-50/50",
                  isSkipped && "border-border bg-muted/30"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    {isCorrect ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : isSkipped ? (
                      <MinusCircle className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Q{q.question_number}</p>
                    <p className="text-sm font-medium text-foreground">{q.content}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn(
                      "text-sm font-bold",
                      isCorrect ? "text-green-600" : "text-red-600"
                    )}>
                      {isSkipped ? "0" : `${isCorrect ? "+" : ""}${answer?.marks_awarded?.toFixed(2) ?? "0"}`} pts
                    </p>
                  </div>
                </div>

                {options && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-8">
                    {options.map((opt) => {
                      const isSelected = answer?.selected_option === opt.option_key;
                      const isCorrectOpt = opt.is_correct;
                      return (
                        <div
                          key={opt.option_key}
                          className={cn(
                            "rounded-lg border px-3 py-2 text-xs flex items-center gap-2",
                            isCorrectOpt && "border-green-300 bg-green-100 text-green-700 font-medium",
                            isSelected && !isCorrectOpt && "border-red-300 bg-red-100 text-red-700",
                            !isSelected && !isCorrectOpt && "border-border text-muted-foreground"
                          )}
                        >
                          <span className="font-bold">{opt.option_key}.</span>
                          {opt.content}
                        </div>
                      );
                    })}
                  </div>
                )}

                {q.explanation && (
                  <div className="ml-8 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
                    <span className="font-semibold">Explanation: </span>
                    {q.explanation}
                  </div>
                )}

                {!isSkipped && !isCorrect && (
                  <div className="ml-8">
                    <ExplainButton
                      questionId={q.id}
                      selectedOption={answer?.selected_option ?? null}
                      attemptId={attemptId}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

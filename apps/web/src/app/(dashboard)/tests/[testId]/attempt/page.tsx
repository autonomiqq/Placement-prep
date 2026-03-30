// @ts-nocheck
"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTestSessionStore } from "@/stores/testSessionStore";
import { useTimer } from "@/hooks/useTimer";
import { formatTimer } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils/cn";
import { Flag, ChevronLeft, ChevronRight, Send, Loader2, AlertCircle } from "lucide-react";
import type { Question } from "@/types/test";

export default function AttemptPage() {
  const { testId } = useParams<{ testId: string }>();
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const {
    status,
    test,
    questions,
    answers,
    flagged,
    currentIndex,
    attemptId,
    startSession,
    answerQuestion,
    toggleFlag,
    navigateTo,
    setSubmitting,
    completeSession,
    resumeSession,
    resetSession,
  } = useTestSessionStore();

  const submitTest = useCallback(async () => {
    if (!attemptId || status === "submitting") return;
    setSubmitError(null);
    setSubmitting();
    try {
      const res = await fetch(`/api/tests/${testId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, answers }),
      });
      const data = await res.json();
      if (res.ok) {
        completeSession(data.result);
        router.push(`/tests/${testId}/results?attemptId=${attemptId}`);
      } else {
        setSubmitError(data.error ?? "Submission failed. Please try again.");
        setRetrying(true);
        resumeSession();
      }
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
      setRetrying(true);
      resumeSession();
    }
  }, [attemptId, answers, testId, status, setSubmitting, completeSession, resumeSession, router]);

  const { timeRemaining, urgency } = useTimer({
    onExpire: submitTest,
    onWarning: (secs) => {
      if (secs === 300 && typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("5 minutes remaining!", { body: "Start wrapping up your test." });
      }
    },
  });

  // Initialize session on mount
  useEffect(() => {
    if (status !== "idle") return;

    const init = async () => {
      const res = await fetch(`/api/tests/${testId}/attempt`, { method: "POST" });
      if (!res.ok) {
        router.push(`/tests/${testId}`);
        return;
      }
      const data = await res.json();
      if (!data.questions || data.questions.length === 0) {
        router.push(`/tests/${testId}`);
        return;
      }
      const secondsRemaining = Math.max(
        0,
        Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000)
      );
      if (secondsRemaining === 0) {
        router.push(`/tests/${testId}`);
        return;
      }
      startSession(data.test, data.questions, data.attemptId, data.expiresAt);
    };

    init();
  }, [testId, status, startSession, router]);

  // Flush buffered answers to DB every 30 seconds — 1 request total, not N per question
  useEffect(() => {
    if (status !== "active" || !attemptId) return;
    const interval = setInterval(() => {
      fetch(`/api/tests/${testId}/answers/flush`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId }),
      }).catch(() => {/* non-fatal */});
    }, 30_000);
    return () => clearInterval(interval);
  }, [status, attemptId, testId]);

  const progressAnswered = useTestSessionStore((s) => Object.values(s.answers).filter((v) => v !== null).length);
  const progressFlagged = useTestSessionStore((s) => s.flagged.size);
  const progressTotal = useTestSessionStore((s) => s.questions.length);
  const currentQuestion = questions[currentIndex] as Question | undefined;

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading test...</p>
        </div>
      </div>
    );
  }

  if (submitError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center max-w-sm mx-auto">
          <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">Submission Failed</h2>
          <p className="text-sm text-muted-foreground mb-6">{submitError}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setSubmitError(null); setRetrying(false); }}
              className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Continue test
            </button>
            <button
              onClick={() => { setSubmitError(null); setRetrying(false); submitTest(); }}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Retry submission
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "submitting") {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Submitting and scoring your test...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 max-w-6xl mx-auto">
      {/* Question panel */}
      <div className="flex-1 flex flex-col overflow-hidden rounded-xl border border-border bg-card">
        {/* Timer bar */}
        <div
          className={cn(
            "flex items-center justify-between px-6 py-3 border-b border-border",
            urgency === "critical" && "bg-red-50 border-red-200",
            urgency === "warning" && "bg-amber-50 border-amber-200"
          )}
        >
          <div>
            <p className="text-sm font-medium text-foreground">{test?.title}</p>
            <p className="text-xs text-muted-foreground">
              Q{currentIndex + 1} of {questions.length}
            </p>
          </div>
          <div
            className={cn(
              "text-2xl font-mono font-bold",
              urgency === "critical" && "text-red-600 animate-pulse",
              urgency === "warning" && "text-amber-600",
              urgency === "normal" && "text-foreground"
            )}
          >
            {formatTimer(timeRemaining)}
          </div>
        </div>

        {/* Question content */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentQuestion && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      Q{currentQuestion.questionNumber}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {currentQuestion.difficulty} · {currentQuestion.marks} mark
                      {currentQuestion.marks !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-base font-medium text-foreground leading-relaxed">
                    {currentQuestion.content}
                  </p>
                </div>
                <button
                  onClick={() => toggleFlag(currentQuestion.id)}
                  className={cn(
                    "rounded-lg border p-2 transition-colors shrink-0",
                    flagged.has(currentQuestion.id)
                      ? "bg-amber-100 border-amber-300 text-amber-600"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                  title="Flag for review"
                >
                  <Flag className="h-4 w-4" />
                </button>
              </div>

              {/* MCQ Options */}
              {currentQuestion.type === "mcq" && currentQuestion.options && (
                <div className="space-y-3">
                  {currentQuestion.options.map((opt) => {
                    const isSelected = answers[currentQuestion.id] === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() =>
                          answerQuestion(
                            currentQuestion.id,
                            isSelected ? null : opt.key
                          )
                        }
                        className={cn(
                          "w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-all",
                          isSelected
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border hover:border-primary/30 hover:bg-muted/50"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-muted-foreground"
                          )}
                        >
                          {opt.key}
                        </span>
                        <span className="text-sm">{opt.content}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="border-t border-border px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigateTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          {currentIndex === questions.length - 1 ? (
            <button
              onClick={submitTest}
              disabled={status === "submitting"}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              <Send className="h-4 w-4" />
              Submit test
            </button>
          ) : (
            <button
              onClick={() => navigateTo(currentIndex + 1)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sidebar: Question palette */}
      <div className="hidden lg:flex w-56 flex-col gap-4">
        {/* Progress */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Progress</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Answered</span>
              <span className="font-semibold text-green-600">
                {progressAnswered}/{progressTotal}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Flagged</span>
              <span className="font-semibold text-amber-600">{progressFlagged}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Skipped</span>
              <span className="font-semibold text-muted-foreground">{progressTotal - progressAnswered}</span>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressTotal > 0 ? (progressAnswered / progressTotal) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Question palette */}
        <div className="rounded-xl border border-border bg-card p-4 flex-1 overflow-y-auto">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">Questions</p>
          <div className="grid grid-cols-5 gap-1.5">
            {questions.map((q, i) => {
              const isAnswered = answers[q.id] != null;
              const isFlagged = flagged.has(q.id);
              const isCurrent = i === currentIndex;
              return (
                <button
                  key={q.id}
                  onClick={() => navigateTo(i)}
                  className={cn(
                    "flex items-center justify-center rounded-lg h-8 w-8 text-xs font-bold transition-all border",
                    isCurrent && "border-primary bg-primary text-primary-foreground",
                    !isCurrent && isAnswered && "border-green-300 bg-green-50 text-green-700",
                    !isCurrent && isFlagged && !isAnswered && "border-amber-300 bg-amber-50 text-amber-700",
                    !isCurrent && !isAnswered && !isFlagged && "border-border text-muted-foreground hover:bg-muted"
                  )}
                  title={`Q${i + 1}${isFlagged ? " (flagged)" : ""}${isAnswered ? " (answered)" : ""}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
            {[
              { color: "bg-primary rounded", label: "Current" },
              { color: "bg-green-50 border border-green-300 rounded", label: "Answered" },
              { color: "bg-amber-50 border border-amber-300 rounded", label: "Flagged" },
              { color: "bg-muted border border-border rounded", label: "Not visited" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`h-3.5 w-3.5 ${color}`} />
                {label}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={submitTest}
          className="rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Submit test
        </button>
      </div>
    </div>
  );
}

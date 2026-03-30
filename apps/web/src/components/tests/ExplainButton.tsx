"use client";

import { useState } from "react";
import { Brain, ChevronDown, Loader2 } from "lucide-react";

export default function ExplainButton({
  questionId,
  selectedOption,
  attemptId,
}: {
  questionId: string;
  selectedOption: string | null;
  attemptId: string;
}) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchExplanation = async () => {
    if (explanation) {
      setOpen((v) => !v);
      return;
    }
    setLoading(true);
    setOpen(true);
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, selectedOption, attemptId }),
      });
      const data = await res.json();
      setExplanation(data.explanation ?? "Could not generate explanation.");
    } catch {
      setExplanation("Failed to load AI explanation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={fetchExplanation}
        className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
      >
        <Brain className="h-3.5 w-3.5" />
        {loading ? "Getting AI explanation..." : explanation && open ? "Hide explanation" : "Get AI explanation"}
        {explanation && !loading && (
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
        {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      </button>

      {open && (
        <div className="mt-2 rounded-lg bg-purple-50 border border-purple-200 px-3 py-2.5 text-xs text-purple-800 leading-relaxed">
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Generating explanation...
            </div>
          ) : (
            explanation
          )}
        </div>
      )}
    </div>
  );
}

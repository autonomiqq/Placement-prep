"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Trash2, Loader2, Sparkles, CheckCircle } from "lucide-react";

interface Question { id: string; question_number: number; content: string; type: string; difficulty: string; marks: number; }
interface Test { id: string; title: string; category: string; difficulty: string; is_published: boolean; total_marks: number; }

export default function TestManagerClient({
  test, questions, attemptCount, avgScore,
}: {
  test: Test;
  questions: Question[];
  attemptCount: number;
  avgScore: string | null;
}) {
  const router = useRouter();
  const [published, setPublished] = useState(test.is_published);
  const [pubLoading, setPubLoading] = useState(false);
  const [genTopic, setGenTopic] = useState("");
  const [genCount, setGenCount] = useState("10");
  const [genType, setGenType] = useState<"mcq" | "coding">("mcq");
  const [genLoading, setGenLoading] = useState(false);
  const [genMsg, setGenMsg] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTestLoading, setDeleteTestLoading] = useState(false);
  const [deleteTestError, setDeleteTestError] = useState("");

  async function togglePublish() {
    setPubLoading(true);
    const res = await fetch(`/api/admin/tests/${test.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_published: !published }),
    });
    if (res.ok) { setPublished(!published); router.refresh(); }
    setPubLoading(false);
  }

  async function generateQuestions() {
    if (!genTopic.trim()) return;
    setGenLoading(true);
    setGenMsg("");
    const res = await fetch("/api/ai/generate-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        testId: test.id, topic: genTopic, category: test.category,
        difficulty: test.difficulty, count: parseInt(genCount), type: genType,
      }),
    });
    const data = await res.json();
    if (res.ok) { setGenMsg(`✓ Added ${data.created} questions`); setGenTopic(""); router.refresh(); }
    else setGenMsg(`Error: ${data.error}`);
    setGenLoading(false);
  }

  async function deleteTest() {
    if (published) {
      setDeleteTestError("Unpublish the test before deleting it.");
      return;
    }
    if (!confirm("Delete this test and all its questions? This cannot be undone.")) return;
    setDeleteTestLoading(true);
    setDeleteTestError("");
    const res = await fetch(`/api/admin/tests/${test.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/tests");
    } else {
      const data = await res.json();
      setDeleteTestError(data.error ?? "Failed to delete test.");
    }
    setDeleteTestLoading(false);
  }

  async function deleteQuestion(qId: string) {
    setDeleting(qId);
    await fetch(`/api/admin/tests/${test.id}/questions/${qId}`, { method: "DELETE" });
    router.refresh();
    setDeleting(null);
  }

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Questions", value: questions.length },
          { label: "Attempts", value: attemptCount },
          { label: "Avg Score", value: avgScore ? `${avgScore}%` : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-white p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Publish toggle */}
      <div className="rounded-xl border border-border bg-white p-5 flex items-center justify-between">
        <div>
          <p className="font-medium text-foreground">Test Status</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {published ? "Students can see and attempt this test." : "Test is in draft mode — not visible to students."}
          </p>
        </div>
        <button onClick={togglePublish} disabled={pubLoading}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            published
              ? "bg-muted text-muted-foreground hover:bg-muted/80"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}>
          {pubLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {published ? "Unpublish" : "Publish Test"}
        </button>
      </div>

      {/* AI Question Generator */}
      <div className="rounded-xl border border-border bg-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Add Questions with AI</h2>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-foreground block mb-1">Topic</label>
            <input value={genTopic} onChange={(e) => setGenTopic(e.target.value)}
              placeholder={`e.g. "Data Structures — Trees"`}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Type</label>
            <select value={genType} onChange={(e) => setGenType(e.target.value as "mcq" | "coding")}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option value="mcq">MCQ</option>
              <option value="coding">Coding</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Count</label>
            <input type="number" min="1" max="20" value={genCount} onChange={(e) => setGenCount(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>
        {genMsg && (
          <p className={`text-sm font-medium flex items-center gap-1 ${genMsg.startsWith("✓") ? "text-green-700" : "text-destructive"}`}>
            {genMsg.startsWith("✓") && <CheckCircle className="h-4 w-4" />}{genMsg}
          </p>
        )}
        <button onClick={generateQuestions} disabled={genLoading || !genTopic.trim()}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {genLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4" /> Generate Questions</>}
        </button>
      </div>

      {/* Question list */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Questions ({questions.length})</h2>
        </div>
        {questions.length > 0 ? (
          <div className="divide-y divide-border">
            {questions.map((q) => (
              <div key={q.id} className="px-5 py-4 flex items-start gap-4 hover:bg-muted/20">
                <span className="text-sm font-mono text-muted-foreground w-6 flex-shrink-0">{q.question_number}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground line-clamp-2">{q.content}</p>
                  <div className="flex gap-2 mt-1.5">
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded capitalize">{q.type}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded capitalize">{q.difficulty}</span>
                    <span className="text-xs text-muted-foreground">{q.marks} mark{q.marks !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <button onClick={() => deleteQuestion(q.id)} disabled={deleting === q.id}
                  className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 p-1">
                  {deleting === q.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No questions yet. Use AI to generate some above.
          </div>
        )}
      </div>
      {/* Danger Zone */}
      <div className="rounded-xl border border-destructive/30 bg-white p-5 flex items-center justify-between">
        <div>
          <p className="font-medium text-foreground">Delete Test</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {published
              ? "Unpublish the test before it can be deleted."
              : "Permanently delete this test and all its questions."}
          </p>
          {deleteTestError && (
            <p className="text-sm text-destructive mt-1">{deleteTestError}</p>
          )}
        </div>
        <button
          onClick={deleteTest}
          disabled={deleteTestLoading || published}
          className="flex items-center gap-2 rounded-lg border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive hover:text-white transition-colors disabled:opacity-40"
        >
          {deleteTestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Delete Test
        </button>
      </div>
    </div>
  );
}

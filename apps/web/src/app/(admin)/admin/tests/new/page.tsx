"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Sparkles, CheckCircle2, XCircle, Database, Zap } from "lucide-react";

const CATEGORIES = ["aptitude", "verbal", "technical", "coding"] as const;
const DIFFICULTIES = ["easy", "medium", "hard"] as const;

interface GenState {
  done: number;
  total: number;
  created: number;
  log: string[];
}

type QuestionMode = "bank" | "live";

export default function NewTestPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "", description: "", category: "aptitude" as typeof CATEGORIES[number],
    difficulty: "medium" as typeof DIFFICULTIES[number],
    duration_mins: "30", total_marks: "10", passing_marks: "6",
  });
  const [genTopic, setGenTopic] = useState("");
  const [genCount, setGenCount] = useState("10");
  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [createdTestId, setCreatedTestId] = useState<string | null>(null);
  const [genState, setGenState] = useState<GenState | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [genDone, setGenDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<QuestionMode>("bank");
  const [bankAvailable, setBankAvailable] = useState<number | null>(null);
  const [bankTopics, setBankTopics] = useState<{ topic: string; count: number }[]>([]);
  const [selectedTopic, setSelectedTopic] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function createTest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          duration_mins: parseInt(form.duration_mins),
          total_marks: parseInt(form.total_marks),
          passing_marks: parseInt(form.passing_marks),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create test"); return; }
      setCreatedTestId(data.test.id);
      // Check bank availability for selected category/difficulty
      checkBankAvailability(form.category, form.difficulty);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function checkBankAvailability(category: string, difficulty: string) {
    try {
      const res = await fetch(`/api/admin/question-bank?category=${category}&difficulty=${difficulty}&limit=1`);
      const data = await res.json();
      const count = data.stats?.[`${category}__${difficulty}`] ?? 0;
      setBankAvailable(count);
      if (count === 0) setMode("live");

      // Derive topic list from topicStats
      const prefix = `${category}__${difficulty}__`;
      const topics = Object.entries(data.topicStats ?? {})
        .filter(([k]) => k.startsWith(prefix))
        .map(([k, c]) => ({ topic: k.slice(prefix.length), count: c as number }))
        .sort((a, b) => b.count - a.count);
      setBankTopics(topics);
      setSelectedTopic("");
    } catch {
      setBankAvailable(0);
      setMode("live");
      setBankTopics([]);
    }
  }

  async function pullFromBank() {
    if (!createdTestId) return;
    const count = parseInt(genCount);
    setGenLoading(true);
    setGenError(null);
    setGenDone(false);
    setGenState({ done: count, total: count, created: 0, log: ["Pulling questions from bank..."] });

    try {
      const res = await fetch("/api/admin/question-bank/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: createdTestId,
          category: form.category,
          difficulty: form.difficulty,
          count,
          ...(selectedTopic ? { topic: selectedTopic } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenError(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
        setGenState(null);
        return;
      }
      setGenState({ done: count, total: count, created: data.inserted, log: [`Done! ${data.inserted} questions pulled from bank instantly.`] });
      setGenDone(true);
    } catch {
      setGenError("Network failure — please try again");
      setGenState(null);
    } finally {
      setGenLoading(false);
    }
  }

  async function generateQuestions() {
    if (!createdTestId || !genTopic.trim()) return;
    const total = parseInt(genCount);
    setGenLoading(true);
    setGenError(null);
    setGenDone(false);
    setGenState({ done: 0, total, created: 0, log: [`Starting AI generation for ${total} questions...`] });

    try {
      const res = await fetch("/api/ai/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: createdTestId,
          topic: genTopic,
          category: form.category,
          difficulty: form.difficulty,
          count: total,
          type: "mcq",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setGenError(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
        setGenState(null);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "progress") {
              setGenState((prev) => ({
                done: evt.done, total: evt.total, created: evt.created,
                log: [...(prev?.log ?? []), `Batch complete — ${evt.created} of ${evt.total} questions saved`],
              }));
            } else if (evt.type === "done") {
              setGenState((prev) => ({
                done: evt.total ?? total, total: evt.total ?? total, created: evt.created,
                log: [...(prev?.log ?? []), `Done! ${evt.created} questions added to test.`],
              }));
              setGenDone(true);
            } else if (evt.type === "error") {
              setGenError(evt.message);
              setGenState((prev) => prev ? { ...prev, log: [...prev.log, `Error: ${evt.message}`] } : null);
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch {
      setGenError("Network failure — please try again");
      setGenState(null);
    } finally {
      setGenLoading(false);
    }
  }

  async function publishAndFinish() {
    if (!createdTestId) return;
    await fetch(`/api/admin/tests/${createdTestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_published: true }),
    });
    router.push("/admin/tests");
  }

  const progressPct = genState ? Math.round((genState.done / genState.total) * 100) : 0;
  const effectiveAvailable = selectedTopic
    ? (bankTopics.find((t) => t.topic === selectedTopic)?.count ?? 0)
    : (bankAvailable ?? 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/tests" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create Test</h1>
          <p className="text-sm text-muted-foreground">Set up a new placement test</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!createdTestId ? (
        <form onSubmit={createTest} className="rounded-xl border border-border bg-white p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Test Title *</label>
            <input required value={form.title} onChange={(e) => set("title", e.target.value)}
              placeholder="TCS Aptitude Test - Percentages"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
              rows={2} placeholder="What this test covers..."
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Category *</label>
              <select value={form.category} onChange={(e) => set("category", e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Difficulty *</label>
              <select value={form.difficulty} onChange={(e) => set("difficulty", e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Duration (mins) *</label>
              <input type="number" required min="5" max="180" value={form.duration_mins} onChange={(e) => set("duration_mins", e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Total Marks *</label>
              <input type="number" required min="1" value={form.total_marks} onChange={(e) => set("total_marks", e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Passing Marks *</label>
              <input type="number" required min="1" value={form.passing_marks} onChange={(e) => set("passing_marks", e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Test →
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">✓ Test created! Now add questions.</p>
          </div>

          {/* Mode tabs */}
          <div className="rounded-xl border border-border bg-white overflow-hidden">
            <div className="flex border-b border-border">
              <button
                onClick={() => setMode("bank")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                  mode === "bank"
                    ? "bg-primary/5 text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}>
                <Database className="h-4 w-4" />
                Pull from Bank
                {bankAvailable !== null && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    bankAvailable > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {bankAvailable} available
                  </span>
                )}
              </button>
              <button
                onClick={() => setMode("live")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                  mode === "live"
                    ? "bg-primary/5 text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}>
                <Sparkles className="h-4 w-4" />
                Generate with AI
              </button>
            </div>

            <div className="p-6 space-y-4">
              {mode === "bank" ? (
                <>
                  <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
                    <Zap className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-green-800">
                      <strong>Instant!</strong> Pulls pre-generated questions from the bank — no AI wait time.
                      {bankAvailable === 0 && (
                        <span className="block mt-1 text-amber-700">
                          No questions in bank for <strong>{form.category}/{form.difficulty}</strong> yet.
                          Go to <Link href="/admin/question-bank" className="underline">Question Bank</Link> to generate some first,
                          or use the AI tab.
                        </span>
                      )}
                    </p>
                  </div>

                  {bankTopics.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        Topic <span className="text-muted-foreground font-normal">(optional — leave blank for mixed topics)</span>
                      </label>
                      <select
                        value={selectedTopic}
                        onChange={(e) => setSelectedTopic(e.target.value)}
                        disabled={genLoading}
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                      >
                        <option value="">All topics ({bankAvailable} questions)</option>
                        {bankTopics.map(({ topic, count: tCount }) => (
                          <option key={topic} value={topic}>{topic} ({tCount} questions)</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">How many questions to pull</label>
                    <input type="number" min="1" max="200" value={genCount}
                      disabled={genLoading}
                      onChange={(e) => setGenCount(e.target.value)}
                      className="w-32 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50" />
                    {effectiveAvailable > 0 && parseInt(genCount) > effectiveAvailable && (
                      <p className="text-xs text-amber-600 mt-1">
                        Only {effectiveAvailable} available{selectedTopic ? ` for "${selectedTopic}"` : ""} — will pull all of them.
                      </p>
                    )}
                  </div>

                  {genState && (
                    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-blue-700">
                          {genDone ? "Complete" : "Pulling from bank..."}
                        </span>
                        <span className="text-xs font-bold text-blue-700">{genState.created} questions added</span>
                      </div>
                      {genState.log.map((entry, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-blue-800">
                          {genDone
                            ? <CheckCircle2 className="h-3 w-3 text-blue-600 flex-shrink-0" />
                            : <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />}
                          {entry}
                        </div>
                      ))}
                    </div>
                  )}

                  {genDone && genState && (
                    <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <p className="text-sm font-medium text-green-800">
                        {genState.created} questions added instantly from bank!
                      </p>
                    </div>
                  )}

                  {genError && (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3">
                      <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                      <p className="text-sm text-destructive">{genError}</p>
                    </div>
                  )}

                  <button onClick={pullFromBank} disabled={genLoading || effectiveAvailable === 0}
                    className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors">
                    {genLoading
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Pulling...</>
                      : <><Database className="h-4 w-4" /> {genDone ? "Pull More" : "Pull Questions"}</>}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Generate questions live with AI. Each batch of 5 takes ~20 seconds. For large batches, consider using the
                    Question Bank instead.
                  </p>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-foreground mb-1">Topic *</label>
                      <input value={genTopic} onChange={(e) => setGenTopic(e.target.value)}
                        disabled={genLoading}
                        placeholder={`e.g. "Percentages and Profit/Loss"`}
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Count</label>
                      <input type="number" min="1" max="50" value={genCount}
                        disabled={genLoading}
                        onChange={(e) => setGenCount(e.target.value)}
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50" />
                    </div>
                  </div>

                  {genState && (
                    <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-3">
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-xs font-semibold text-blue-700">
                            {genDone ? "Generation complete" : "Generating questions..."}
                          </span>
                          <span className="text-xs font-bold text-blue-700">
                            {genState.created} / {genState.total} saved
                          </span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2.5">
                          <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                            style={{ width: `${genDone ? 100 : progressPct}%` }} />
                        </div>
                        <p className="text-xs text-blue-600 mt-1">
                          {genDone ? "All done!" : `${progressPct}% complete — please wait`}
                        </p>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {genState.log.map((entry, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-xs text-blue-800">
                            {i === genState.log.length - 1 && !genDone
                              ? <Loader2 className="h-3 w-3 animate-spin mt-0.5 flex-shrink-0" />
                              : <CheckCircle2 className="h-3 w-3 mt-0.5 flex-shrink-0 text-blue-600" />}
                            {entry}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {genDone && genState && (
                    <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <p className="text-sm font-medium text-green-800">
                        {genState.created} questions generated successfully!
                      </p>
                    </div>
                  )}

                  {genError && (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3">
                      <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                      <p className="text-sm text-destructive">{genError}</p>
                    </div>
                  )}

                  <button onClick={generateQuestions} disabled={genLoading || !genTopic.trim()}
                    className="flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-50 transition-colors">
                    {genLoading
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                      : <><Sparkles className="h-4 w-4" /> {genDone ? "Generate More" : "Generate"}</>}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={publishAndFinish}
              className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors">
              Publish & Finish
            </button>
            <button onClick={() => router.push(`/admin/tests/${createdTestId}`)}
              className="rounded-lg border border-border px-5 py-2 text-sm font-medium hover:bg-muted transition-colors">
              Save as Draft & Manage →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

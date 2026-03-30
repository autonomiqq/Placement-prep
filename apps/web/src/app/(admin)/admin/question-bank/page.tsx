"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Sparkles, CheckCircle2, XCircle, Database, RefreshCw, ChevronDown, PauseCircle, PlayCircle, RotateCcw } from "lucide-react";

const CATEGORIES = ["aptitude", "verbal", "technical", "coding"] as const;
const DIFFICULTIES = ["easy", "medium", "hard"] as const;

type Category = typeof CATEGORIES[number];
type Difficulty = typeof DIFFICULTIES[number];

interface GenState {
  done: number;
  total: number;
  created: number;
  log: string[];
  status: "running" | "paused" | "done" | "error";
}

function statKey(cat: Category, diff: Difficulty) {
  return `${cat}__${diff}`;
}

function getTopicsForKey(key: string, topicStats: Record<string, number>) {
  const prefix = `${key}__`;
  return Object.entries(topicStats)
    .filter(([k]) => k.startsWith(prefix))
    .map(([k, count]) => ({ topic: k.slice(prefix.length), count }))
    .sort((a, b) => b.count - a.count);
}

const CATEGORY_ACCENT: Record<Category, string> = {
  aptitude:  "border-l-blue-400",
  verbal:    "border-l-purple-400",
  technical: "border-l-orange-400",
  coding:    "border-l-green-400",
};

const DIFF_COLOR: Record<Difficulty, string> = {
  easy:   "text-green-600",
  medium: "text-amber-600",
  hard:   "text-red-600",
};

const JOB_STORAGE_KEY = "qbank:activeJobId";

export default function QuestionBankPage() {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [topicStats, setTopicStats] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Generate form
  const [genCategory, setGenCategory] = useState<Category>("aptitude");
  const [genDifficulty, setGenDifficulty] = useState<Difficulty>("medium");
  const [genTopic, setGenTopic] = useState("");
  const [genCount, setGenCount] = useState("100");
  const [genLoading, setGenLoading] = useState(false);
  const [genState, setGenState] = useState<GenState | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [genDone, setGenDone] = useState(false);
  const [genPausing, setGenPausing] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/admin/question-bank");
      const data = await res.json();
      const s = data.stats ?? {};
      setStats(s);
      setTopicStats(data.topicStats ?? {});
      setTotal(Object.values(s).reduce((a: number, b) => a + (b as number), 0));
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // On mount: restore job state from localStorage (one poll to get real status)
  useEffect(() => {
    const savedJobId = localStorage.getItem(JOB_STORAGE_KEY);
    if (!savedJobId) return;
    setActiveJobId(savedJobId);
    fetch(`/api/admin/question-bank/generate?jobId=${savedJobId}`)
      .then((r) => r.json())
      .then((job) => {
        if (!job || job.error) { localStorage.removeItem(JOB_STORAGE_KEY); return; }
        setGenState({ done: job.done, total: job.total, created: job.created, log: job.log ?? [], status: job.status });
        if (job.status === "running") {
          setGenLoading(true);
        } else if (job.status === "done") {
          setGenDone(true);
          localStorage.removeItem(JOB_STORAGE_KEY);
        } else if (job.status === "error") {
          setGenError(job.error ?? "Generation failed.");
        }
        // "paused" — show state, genLoading stays false
      })
      .catch(() => localStorage.removeItem(JOB_STORAGE_KEY));
  }, []);

  // Poll for job progress every 3 seconds
  useEffect(() => {
    if (!activeJobId || !genLoading) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/admin/question-bank/generate?jobId=${activeJobId}`);
        if (!res.ok) {
          setGenLoading(false);
          setGenError("Could not retrieve job status.");
          localStorage.removeItem(JOB_STORAGE_KEY);
          return;
        }
        const job = await res.json();
        setGenState({ done: job.done, total: job.total, created: job.created, log: job.log ?? [], status: job.status });

        if (job.status === "done") {
          setGenDone(true);
          setGenLoading(false);
          setGenPausing(false);
          localStorage.removeItem(JOB_STORAGE_KEY);
          fetchStats();
        } else if (job.status === "error") {
          setGenError(job.error ?? "Generation failed.");
          setGenLoading(false);
          setGenPausing(false);
        } else if (job.status === "paused") {
          setGenLoading(false);
          setGenPausing(false);
          // Keep activeJobId and localStorage for resume
        }
      } catch {
        // Network hiccup — keep polling
      }
    };

    poll(); // immediate first poll
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [activeJobId, genLoading, fetchStats]);

  async function startGeneration() {
    if (!genTopic.trim()) return;
    setGenLoading(true);
    setGenError(null);
    setGenDone(false);
    setGenPausing(false);
    setGenState({ done: 0, total: parseInt(genCount), created: 0, log: [`Starting bulk generation of ${genCount} questions...`], status: "running" });

    try {
      const res = await fetch("/api/admin/question-bank/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: genTopic,
          category: genCategory,
          difficulty: genDifficulty,
          count: parseInt(genCount),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setGenError(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
        setGenState(null);
        setGenLoading(false);
        return;
      }

      const { jobId } = await res.json();
      setActiveJobId(jobId);
      localStorage.setItem(JOB_STORAGE_KEY, jobId);
      // Polling useEffect takes over from here
    } catch {
      setGenError("Network failure — please try again");
      setGenState(null);
      setGenLoading(false);
    }
  }

  async function callJobAction(action: "pause" | "resume" | "retry") {
    if (!activeJobId) return;
    await fetch("/api/admin/question-bank/generate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: activeJobId, action }),
    });
  }

  async function pauseGeneration() {
    setGenPausing(true);
    await callJobAction("pause");
    // genLoading stays true until poll detects "paused" status
  }

  async function resumeGeneration() {
    await callJobAction("resume");
    setGenError(null);
    setGenLoading(true); // re-enables polling interval
  }

  async function retryGeneration() {
    await callJobAction("retry");
    setGenError(null);
    setGenDone(false);
    setGenPausing(false);
    setGenLoading(true);
    if (activeJobId) localStorage.setItem(JOB_STORAGE_KEY, activeJobId);
  }

  const progressPct = genState && genState.total > 0
    ? Math.round((genState.done / genState.total) * 100)
    : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Question Bank
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pre-generate questions once — serve them instantly when creating tests.
          </p>
        </div>
        <button onClick={fetchStats} disabled={loadingStats}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`h-4 w-4 ${loadingStats ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Active generation / paused banner */}
      {(genLoading || genState?.status === "paused") && (
        <div className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${
          genState?.status === "paused"
            ? "border-amber-300 bg-amber-50"
            : "border-blue-300 bg-blue-50"
        }`}>
          {genState?.status === "paused"
            ? <PauseCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            : <Loader2 className="h-4 w-4 animate-spin text-blue-600 flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${genState?.status === "paused" ? "text-amber-800" : "text-blue-800"}`}>
              {genState?.status === "paused"
                ? "Generation paused — click Resume in the form below to continue."
                : "Generation running in background — you can navigate freely."}
            </p>
            {genState && (
              <p className={`text-xs mt-0.5 ${genState.status === "paused" ? "text-amber-600" : "text-blue-600"}`}>
                {genState.created} of {genState.total} saved · {progressPct}%
              </p>
            )}
          </div>
        </div>
      )}

      {/* Bank Stats */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Bank Stats</h2>
          <span className="text-sm font-bold text-primary">{total.toLocaleString()} total questions</span>
        </div>

        {/* Category totals row */}
        <div className="flex gap-3 mb-3 text-xs text-muted-foreground flex-wrap">
          {CATEGORIES.map((cat) => {
            const catTotal = DIFFICULTIES.reduce((s, d) => s + (stats[statKey(cat, d)] ?? 0), 0);
            return catTotal > 0 ? (
              <span key={cat} className="capitalize font-medium">
                {cat}: <span className="text-foreground">{catTotal}</span>
              </span>
            ) : null;
          })}
        </div>

        <div className="grid grid-cols-4 gap-3">
          {CATEGORIES.map((cat) => {
            const catTotal = DIFFICULTIES.reduce((s, d) => s + (stats[statKey(cat, d)] ?? 0), 0);
            return (
              <div key={cat} className={`rounded-xl border border-border border-l-4 ${CATEGORY_ACCENT[cat]} bg-white p-4 space-y-2`}>
                <div className="flex justify-between items-center">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground capitalize">{cat}</div>
                  <div className="text-xs font-bold text-foreground">{catTotal}</div>
                </div>
                {DIFFICULTIES.map((diff) => {
                  const count = stats[statKey(cat, diff)] ?? 0;
                  const key = statKey(cat, diff);
                  const isExpanded = expanded === key;
                  const topics = isExpanded ? getTopicsForKey(key, topicStats) : [];

                  return (
                    <div key={diff}>
                      <button
                        onClick={() => setExpanded(isExpanded ? null : key)}
                        disabled={count === 0}
                        className="w-full flex justify-between items-center text-sm py-1 px-1 rounded hover:bg-muted/40 transition-colors disabled:pointer-events-none"
                      >
                        <span className="text-muted-foreground capitalize">{diff}</span>
                        <span className="flex items-center gap-1.5">
                          <span className={`font-semibold ${DIFF_COLOR[diff]}`}>{count}</span>
                          {count > 0 && (
                            <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                          )}
                        </span>
                      </button>

                      {isExpanded && topics.length > 0 && (
                        <div className="mt-1 mb-1 rounded-lg bg-slate-50 border border-slate-200 p-2 space-y-1">
                          {topics.map(({ topic, count: tCount }) => (
                            <div key={topic} className="flex justify-between items-center text-xs gap-2">
                              <span className="text-muted-foreground truncate">{topic}</span>
                              <span className="font-medium text-foreground flex-shrink-0">{tCount}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Generate form */}
      <div className="rounded-xl border border-border bg-white p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Bulk Generate Questions</h2>
          <span className="text-xs text-muted-foreground ml-1">(10–1000 per run)</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Category</label>
            <select value={genCategory} onChange={(e) => setGenCategory(e.target.value as Category)}
              disabled={genLoading}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50">
              {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Difficulty</label>
            <select value={genDifficulty} onChange={(e) => setGenDifficulty(e.target.value as Difficulty)}
              disabled={genLoading}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50">
              {DIFFICULTIES.map((d) => <option key={d} value={d} className="capitalize">{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-foreground mb-1">Topic *</label>
            <input value={genTopic} onChange={(e) => setGenTopic(e.target.value)}
              disabled={genLoading}
              placeholder={`e.g. "Percentages and Profit/Loss"`}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Count</label>
            <input type="number" min="10" max="1000" value={genCount}
              disabled={genLoading}
              onChange={(e) => setGenCount(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50" />
          </div>
        </div>

        {/* Progress */}
        {genState && (
          <div className={`rounded-lg border p-4 space-y-3 ${
            genState.status === "paused"
              ? "border-amber-200 bg-amber-50"
              : genDone
              ? "border-green-200 bg-green-50"
              : "border-blue-100 bg-blue-50"
          }`}>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className={`text-xs font-semibold ${
                  genState.status === "paused" ? "text-amber-700"
                  : genDone ? "text-green-700"
                  : "text-blue-700"
                }`}>
                  {genDone
                    ? "Generation complete"
                    : genState.status === "paused"
                    ? "Paused"
                    : genPausing
                    ? "Pausing after current batch..."
                    : "Generating & saving to bank..."}
                </span>
                <span className={`text-xs font-bold ${
                  genState.status === "paused" ? "text-amber-700"
                  : genDone ? "text-green-700"
                  : "text-blue-700"
                }`}>
                  {genState.created} / {genState.total} saved
                </span>
              </div>
              <div className={`w-full rounded-full h-2.5 ${
                genState.status === "paused" ? "bg-amber-200" : genDone ? "bg-green-200" : "bg-blue-200"
              }`}>
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ${
                    genState.status === "paused" ? "bg-amber-500"
                    : genDone ? "bg-green-600"
                    : "bg-blue-600"
                  }`}
                  style={{ width: `${genDone ? 100 : progressPct}%` }}
                />
              </div>
              <p className={`text-xs mt-1 ${
                genState.status === "paused" ? "text-amber-600"
                : genDone ? "text-green-600"
                : "text-blue-600"
              }`}>
                {genDone
                  ? "All done! Questions are in the bank."
                  : genState.status === "paused"
                  ? `Paused at ${progressPct}%. Click Resume to continue where it left off.`
                  : `${progressPct}% — you can navigate away, generation continues in background`}
              </p>
            </div>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {genState.log.map((entry, i) => (
                <div key={i} className={`flex items-start gap-1.5 text-xs ${
                  genState.status === "paused" ? "text-amber-800"
                  : genDone ? "text-green-800"
                  : "text-blue-800"
                }`}>
                  {i === genState.log.length - 1 && !genDone && genState.status !== "paused"
                    ? <Loader2 className="h-3 w-3 animate-spin mt-0.5 flex-shrink-0" />
                    : <CheckCircle2 className={`h-3 w-3 mt-0.5 flex-shrink-0 ${
                        genState.status === "paused" ? "text-amber-500"
                        : genDone ? "text-green-600"
                        : "text-blue-600"
                      }`} />}
                  {entry}
                </div>
              ))}
            </div>
          </div>
        )}

        {genError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3">
            <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive flex-1">{genError}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Start / Generate more */}
          {!genLoading && genState?.status !== "paused" && (
            <button onClick={startGeneration} disabled={!genTopic.trim()}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors">
              <Sparkles className="h-4 w-4" />
              {genDone ? "Generate More" : "Start Generation"}
            </button>
          )}

          {/* Pause — shown while running */}
          {genLoading && genState?.status !== "paused" && (
            <button onClick={pauseGeneration} disabled={genPausing}
              className="flex items-center gap-2 rounded-lg border border-amber-400 bg-amber-50 px-5 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors">
              {genPausing
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Pausing...</>
                : <><PauseCircle className="h-4 w-4" /> Pause</>}
            </button>
          )}

          {/* Resume — shown when paused */}
          {genState?.status === "paused" && (
            <button onClick={resumeGeneration}
              className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-600 transition-colors">
              <PlayCircle className="h-4 w-4" />
              Resume
            </button>
          )}

          {/* Retry — shown on error or paused */}
          {(genError || genState?.status === "paused") && activeJobId && (
            <button onClick={retryGeneration}
              className="flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
              <RotateCcw className="h-4 w-4" />
              Retry from scratch
            </button>
          )}
        </div>
      </div>

      {/* Usage tip */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Tip:</strong> Run generation overnight or during off-hours — it can take 10–30 minutes for 500+ questions.
        Generation runs in the background so you can use other admin pages freely.
      </div>
    </div>
  );
}

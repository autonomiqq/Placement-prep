"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bot, Send, StopCircle, Loader2,
  Code2, BarChart2, Zap, Target,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils/cn";

/* ─── Thinking phases ───────────────────────────────────────────── */
const PHASES = [
  "Searching knowledge base...",
  "Checking your performance data...",
  "Reasoning through the answer...",
  "Composing response...",
];

/* ─── Markdown component overrides ─────────────────────────────── */
const MarkdownComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: ({ children }) => (
    <h1 className="text-base font-bold text-foreground mt-4 mb-2 pb-1 border-b border-border/50">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-bold text-foreground mt-3 mb-1.5">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-foreground/90 mt-2 mb-1">{children}</h3>
  ),
  p: ({ children }) => {
    const text = String(children ?? "");
    if (text.startsWith("📌"))
      return (
        <div className="flex gap-2 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg px-3 py-2 my-2 text-xs text-blue-900 leading-relaxed">
          <span className="shrink-0">📌</span><span>{text.slice(2).trim()}</span>
        </div>
      );
    if (text.startsWith("💡"))
      return (
        <div className="flex gap-2 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg px-3 py-2 my-2 text-xs text-amber-900 leading-relaxed">
          <span className="shrink-0">💡</span><span>{text.slice(2).trim()}</span>
        </div>
      );
    if (text.startsWith("✅"))
      return (
        <div className="flex gap-2 bg-green-50 border-l-4 border-green-400 rounded-r-lg px-3 py-2 my-2 text-xs text-green-900 leading-relaxed">
          <span className="shrink-0">✅</span><span>{text.slice(2).trim()}</span>
        </div>
      );
    return <p className="text-sm text-foreground my-1.5 leading-relaxed">{children}</p>;
  },
  code: ({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) => {
    const isInline = (props as { inline?: boolean }).inline;
    const lang = /language-(\w+)/.exec(className || "")?.[1] ?? "";
    if (isInline) {
      return (
        <code className="bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded text-xs font-mono">
          {children}
        </code>
      );
    }
    return (
      <div className="my-3 rounded-xl overflow-hidden border border-slate-700 shadow-sm">
        <div className="flex items-center justify-between bg-slate-800 px-4 py-2">
          <div className="flex items-center gap-2">
            <Code2 className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-mono text-slate-300 uppercase tracking-wide">{lang || "code"}</span>
          </div>
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
          </div>
        </div>
        <pre className="bg-slate-900 text-green-300 px-4 py-3 overflow-x-auto text-xs font-mono leading-relaxed">
          <code>{children}</code>
        </pre>
      </div>
    );
  },
  ul: ({ children }) => <ul className="list-disc list-outside pl-4 space-y-1 my-2 text-sm">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-outside pl-4 space-y-1.5 my-2 text-sm">{children}</ol>,
  li: ({ children }) => <li className="text-foreground leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary/40 pl-4 my-2 italic text-sm text-muted-foreground">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-3 rounded-lg border border-border">
      <table className="min-w-full text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-2 text-left font-semibold text-foreground">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/50 px-3 py-1.5 text-muted-foreground">{children}</td>
  ),
  hr: () => <hr className="my-3 border-border/50" />,
};

/* ─── Suggested prompts ─────────────────────────────────────────── */
const SUGGESTED = [
  { icon: BarChart2, label: "Analyze my performance", prompt: "Analyze my test performance and tell me which areas I need to focus on most" },
  { icon: Target,   label: "What topics to practice", prompt: "Based on my scores, what specific topics should I practice next for placement exams?" },
  { icon: Zap,      label: "TCS mock questions",      prompt: "Give me 5 medium aptitude questions similar to TCS NQT pattern" },
  { icon: Code2,    label: "Coding interview prep",   prompt: "What are the most common coding patterns in campus placement interviews at top companies?" },
];

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isStreaming) { setPhaseIdx(0); return; }
    const id = setInterval(() => setPhaseIdx((p) => (p + 1) % PHASES.length), 2500);
    return () => clearInterval(id);
  }, [isStreaming]);

  const sendMessage = useCallback(async (content: string) => {
    if (isStreaming || !content.trim()) return;
    setError(null);
    setInput("");

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content };
    const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { ...assistantMsg, content: accumulated },
        ]);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Agent unavailable. Please try again.");
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [isStreaming]);

  const stopStreaming = () => { abortRef.current?.abort(); };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 flex items-center justify-center border border-violet-500/20">
            <Bot className="h-5 w-5 text-violet-500" />
            {isStreaming && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-background animate-pulse" />
            )}
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">PlacementAgent</h1>
            <p className="text-xs text-muted-foreground">
              ReAct agent · accesses your data · knowledge search · private
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 border border-violet-200 px-3 py-1 text-xs font-medium text-violet-700">
          <Zap className="h-3 w-3" />
          Agent mode
        </span>
      </div>

      {/* Thinking phase banner */}
      {isStreaming && (
        <div className="flex items-center gap-2 mb-2 px-1 animate-in fade-in duration-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500 shrink-0" />
          <span className="text-xs text-muted-foreground transition-all duration-500">
            {PHASES[phaseIdx]}
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.length === 0 && (
          <div className="py-6">
            <div className="text-center mb-8">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 border border-violet-500/20 flex items-center justify-center mx-auto mb-4 shadow-sm">
                <Bot className="h-8 w-8 text-violet-500" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">
                Your AI placement coach
              </h2>
              <p className="text-sm text-muted-foreground">
                Analyzes your data · Searches knowledge · Generates practice questions
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SUGGESTED.map(({ icon: Icon, label, prompt }) => (
                <button
                  key={label}
                  onClick={() => setInput(prompt)}
                  className="group flex items-center gap-3 text-left rounded-xl border border-border px-4 py-3 text-sm hover:bg-muted hover:border-violet-300 transition-all"
                >
                  <div className="h-8 w-8 rounded-lg bg-violet-500/8 flex items-center justify-center shrink-0 group-hover:bg-violet-500/15 transition-colors">
                    <Icon className="h-4 w-4 text-violet-500" />
                  </div>
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors font-medium">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
            style={{ animationDelay: `${i * 20}ms` }}
          >
            {msg.role === "assistant" && (
              <div className="h-8 w-8 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-4 w-4 text-violet-500" />
              </div>
            )}

            <div
              className={cn(
                "rounded-2xl px-4 py-3 max-w-[85%]",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm text-sm leading-relaxed"
                  : "bg-muted/60 border border-border/50 text-foreground rounded-tl-sm shadow-sm"
              )}
            >
              {msg.role === "user" ? (
                <span>{msg.content}</span>
              ) : msg.content === "" && isStreaming ? (
                <div className="flex gap-1.5 items-center py-1 px-1">
                  <span className="h-2 w-2 rounded-full bg-violet-500/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full bg-violet-500/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-violet-500/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              ) : (
                <div className="prose-tutor">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                    {msg.content}
                  </ReactMarkdown>
                  {isStreaming && i === messages.length - 1 && msg.content !== "" && (
                    <span className="inline-block w-0.5 h-4 bg-violet-500 animate-pulse ml-0.5 align-middle" />
                  )}
                </div>
              )}
            </div>

            {msg.role === "user" && (
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5 text-primary-foreground text-xs font-bold">
                U
              </div>
            )}
          </div>
        ))}

        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-border pt-4 mt-4">
        <div className="flex items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
            }}
            placeholder="Ask the agent to analyze your performance, find practice questions, explain a concept..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring max-h-32 overflow-y-auto"
            style={{ lineHeight: "1.5" }}
          />
          {isStreaming ? (
            <button
              onClick={stopStreaming}
              className="rounded-xl bg-destructive p-3 text-destructive-foreground hover:bg-destructive/90 transition-colors shrink-0"
              title="Stop"
            >
              <StopCircle className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              className="rounded-xl bg-violet-600 p-3 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              title="Send"
            >
              <Send className="h-5 w-5" />
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground text-center">
          Press Enter to send · Shift+Enter for new line · Agent uses your performance data and knowledge search
        </p>
      </div>
    </div>
  );
}

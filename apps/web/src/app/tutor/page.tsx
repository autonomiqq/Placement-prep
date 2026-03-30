"use client";

import { useState, useEffect, useRef } from "react";
import {
  Brain, Send, StopCircle, Plus, Loader2,
  Lightbulb, BookOpen, Code2, Zap,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAIChat } from "@/hooks/useAIChat";
import { cn } from "@/lib/utils/cn";

/* ─── Thinking-phase animation ─────────────────────────────────── */
const PHASES = [
  "Reading your question...",
  "Thinking through the answer...",
  "Composing response...",
];

/* ─── Markdown component overrides ─────────────────────────────── */
const MarkdownComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  // Headings
  h1: ({ children }) => (
    <h1 className="text-base font-bold text-foreground mt-4 mb-2 pb-1 border-b border-border/50">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-bold text-foreground mt-3 mb-1.5">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-foreground/90 mt-2 mb-1">{children}</h3>
  ),

  // Paragraph — detect emoji callout prefixes
  p: ({ children }) => {
    const text = String(children ?? "");
    if (text.startsWith("📌"))
      return (
        <div className="flex gap-2 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg px-3 py-2 my-2 text-xs text-blue-900 leading-relaxed">
          <span className="shrink-0">📌</span>
          <span>{text.slice(2).trim()}</span>
        </div>
      );
    if (text.startsWith("💡"))
      return (
        <div className="flex gap-2 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg px-3 py-2 my-2 text-xs text-amber-900 leading-relaxed">
          <span className="shrink-0">💡</span>
          <span>{text.slice(2).trim()}</span>
        </div>
      );
    if (text.startsWith("⚠️"))
      return (
        <div className="flex gap-2 bg-red-50 border-l-4 border-red-400 rounded-r-lg px-3 py-2 my-2 text-xs text-red-900 leading-relaxed">
          <span className="shrink-0">⚠️</span>
          <span>{text.slice(3).trim()}</span>
        </div>
      );
    if (text.startsWith("✅"))
      return (
        <div className="flex gap-2 bg-green-50 border-l-4 border-green-400 rounded-r-lg px-3 py-2 my-2 text-xs text-green-900 leading-relaxed">
          <span className="shrink-0">✅</span>
          <span>{text.slice(2).trim()}</span>
        </div>
      );
    return <p className="text-sm text-foreground my-1.5 leading-relaxed">{children}</p>;
  },

  // Code — inline vs block
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
            <span className="text-xs font-mono text-slate-300 uppercase tracking-wide">
              {lang || "code"}
            </span>
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

  // Lists
  ul: ({ children }) => (
    <ul className="list-disc list-outside pl-4 space-y-1 my-2 text-sm">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside pl-4 space-y-1.5 my-2 text-sm">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-foreground leading-relaxed">{children}</li>
  ),

  // Strong / em
  strong: ({ children }) => (
    <strong className="font-bold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-muted-foreground">{children}</em>
  ),

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary/40 pl-4 my-2 italic text-sm text-muted-foreground">
      {children}
    </blockquote>
  ),

  // Table
  table: ({ children }) => (
    <div className="overflow-x-auto my-3 rounded-lg border border-border">
      <table className="min-w-full text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-2 text-left font-semibold text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/50 px-3 py-1.5 text-muted-foreground">{children}</td>
  ),

  // Horizontal rule
  hr: () => <hr className="my-3 border-border/50" />,
};

/* ─── Suggested prompts ─────────────────────────────────────────── */
const SUGGESTED = [
  { icon: Zap, label: "Time & Work problems", prompt: "Explain time and work problems with formula and 2 worked examples" },
  { icon: Code2, label: "BFS vs DFS", prompt: "What is the difference between BFS and DFS? Show code and complexity" },
  { icon: BookOpen, label: "DB Normalisation", prompt: "Explain database normalization 1NF 2NF 3NF with examples" },
  { icon: Lightbulb, label: "Dynamic Programming", prompt: "How do I approach dynamic programming problems? Give a step-by-step framework" },
];

/* ─── Main component ────────────────────────────────────────────── */
export default function TutorPage() {
  const supabase = getSupabaseBrowserClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [phaseIdx, setPhaseIdx] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, isStreaming, error, sendMessage, stopStreaming, clearMessages } =
    useAIChat(sessionId ?? "");

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cycle thinking phases while streaming
  useEffect(() => {
    if (!isStreaming) { setPhaseIdx(0); return; }
    const id = setInterval(() => setPhaseIdx((p) => (p + 1) % PHASES.length), 2000);
    return () => clearInterval(id);
  }, [isStreaming]);

  // Create session on mount
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      const { data: sess } = await supabase
        .from("tutor_sessions")
        .insert({ user_id: data.user.id, title: "New conversation" })
        .select("id")
        .single();
      if (sess) setSessionId(sess.id);
    });
  }, [supabase]);

  const handleSend = async () => {
    if (!input.trim() || !sessionId || isStreaming) return;
    const msg = input;
    setInput("");
    await sendMessage(msg);
  };

  const handleNewSession = async () => {
    if (!userId) return;
    clearMessages();
    const { data: sess } = await supabase
      .from("tutor_sessions")
      .insert({ user_id: userId, title: "New conversation" })
      .select("id")
      .single();
    if (sess) setSessionId(sess.id);
  };

  const isLastAssistantEmpty =
    messages.length > 0 &&
    messages[messages.length - 1].role === "assistant" &&
    messages[messages.length - 1].content === "";

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
            <Brain className="h-5 w-5 text-primary" />
            {isStreaming && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-background animate-pulse" />
            )}
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">PlacementAI Tutor</h1>
            <p className="text-xs text-muted-foreground">
              Powered by local AI · private · runs on-device
            </p>
          </div>
        </div>
        <button
          onClick={handleNewSession}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>
      </div>

      {/* Thinking phase banner */}
      {isStreaming && (
        <div className="flex items-center gap-2 mb-2 px-1 animate-in fade-in duration-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
          <span className="text-xs text-muted-foreground transition-all duration-500">
            {PHASES[phaseIdx]}
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {/* Empty state */}
        {messages.length === 0 && (
          <div className="py-6">
            <div className="text-center mb-8">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mx-auto mb-4 shadow-sm">
                <Brain className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">
                Ask me anything about placements
              </h2>
              <p className="text-sm text-muted-foreground">
                Aptitude · Verbal · Technical CS · Coding — with examples and animations
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SUGGESTED.map(({ icon: Icon, label, prompt }) => (
                <button
                  key={label}
                  onClick={() => setInput(prompt)}
                  className="group flex items-center gap-3 text-left rounded-xl border border-border px-4 py-3 text-sm hover:bg-muted hover:border-primary/30 transition-all"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors font-medium">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg, i) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
            style={{ animationDelay: `${i * 20}ms` }}
          >
            {/* AI avatar */}
            {msg.role === "assistant" && (
              <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                <Brain className="h-4 w-4 text-primary" />
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
                // Bouncing dots while first tokens arrive
                <div className="flex gap-1.5 items-center py-1 px-1">
                  <span
                    className="h-2 w-2 rounded-full bg-primary/60 animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="h-2 w-2 rounded-full bg-primary/60 animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="h-2 w-2 rounded-full bg-primary/60 animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              ) : (
                // Rendered markdown
                <div className="prose-tutor">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={MarkdownComponents}
                  >
                    {msg.content}
                  </ReactMarkdown>
                  {/* Cursor blink while streaming this message */}
                  {isStreaming && i === messages.length - 1 && msg.content !== "" && (
                    <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
                  )}
                </div>
              )}
            </div>

            {/* User avatar */}
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
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about aptitude, DSA, DBMS, OS, networking, coding..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring max-h-32 overflow-y-auto"
            style={{ lineHeight: "1.5" }}
          />
          {isStreaming ? (
            <button
              onClick={stopStreaming}
              className="rounded-xl bg-destructive p-3 text-destructive-foreground hover:bg-destructive/90 transition-colors shrink-0"
              title="Stop generation"
            >
              <StopCircle className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !sessionId}
              className="rounded-xl bg-primary p-3 text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              title="Send"
            >
              <Send className="h-5 w-5" />
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground text-center">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

import { OLLAMA_ROUTES } from "./router";

// ── Groq (production LLM) ──────────────────────────────────────────
// When GROQ_API_KEY is set, all generate/chat calls route to Groq instead of Ollama.
// Groq free tier: 14,400 req/day — llama-3.1-8b-instant & llama-3.3-70b-versatile.
// embed() always tries Ollama; if unavailable RAG gracefully returns no context.
const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_BASE = "https://api.groq.com/openai/v1";

function toGroqModel(ollamaModel: string): string {
  const m = ollamaModel.toLowerCase();
  if (m.includes("mistral") || m.includes("70b") || m.includes("smart")) {
    return "llama-3.3-70b-versatile";
  }
  return "llama-3.1-8b-instant"; // phi3:mini, qwen2:*, placement-*, anything else
}

async function groqGenerate(prompt: string, opts: GenerateOptions): Promise<string> {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
    signal: AbortSignal.timeout(opts.timeout ?? 60_000),
    body: JSON.stringify({
      model: toGroqModel(opts.model ?? ""),
      messages: [{ role: "user", content: prompt }],
      temperature: opts.temperature ?? 0.65,
      max_tokens: opts.maxTokens ?? 2048,
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text().catch(() => "")}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function groqChat(
  messages: ChatMessage[],
  opts: GenerateOptions & { tools?: ToolDefinition[] }
): Promise<{ content: string; tool_calls?: ToolCall[] }> {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
    signal: AbortSignal.timeout(opts.timeout ?? 60_000),
    body: JSON.stringify({
      model: toGroqModel(opts.model ?? ""),
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 2048,
      tools: opts.tools,
      tool_choice: opts.tools ? "auto" : undefined,
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text().catch(() => "")}`);
  const data = await res.json();
  const choice = data.choices?.[0];
  return {
    content: choice?.message?.content ?? "",
    tool_calls: choice?.message?.tool_calls?.map((tc: {id: string; function: {name: string; arguments: string}}) => ({
      id: tc.id,
      function: { name: tc.function.name, arguments: JSON.parse(tc.function.arguments ?? "{}") },
    })),
  };
}

async function groqStreamChat(
  messages: ChatMessage[],
  opts: GenerateOptions
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: toGroqModel(opts.model ?? ""),
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 2048,
      stream: true,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      const reader = res.body!.getReader();
      try {
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
            try {
              const json = JSON.parse(line.slice(6));
              const token = json.choices?.[0]?.delta?.content;
              if (token) controller.enqueue(encoder.encode(token));
            } catch { /* skip malformed */ }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

export class OllamaError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(`Ollama ${status}: ${message}`);
    this.name = "OllamaError";
  }
}

interface GenerateOptions {
  model?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
      required: string[];
    };
  };
}

export interface ToolCall {
  id?: string;
  function: { name: string; arguments: Record<string, unknown> };
}

async function safeFetch(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error");
    throw new OllamaError(res.status, text);
  }
  return res;
}

export async function generate(
  prompt: string,
  opts: GenerateOptions = {}
): Promise<string> {
  if (GROQ_KEY) return groqGenerate(prompt, opts);

  const base = opts.baseUrl ?? OLLAMA_ROUTES.fast.baseUrl;
  const model = opts.model ?? OLLAMA_ROUTES.fast.model;
  const timeout = opts.timeout ?? 120_000;

  // Use /api/chat so Ollama applies the model's native prompt template (phi3 format).
  // This significantly improves instruction-following accuracy over raw /api/generate.
  // Streaming prevents proxy timeouts on slow hardware.
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeout),
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      stream: true,
      keep_alive: "30m",
      options: {
        temperature: opts.temperature ?? 0.65,
        num_predict: opts.maxTokens ?? 2048,
        num_keep: -1,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error");
    throw new OllamaError(res.status, text);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullResponse = "";
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        if (json.message?.content) fullResponse += json.message.content;
        if (json.done) return fullResponse;
      } catch { /* skip malformed */ }
    }
  }

  return fullResponse;
}

export async function chat(
  messages: ChatMessage[],
  opts: GenerateOptions & { tools?: ToolDefinition[] } = {}
): Promise<{ content: string; tool_calls?: ToolCall[] }> {
  if (GROQ_KEY) return groqChat(messages, opts);

  const base = opts.baseUrl ?? OLLAMA_ROUTES.fast.baseUrl;
  const model = opts.model ?? OLLAMA_ROUTES.fast.model;
  const res = await safeFetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      tools: opts.tools,
      options: {
        temperature: opts.temperature ?? 0.7,
        num_predict: opts.maxTokens ?? 2048,
      },
    }),
  });
  const data = await res.json();
  return {
    content: data.message?.content ?? "",
    tool_calls: data.message?.tool_calls,
  };
}

export async function streamChat(
  messages: ChatMessage[],
  opts: GenerateOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  if (GROQ_KEY) return groqStreamChat(messages, opts);

  const base = opts.baseUrl ?? OLLAMA_ROUTES.fast.baseUrl;
  const model = opts.model ?? OLLAMA_ROUTES.fast.model;
  const res = await safeFetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      options: {
        temperature: opts.temperature ?? 0.7,
        num_predict: opts.maxTokens ?? 2048,
      },
    }),
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      const reader = res.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter(Boolean);
          for (const line of lines) {
            try {
              const json = JSON.parse(line);
              if (json.message?.content) {
                controller.enqueue(encoder.encode(json.message.content));
              }
              if (json.done) {
                controller.close();
                return;
              }
            } catch {
              // skip malformed lines
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

/**
 * Generate a vector embedding using nomic-embed-text.
 * Returns a 768-dimensional float array.
 */
export async function embed(text: string): Promise<number[]> {
  // Groq has no embedding API — RAG retriever catches errors and returns []
  const { baseUrl, model } = OLLAMA_ROUTES.embed;
  const res = await safeFetch(`${baseUrl}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: text }),
  });
  const data = await res.json();
  const embeddings = data.embeddings ?? data.embedding;
  return Array.isArray(embeddings[0]) ? embeddings[0] : embeddings;
}

export async function isOllamaReady(baseUrl?: string): Promise<boolean> {
  const base = baseUrl ?? OLLAMA_ROUTES.fast.baseUrl;
  try {
    const res = await fetch(`${base}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

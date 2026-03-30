import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { PROMPTS } from "@/lib/ollama/prompts";
import { OLLAMA_ROUTES } from "@/lib/ollama/router";
import { retrieve, formatContext } from "@/lib/rag/retriever";

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(4000),
  context: z
    .object({
      questionId: z.string().uuid().optional(),
      testId: z.string().uuid().optional(),
    })
    .optional(),
});

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Quality-check agent loop.
 * Calls Ollama non-streaming and retries once if the response is too short
 * or is a non-answer (hallucination guard). Returns the best response.
 */
async function generateWithQualityCheck(messages: ChatMessage[]): Promise<string> {
  const { baseUrl, model } = OLLAMA_ROUTES.fast;

  async function call(msgs: ChatMessage[]): Promise<string> {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model,
        messages: msgs,
        stream: false,
        options: {
          temperature: 0.6,
          num_predict: 900,
          top_k: 40,
          top_p: 0.9,
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Ollama ${res.status}: ${err}`);
    }
    const data = await res.json();
    return (data.message?.content ?? "").trim();
  }

  // --- Attempt 1 ---
  const first = await call(messages);

  // Quality threshold: too short or a vague refusal
  const isWeak =
    first.length < 100 ||
    /^(i (cannot|can't|don't|do not)|sorry,?\s*i\s+(can't|cannot)|i'm not able)/i.test(first);

  if (!isWeak) return first;

  // --- Attempt 2: expansion retry ---
  const retryMessages: ChatMessage[] = [
    ...messages,
    { role: "assistant", content: first },
    {
      role: "user",
      content:
        "Please provide a more complete and detailed explanation with specific examples, " +
        "formulas (if applicable), and at least one worked example or code snippet.",
    },
  ];

  const second = await call(retryMessages);
  // Return whichever is better (longer)
  return second.length > first.length ? second : first;
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parseResult = bodySchema.safeParse(await req.json());
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.flatten() }, { status: 400 });
  }

  const { sessionId, message } = parseResult.data;

  // Verify session belongs to user
  const { data: session } = await supabase
    .from("tutor_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Fetch last 6 messages (3 pairs) — keeps context tight for small model
  const { data: history } = await supabase
    .from("tutor_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(6);

  // Save user message first
  await supabase.from("tutor_messages").insert({
    session_id: sessionId,
    role: "user",
    content: message,
  });

  // Retrieve relevant context from RAG knowledge base (non-blocking)
  let ragContext = "";
  try {
    const chunks = await retrieve(message, { topK: 3, minSimilarity: 0.45 });
    ragContext = formatContext(chunks);
  } catch {
    // RAG unavailable — proceed without context
  }

  const systemContent = ragContext
    ? PROMPTS.tutorSystem() + "\n\n---\nRelevant context from the knowledge base:\n" + ragContext
    : PROMPTS.tutorSystem();

  // Build message array (history is DESC order, reverse to ASC)
  const historyAsc = (history ?? []).reverse();
  const messages: ChatMessage[] = [
    { role: "system", content: systemContent },
    ...historyAsc.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  // Run quality-check agent loop
  let responseText: string;
  try {
    responseText = await generateWithQualityCheck(messages);
  } catch (err) {
    console.error("[tutor] generation error:", err);
    return NextResponse.json(
      { error: "AI model unavailable. Please try again." },
      { status: 503 }
    );
  }

  if (!responseText) {
    return NextResponse.json({ error: "Empty response from model." }, { status: 502 });
  }

  // Persist assistant response
  await supabase.from("tutor_messages").insert({
    session_id: sessionId,
    role: "assistant",
    content: responseText,
  });

  // Update session timestamp
  await supabase
    .from("tutor_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  // Stream the response to the client in chunks for a natural typing effect
  const encoder = new TextEncoder();
  const CHUNK_SIZE = 10; // characters per chunk
  const CHUNK_DELAY_MS = 18; // ~555 chars/sec — feels natural

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let i = 0;
      function push() {
        if (i >= responseText.length) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(responseText.slice(i, i + CHUNK_SIZE)));
        i += CHUNK_SIZE;
        setTimeout(push, CHUNK_DELAY_MS);
      }
      push();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

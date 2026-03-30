import { embed } from "@/lib/ollama/client";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export type ChunkSourceType = "question" | "concept" | "study_note";

export interface DocumentChunk {
  content: string;
  source_type: ChunkSourceType;
  source_id?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Embed a single text string using nomic-embed-text.
 */
export async function embedText(text: string): Promise<number[]> {
  return embed(text.slice(0, 4000)); // nomic-embed-text context limit
}

/**
 * Embed content and store it in document_chunks for RAG retrieval.
 */
export async function embedAndStore(chunk: DocumentChunk): Promise<string> {
  const supabase = getSupabaseServiceClient();
  const vector = await embedText(chunk.content);

  const { data, error } = await supabase
    .from("document_chunks")
    .insert({
      content: chunk.content,
      embedding: JSON.stringify(vector), // pgvector accepts JSON array
      source_type: chunk.source_type,
      source_id: chunk.source_id ?? null,
      metadata: chunk.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to store embedding: ${error.message}`);
  return data.id;
}

/**
 * Index a question into the RAG store so the agent can retrieve similar questions.
 * Call this after creating questions via the generate-questions API.
 */
export async function indexQuestion(questionId: string): Promise<void> {
  const supabase = getSupabaseServiceClient();

  const { data: q } = await supabase
    .from("questions")
    .select("content, tags, type, difficulty")
    .eq("id", questionId)
    .single();

  if (!q) return;

  const text = [q.content, `type:${q.type}`, `difficulty:${q.difficulty}`, ...(q.tags ?? [])].join(
    " | "
  );

  // Upsert — delete existing chunk for this question first to avoid duplicates
  await supabase.from("document_chunks").delete().eq("source_id", questionId).eq("source_type", "question");

  await embedAndStore({
    content: text,
    source_type: "question",
    source_id: questionId,
    metadata: { difficulty: q.difficulty, type: q.type, tags: q.tags },
  });
}

/**
 * Index a study note or concept for retrieval by the AI tutor / agent.
 */
export async function indexConcept(
  title: string,
  body: string,
  metadata: Record<string, unknown> = {}
): Promise<string> {
  return embedAndStore({
    content: `${title}\n\n${body}`,
    source_type: "concept",
    metadata: { title, ...metadata },
  });
}

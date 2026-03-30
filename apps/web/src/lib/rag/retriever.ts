import { embedText } from "./embeddings";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export interface RetrievedChunk {
  id: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
  source_type: string;
  source_id: string | null;
}

interface RetrieveOptions {
  topK?: number;
  minSimilarity?: number;
  sourceType?: "question" | "concept" | "study_note";
}

/**
 * Retrieve the most semantically relevant chunks for a given query.
 * Uses cosine similarity via pgvector HNSW index.
 */
export async function retrieve(
  query: string,
  opts: RetrieveOptions = {}
): Promise<RetrievedChunk[]> {
  const { topK = 5, minSimilarity = 0.4, sourceType } = opts;

  const queryEmbedding = await embedText(query);

  const supabase = await getSupabaseServiceClient();
  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: topK,
    source_filter: sourceType ?? null,
    min_similarity: minSimilarity,
  });

  if (error) {
    console.error("[RAG] retrieve error:", error.message);
    return [];
  }

  return (data ?? []) as RetrievedChunk[];
}

/**
 * Format retrieved chunks into a context string for injection into LLM prompts.
 */
export function formatContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  return chunks
    .map((c, i) => `[${i + 1}] (similarity: ${c.similarity.toFixed(2)})\n${c.content}`)
    .join("\n\n");
}

/**
 * Find questions similar to a query. Returns question IDs.
 */
export async function findSimilarQuestions(
  query: string,
  topK = 5
): Promise<Array<{ id: string; content: string; similarity: number }>> {
  const chunks = await retrieve(query, { topK, sourceType: "question", minSimilarity: 0.35 });
  return chunks.map((c) => ({
    id: c.source_id ?? c.id,
    content: c.content,
    similarity: c.similarity,
  }));
}

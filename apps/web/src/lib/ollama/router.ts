/**
 * Ollama tier routing.
 *
 * Fast tier  (llama3.2:3b)     — MCQ generation, quick answers
 * Smart tier (llama3.1:8b)     — tutoring, coding, agent reasoning
 * Embed tier (nomic-embed-text) — RAG vector embeddings
 *
 * If OLLAMA_SMART_URL is not reachable (profile not started), all calls
 * automatically fall back to the fast tier.
 */

const _fast = process.env.OLLAMA_FAST_URL ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const _smart = process.env.OLLAMA_SMART_URL ?? _fast;
const _embed = process.env.OLLAMA_EMBED_URL ?? _fast;

export const OLLAMA_ROUTES = {
  fast: {
    baseUrl: _fast,
    model: process.env.OLLAMA_FAST_MODEL ?? "phi3:mini",
  },
  mcq: {
    baseUrl: _fast,
    // Use fine-tuned placement-mcq if available, fall back to base model
    model: process.env.OLLAMA_MCQ_MODEL ?? process.env.OLLAMA_FAST_MODEL ?? "placement-mcq",
  },
  tutor: {
    baseUrl: _fast,
    model: process.env.OLLAMA_TUTOR_MODEL ?? "placement-tutor",
    fallback: { baseUrl: _fast, model: process.env.OLLAMA_FAST_MODEL ?? "phi3:mini" },
  },
  smart: {
    baseUrl: _smart,
    model: process.env.OLLAMA_SMART_MODEL ?? "mistral:7b-instruct-q4_0",
    fallback: { baseUrl: _fast, model: process.env.OLLAMA_FAST_MODEL ?? "phi3:mini" },
  },
  // Ultra-fast tier for bulk bank generation (qwen2:0.5b — 352MB, ~5x faster than phi3:mini on CPU)
  bank: {
    baseUrl: _fast,
    model: process.env.OLLAMA_BANK_MODEL ?? "placement-bank",
  },
  embed: {
    baseUrl: _embed,
    model: process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text",
  },
} as const;

export type OllamaTier = keyof typeof OLLAMA_ROUTES;

/**
 * Check if the smart tier is available. Used for graceful fallback.
 * Cached for 60s to avoid hammering the health endpoint.
 */
let _smartAvailableCache: { value: boolean; ts: number } | null = null;

export async function isSmartTierAvailable(): Promise<boolean> {
  const now = Date.now();
  if (_smartAvailableCache && now - _smartAvailableCache.ts < 60_000) {
    return _smartAvailableCache.value;
  }
  // Smart URL is same as fast if env var not set — always available
  if (_smart === _fast) {
    _smartAvailableCache = { value: true, ts: now };
    return true;
  }
  try {
    const res = await fetch(`${_smart}/api/tags`, { signal: AbortSignal.timeout(2000) });
    const available = res.ok;
    _smartAvailableCache = { value: available, ts: now };
    return available;
  } catch {
    _smartAvailableCache = { value: false, ts: now };
    return false;
  }
}

/** Returns the best available config for a smart-tier task */
export async function resolveSmartRoute() {
  const available = await isSmartTierAvailable();
  return available ? OLLAMA_ROUTES.smart : OLLAMA_ROUTES.smart.fallback;
}

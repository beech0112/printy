/**
 * Embeddings — Ollama (nomic-embed-text)
 *
 * Generates vector embeddings for semantic search.
 * Used by the knowledge ingestion script and (optionally) at query time
 * to find relevant context before calling the LLM.
 *
 * Model: nomic-embed-text (768 dimensions)
 * Endpoint: local Ollama /api/embed
 */

const EMBED_BASE_URL =
  (import.meta as any).env?.VITE_EMBED_BASE_URL ?? 'http://localhost:11434';
const EMBED_MODEL =
  (import.meta as any).env?.VITE_EMBED_MODEL ?? 'nomic-embed-text';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmbeddingResult {
  embedding: number[];
  model: string;
}

interface OllamaEmbedResponse {
  model: string;
  embeddings: number[][];
}

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Embed a single text string.
 * Returns a 768-dim float array.
 */
export async function embed(text: string): Promise<EmbeddingResult> {
  const res = await fetch(`${EMBED_BASE_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Embed error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as OllamaEmbedResponse;
  const embedding = data.embeddings?.[0];
  if (!embedding) throw new Error('No embedding returned from Ollama');

  return { embedding, model: data.model };
}

/**
 * Embed multiple texts in parallel (batched).
 * Use for seeding the knowledge base.
 */
export async function embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
  return Promise.all(texts.map(t => embed(t)));
}

/**
 * Cosine similarity between two vectors.
 * Returns a value between -1 and 1 (higher = more similar).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('Vector length mismatch');
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

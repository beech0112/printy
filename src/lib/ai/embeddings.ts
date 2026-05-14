/**
 * Embeddings — Cohere embed-english-v3.0
 *
 * Generates 1024-dim vector embeddings for RAG (semantic search).
 * Browser calls go through /api/embed proxy (key stays server-side).
 * Server-side scripts (ingest-knowledge.ts) call Cohere directly via
 * the cohereEmbed() helper exported below.
 *
 * Input types:
 *   'search_document' — when ingesting knowledge chunks
 *   'search_query'    — when embedding a user message at query time
 */

export type EmbedInputType = 'search_document' | 'search_query';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
}

// ─── Browser-side (via /api/embed proxy) ─────────────────────────────────────

/**
 * Embed a single text string via the /api/embed proxy.
 * Returns a 1024-dim float array.
 * Use at query time (chat pipeline).
 */
export async function embed(
  text: string,
  inputType: EmbedInputType = 'search_query'
): Promise<EmbeddingResult> {
  const res = await fetch('/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts: [text], inputType }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Embed error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { embeddings: number[][]; model: string };
  const embedding = data.embeddings?.[0];
  if (!embedding) throw new Error('No embedding returned from /api/embed');

  return { embedding, model: data.model ?? 'embed-english-v3.0' };
}

/**
 * Embed multiple texts in a single Cohere API call via the proxy.
 * Use for browser-side batch operations (rare).
 */
export async function embedBatch(
  texts: string[],
  inputType: EmbedInputType = 'search_document'
): Promise<EmbeddingResult[]> {
  const res = await fetch('/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, inputType }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Embed batch error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { embeddings: number[][]; model: string };
  return data.embeddings.map(embedding => ({
    embedding,
    model: data.model ?? 'embed-english-v3.0',
  }));
}

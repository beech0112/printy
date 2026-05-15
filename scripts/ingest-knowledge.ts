/**
 * ingest-knowledge.ts
 *
 * Seeds the knowledge_chunks table with printing services from Supabase.
 * Embeds each chunk via Cohere embed-english-v3.0 (1024 dims).
 * Upserts on (source, title) — safe to re-run after catalog updates.
 *
 * Usage:
 *   npm run ingest
 *   node --env-file=.env.local --experimental-strip-types scripts/ingest-knowledge.ts
 *
 * Required env vars (from .env.local):
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY, COHERE_API_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { CohereClient } from 'cohere-ai';

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const COHERE_API_KEY = process.env.COHERE_API_KEY!;
const EMBED_MODEL = 'embed-english-v3.0';
const BATCH_SIZE = 20; // Cohere embed batch limit

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !COHERE_API_KEY) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, COHERE_API_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const cohere = new CohereClient({ token: COHERE_API_KEY });

// ─── Types ────────────────────────────────────────────────────────────────────

interface KnowledgeChunk {
  source: string;
  title: string;
  content: string;
}

// ─── Source: printing_services ────────────────────────────────────────────────

async function fetchServiceChunks(): Promise<KnowledgeChunk[]> {
  const { data, error } = await sb
    .from('printing_services')
    .select('name, description, base_price, price_unit, service_categories(name)')
    .eq('status', 'active')
    .order('name');

  if (error) throw new Error(`Failed to fetch services: ${error.message}`);
  if (!data || data.length === 0) {
    console.warn('No active services found in printing_services table.');
    return [];
  }

  return data.map((s: any) => {
    const category = s.service_categories?.name ?? 'Uncategorized';
    const price = s.base_price
      ? `Price: ₱${s.base_price}${s.price_unit ? ` ${s.price_unit}` : ''}`
      : '';
    const description = s.description ? s.description.trim() : '';

    const content = [
      `[${category}] ${s.name}`,
      description,
      price,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      source: 'services',
      title: s.name,
      content,
    };
  });
}

// ─── Embed ────────────────────────────────────────────────────────────────────

async function embedChunks(chunks: KnowledgeChunk[]): Promise<Array<KnowledgeChunk & { embedding: number[] }>> {
  const results: Array<KnowledgeChunk & { embedding: number[] }> = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.content);

    console.log(`Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} (${batch.length} chunks)...`);

    const response = await cohere.embed({
      model: EMBED_MODEL,
      texts,
      inputType: 'search_document',
      embeddingTypes: ['float'],
    });

    const embeddings = (response.embeddings as any)?.float ?? response.embeddings;
    if (!embeddings || embeddings.length !== batch.length) {
      throw new Error(`Embedding count mismatch: expected ${batch.length}, got ${embeddings?.length}`);
    }

    batch.forEach((chunk, idx) => {
      results.push({ ...chunk, embedding: embeddings[idx] });
    });
  }

  return results;
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

async function upsertChunks(chunks: Array<KnowledgeChunk & { embedding: number[] }>): Promise<void> {
  const rows = chunks.map(c => ({
    source: c.source,
    title: c.title,
    content: c.content,
    embedding: JSON.stringify(c.embedding), // Supabase JS expects stringified vectors
    metadata: {},
  }));

  const { error } = await sb
    .from('knowledge_chunks')
    .upsert(rows, { onConflict: 'source,title' });

  if (error) throw new Error(`Upsert failed: ${error.message}`);
}

// ─── Source: company_faqs ─────────────────────────────────────────────────────

async function fetchFaqChunks(): Promise<KnowledgeChunk[]> {
  const { data, error } = await sb
    .from('company_faqs')
    .select('question, answer')
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw new Error(`Failed to fetch FAQs: ${error.message}`);
  if (!data || data.length === 0) {
    console.warn('No active FAQs found in company_faqs table.');
    return [];
  }

  return data.map((faq: any) => {
    const title = faq.question.length > 100
      ? faq.question.slice(0, 97) + '...'
      : faq.question;
    const content = `Q: ${faq.question}\nA: ${faq.answer}`;
    return { source: 'faq', title, content };
  });
}

// ─── Source: about_bj_santiago ────────────────────────────────────────────────

async function fetchAboutChunks(): Promise<KnowledgeChunk[]> {
  const { data, error } = await sb
    .from('about_bj_santiago')
    .select('title, content')
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw new Error(`Failed to fetch about sections: ${error.message}`);
  if (!data || data.length === 0) {
    console.warn('No active about sections found in about_bj_santiago table.');
    return [];
  }

  return data.map((section: any) => ({
    source: 'about',
    title: section.title,
    content: `${section.title}\n\n${section.content}`,
  }));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Printy knowledge ingestion starting...\n');

  // Services
  console.log('Fetching printing services...');
  const serviceChunks = await fetchServiceChunks();
  console.log(`Found ${serviceChunks.length} active services.`);

  // FAQs
  console.log('Fetching company FAQs...');
  const faqChunks = await fetchFaqChunks();
  console.log(`Found ${faqChunks.length} active FAQs.`);

  // About sections
  console.log('Fetching about sections...');
  const aboutChunks = await fetchAboutChunks();
  console.log(`Found ${aboutChunks.length} about sections.\n`);

  const allChunks = [...serviceChunks, ...faqChunks, ...aboutChunks];

  if (allChunks.length === 0) {
    console.log('Nothing to ingest. Exiting.');
    return;
  }

  const embedded = await embedChunks(allChunks);
  console.log(`\nUpserting ${embedded.length} chunks into knowledge_chunks...`);
  await upsertChunks(embedded);

  console.log(`\nDone. ${embedded.length} chunks upserted successfully.`);
  console.log(`  - ${serviceChunks.length} service chunks`);
  console.log(`  - ${faqChunks.length} FAQ chunks`);
  console.log(`  - ${aboutChunks.length} about chunks`);
}

main().catch(err => {
  console.error('Ingestion failed:', err.message);
  process.exit(1);
});

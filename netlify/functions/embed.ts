import type { Handler } from '@netlify/functions';
import { CohereClient } from 'cohere-ai';

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { texts, inputType = 'search_query' } = JSON.parse(event.body || '{}');
    if (!Array.isArray(texts) || texts.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'texts array required' }) };
    }

    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'COHERE_API_KEY not set' }) };
    }

    const cohere = new CohereClient({ token: apiKey });
    const response = await cohere.embed({
      model: 'embed-english-v3.0',
      texts,
      inputType,
      embeddingTypes: ['float'],
    });

    const embeddings = (response.embeddings as any)?.float ?? response.embeddings;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeddings, model: 'embed-english-v3.0' }),
    };
  } catch (e: any) {
    return { statusCode: 500, body: JSON.stringify({ error: e?.message ?? 'server error' }) };
  }
};

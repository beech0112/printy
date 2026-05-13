import type { Handler } from '@netlify/functions';

// Ollama uses the OpenAI-compatible /api/chat endpoint.
// Message format: { role: 'user' | 'assistant' | 'system', content: string }

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { messages, model, stream = false } = JSON.parse(event.body || '{}');
    if (!Array.isArray(messages) || messages.length === 0) {
      return { statusCode: 400, body: 'messages required' };
    }

    const baseUrl = process.env.LLM_BASE_URL || 'http://localhost:11434';
    const mdl = model || process.env.LLM_MODEL || 'llama3.1:8b';

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: mdl,
        messages,
        stream,
        options: { temperature: 0.3 },
      }),
    });

    if (!res.ok) {
      return { statusCode: res.status, body: await res.text() };
    }

    const data: any = await res.json();
    return {
      statusCode: 200,
      body: JSON.stringify({
        text: data?.message?.content || '',
        raw: data,
      }),
    };
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || 'server error' };
  }
};

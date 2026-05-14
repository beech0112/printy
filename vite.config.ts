import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { CohereClient } from 'cohere-ai';
import { createClient } from '@supabase/supabase-js';

// Custom plugin to forward console logs to terminal
const consoleToTerminalPlugin = () => {
  return {
    name: 'console-to-terminal',
    configureServer(server: any) {
      server.middlewares.use('/__console-log', (req: any, res: any) => {
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const logData = JSON.parse(body);
            const timestamp = new Date().toISOString();
            const level = logData.level || 'log';
            const message = logData.message || '';
            const args = logData.args || [];

            // Color coding for different log levels
            const colors = {
              error: '\x1b[31m', // Red
              warn: '\x1b[33m', // Yellow
              info: '\x1b[36m', // Cyan
              log: '\x1b[37m', // White
              debug: '\x1b[90m', // Gray
            };
            const reset = '\x1b[0m';
            const color = colors[level as keyof typeof colors] || colors.log;

            // Enhanced logging with more details
            console.log(
              `${color}[${timestamp}] [CONSOLE-TO-TERMINAL] ${level.toUpperCase()}:${reset} ${message}`
            );
            if (args.length > 0) {
              args.forEach((arg: any, index: number) => {
                console.log(
                  `${color}  [ARG ${index}]:${reset}`,
                  typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
                );
              });
            }
          } catch (e) {
            console.log(
              `[CONSOLE-TO-TERMINAL] Failed to parse console log: ${body}`
            );
            console.log(`[CONSOLE-TO-TERMINAL] Parse error:`, e);
          }
          res.end();
        });
      });
    },
  };
};

// ─── Cohere proxy plugin ───────────────────────────────────────────────────────
// Handles POST /api/chat and POST /api/embed in dev so API keys stay server-side.
// On production these become Netlify functions.
const cohereProxyPlugin = () => {
  return {
    name: 'cohere-proxy',
    configureServer(server: any) {

      // ── POST /api/embed ────────────────────────────────────────────────────
      server.middlewares.use('/api/embed', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        const apiKey = process.env.COHERE_API_KEY;
        if (!apiKey) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'COHERE_API_KEY not set in environment' }));
          return;
        }

        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', async () => {
          try {
            const { texts, inputType = 'search_query' } = JSON.parse(body);
            if (!Array.isArray(texts) || texts.length === 0) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'texts array required' }));
              return;
            }

            const cohere = new CohereClient({ token: apiKey });
            const response = await cohere.embed({
              model: 'embed-english-v3.0',
              texts,
              inputType,
              embeddingTypes: ['float'],
            });

            const embeddings = (response.embeddings as any)?.float ?? response.embeddings;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ embeddings, model: 'embed-english-v3.0' }));
          } catch (err: any) {
            console.error('[cohere-proxy] /api/embed error:', err?.message ?? err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err?.message ?? 'Unknown error' }));
          }
        });
      });

      // ── POST /api/chat ─────────────────────────────────────────────────────
      server.middlewares.use('/api/chat', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        const apiKey = process.env.COHERE_API_KEY;
        if (!apiKey) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'COHERE_API_KEY not set in environment' }));
          return;
        }

        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', async () => {
          try {
            const { systemPrompt, history, userMessage, tools } = JSON.parse(body);

            const cohere = new CohereClient({ token: apiKey });

            // ── RAG retrieval ──────────────────────────────────────────────
            // Skip retrieval for the greeting sentinel to avoid a wasted embed call
            let ragContext = '';
            const isGreeting = userMessage === '__greeting__';

            if (!isGreeting) {
              try {
                const embedResponse = await cohere.embed({
                  model: 'embed-english-v3.0',
                  texts: [userMessage],
                  inputType: 'search_query',
                  embeddingTypes: ['float'],
                });
                const queryVector = ((embedResponse.embeddings as any)?.float ?? embedResponse.embeddings)?.[0];

                if (queryVector) {
                  const supabaseUrl = process.env.SUPABASE_URL;
                  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
                  if (supabaseUrl && supabaseKey) {
                    const sb = createClient(supabaseUrl, supabaseKey);
                    const { data: chunks } = await sb.rpc('match_knowledge', {
                      query_embedding: queryVector,
                      match_threshold: 0.45,
                      match_count: 5,
                    });
                    if (chunks && chunks.length > 0) {
                      ragContext = chunks.map((c: any) => c.content).join('\n\n---\n\n');
                      console.debug(`[cohere-proxy] RAG: ${chunks.length} chunks retrieved`);
                    }
                  }
                }
              } catch (ragErr: any) {
                // Non-fatal — fall through without RAG context
                console.warn('[cohere-proxy] RAG retrieval failed (non-fatal):', ragErr?.message);
              }
            }

            // Inject RAG chunks into system prompt if we got results
            const finalSystemPrompt = ragContext
              ? `${systemPrompt}\n\n## Relevant Knowledge\n${ragContext}`
              : systemPrompt;

            // ── Map tools to Cohere format ─────────────────────────────────
            const cohereTools = tools?.map((t: any) => ({
              name: t.function.name,
              description: t.function.description,
              parameterDefinitions: Object.fromEntries(
                Object.entries(t.function.parameters.properties ?? {}).map(
                  ([key, val]: [string, any]) => [
                    key,
                    {
                      description: val.description ?? '',
                      type: val.type ?? 'str',
                      required: (t.function.parameters.required ?? []).includes(key),
                    },
                  ]
                )
              ),
            }));

            // ── Build Cohere chat history ──────────────────────────────────
            const chatHistory = history.map((m: any) => ({
              role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
              message: m.content,
            }));

            const response = await cohere.chat({
              model: 'command-a-03-2025',
              preamble: finalSystemPrompt,
              chatHistory,
              message: userMessage,
              tools: cohereTools?.length ? cohereTools : undefined,
            });

            if (response.toolCalls && response.toolCalls.length > 0) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                text: response.text ?? '',
                toolCalls: response.toolCalls.map((tc: any) => ({
                  name: tc.name,
                  arguments: tc.parameters ?? {},
                })),
              }));
              return;
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ text: response.text ?? '', toolCalls: [] }));
          } catch (err: any) {
            console.error('[cohere-proxy] /api/chat error:', err?.message ?? err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err?.message ?? 'Unknown error' }));
          }
        });
      });
    },
  };
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env.local into process.env so server-side plugins can read it
  const env = loadEnv(mode, process.cwd(), '');
  if (env.COHERE_API_KEY) process.env.COHERE_API_KEY = env.COHERE_API_KEY;
  if (env.SUPABASE_URL) process.env.SUPABASE_URL = env.SUPABASE_URL;
  if (env.SUPABASE_SERVICE_KEY) process.env.SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;

  return {
  plugins: [react(), tsconfigPaths(), consoleToTerminalPlugin(), cohereProxyPlugin()],
  optimizeDeps: {
    include: ['tslib'],
  },
  build: {
    rollupOptions: {
      external: id => {
        // Don't externalize tslib - it should be bundled
        if (id === 'tslib') return false;
        return false;
      },
      // Let Rollup decide chunk boundaries to avoid evaluation order issues
    },
    // Increase chunk size warning limit to 1500kb
    // Note: heic-vendor chunk is intentionally large and loads on-demand only
    chunkSizeWarningLimit: 1500,
  },
  };
});

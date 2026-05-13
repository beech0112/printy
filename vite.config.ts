import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { CohereClient } from 'cohere-ai';

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

// ─── Cohere chat proxy plugin ─────────────────────────────────────────────────
// Handles POST /api/chat in the Vite dev server so COHERE_API_KEY stays server-side.
const cohereProxyPlugin = () => {
  return {
    name: 'cohere-proxy',
    configureServer(server: any) {
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

            // Map our OllamaTool schemas to Cohere tool format
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

            // Build Cohere chat history
            const chatHistory = history.map((m: any) => ({
              role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
              message: m.content,
            }));

            const response = await cohere.chat({
              model: 'command-a-03-2025',
              preamble: systemPrompt,
              chatHistory,
              message: userMessage,
              tools: cohereTools?.length ? cohereTools : undefined,
            });

            // Check for tool calls
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
            console.error('[cohere-proxy] error:', err?.message ?? err);
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

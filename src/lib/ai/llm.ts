/**
 * LLM Client — Gemini 2.0 Flash (via /api/chat proxy)
 *
 * The browser calls /api/chat (handled by vite.config.ts middleware).
 * The middleware holds GEMINI_API_KEY server-side and forwards to Google.
 *
 * Tool calling: Gemini native function calling format, mapped to our OllamaTool schemas.
 */

import { TOOLS, executeTool, type ToolCall, type ToolExecutionContext } from './tools';
import { getSystemPrompt, type UserRole } from './prompts';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMChatOptions {
  userRole: UserRole;
  history: ChatMessage[];
  userMessage: string;
  context?: ToolExecutionContext;
  maxToolRounds?: number;
}

export interface LLMChatResult {
  text: string;
  toolsUsed: string[];
  quoteDraft?: Record<string, unknown>;
  escalated?: boolean;
}

// ─── Proxy request/response types ────────────────────────────────────────────

interface ProxyRequest {
  systemPrompt: string;
  history: ChatMessage[];
  userMessage: string;
  tools: typeof TOOLS;
}

interface ProxyResponse {
  text?: string;
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
  error?: string;
}

// ─── Core Chat Function ───────────────────────────────────────────────────────

export async function chat(options: LLMChatOptions): Promise<LLMChatResult> {
  const { userRole, history, userMessage, context = {}, maxToolRounds = 5 } = options;

  const systemPrompt = getSystemPrompt(userRole);
  const toolsUsed: string[] = [];
  let quoteDraft: Record<string, unknown> | undefined;
  let escalated = false;

  let currentHistory = [...history];
  let currentMessage = userMessage;
  let rounds = 0;

  while (rounds < maxToolRounds) {
    rounds++;

    console.debug('[llm] calling /api/chat | round:', rounds, '| history:', currentHistory.length);

    const reqBody: ProxyRequest = {
      systemPrompt,
      history: currentHistory,
      userMessage: currentMessage,
      tools: TOOLS,
    };

    let proxyRes: ProxyResponse;
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.error('[llm] proxy error', res.status, txt);
        throw new Error(`Chat proxy error ${res.status}: ${txt}`);
      }
      proxyRes = await res.json() as ProxyResponse;
    } catch (err) {
      console.error('[llm] fetch failed:', err);
      throw err;
    }

    console.debug('[llm] response | text len:', proxyRes.text?.length ?? 0, '| tool_calls:', proxyRes.toolCalls?.length ?? 0);

    // No tool calls — final answer
    if (!proxyRes.toolCalls || proxyRes.toolCalls.length === 0) {
      return {
        text: proxyRes.text ?? '',
        toolsUsed,
        quoteDraft,
        escalated,
      };
    }

    // Execute tool calls
    let toolResultSummary = '';
    for (const tc of proxyRes.toolCalls) {
      const call: ToolCall = { name: tc.name, arguments: tc.arguments };
      const result = await executeTool(call, context);
      toolsUsed.push(call.name);

      if (call.name === 'draft_quote_request' && result.result) {
        quoteDraft = result.result as Record<string, unknown>;
      }
      if (call.name === 'escalate_to_human') {
        escalated = true;
      }

      toolResultSummary += `Tool ${call.name} result: ${JSON.stringify(result.result ?? result.error)}\n`;
    }

    // Feed tool results back as the next user turn (Gemini doesn't have a native tool role in REST)
    currentHistory = [
      ...currentHistory,
      { role: 'user', content: currentMessage },
      { role: 'assistant', content: proxyRes.text ?? '(checking...)' },
    ];
    currentMessage = `[Tool results]\n${toolResultSummary}\nPlease continue based on these results.`;
  }

  return {
    text: 'Sorry, I ran into an issue processing your request. Please try again.',
    toolsUsed,
    quoteDraft,
    escalated,
  };
}

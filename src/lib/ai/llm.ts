/**
 * LLM Client — Gemini 2.0 Flash (via /api/chat proxy)
 *
 * The browser calls /api/chat (handled by vite.config.ts middleware).
 * The middleware holds GEMINI_API_KEY server-side and forwards to Google.
 *
 * Tool calling: Gemini native function calling format, mapped to our OllamaTool schemas.
 */

import { TOOLS, ADMIN_TOOL_NAMES, executeTool, type ToolCall, type ToolExecutionContext } from './tools';
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

export interface LLMQuickReply {
  id: string;
  label: string;
  value: string;
}

export interface LLMChatResult {
  text: string;
  quickReplies: LLMQuickReply[];
  toolsUsed: string[];
  quoteDraft?: Record<string, unknown>;
  escalated?: boolean;
}

// ─── Chip extraction ──────────────────────────────────────────────────────────
// Parses [ Label ] tokens from LLM text, strips them, returns as QuickReply objects.
// Handles multi-line chip lists like:
//   [ Request a Quote ]  [ Browse Services ]  [ Report an Issue ]
const CHIP_PATTERN = /\[\s*([^\]]+?)\s*\]/gi;

function extractChips(text: string): { cleanText: string; quickReplies: LLMQuickReply[] } {
  const quickReplies: LLMQuickReply[] = [];
  const seen = new Set<string>();

  let cleanText = text.replace(CHIP_PATTERN, (_, label: string) => {
    const trimmed = label.trim();
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      quickReplies.push({ id: crypto.randomUUID(), label: trimmed, value: trimmed });
    }
    return '';
  });

  // Clean up orphaned separators like · or | left between removed chips
  cleanText = cleanText
    .replace(/\s*[·|]\s*(?=[·|\s]|$)/g, ' ')
    .replace(/^\s*[·|]\s*/gm, '')
    .replace(/\s*[·|]\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { cleanText, quickReplies };
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

    const roleTools = userRole === 'admin'
      ? TOOLS
      : TOOLS.filter(t => !ADMIN_TOOL_NAMES.includes(t.function.name));

    const reqBody: ProxyRequest = {
      systemPrompt,
      history: currentHistory,
      userMessage: currentMessage,
      tools: roleTools,
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
      const { cleanText, quickReplies } = extractChips(proxyRes.text ?? '');
      return {
        text: cleanText,
        quickReplies,
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
    quickReplies: [],
    toolsUsed,
    quoteDraft,
    escalated,
  };
}

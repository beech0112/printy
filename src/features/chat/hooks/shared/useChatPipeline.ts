/**
 * useChatPipeline
 *
 * The core hook that powers AI chat for all roles (customer, admin, guest).
 * Owns message history, calls the LLM pipeline, and surfaces side effects
 * (quote drafts, escalations) for the UI layer to act on.
 *
 * Usage:
 *   const { messages, isTyping, send, quoteDraft, escalated } = useChatPipeline({
 *     userRole: 'customer',
 *     sessionId,
 *     customerType,  // 'regular' | 'valued' — used for urgency tagging
 *   });
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@lib/supabase';
import { chat } from '@lib/ai/llm';
import type { ChatMessage as LLMChatMessage } from '@lib/ai/llm';
import type { UserRole } from '@lib/ai/prompts';
import type { ChatMessage } from '@features/chat/types/chat';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CustomerType = 'regular' | 'valued';

export interface UseChatPipelineOptions {
  userRole: UserRole;
  customerType?: CustomerType;
  sessionId?: string;
  conversationId?: string;
  userId?: string;
  /** Initial messages to pre-populate (e.g. loaded from DB) */
  initialMessages?: ChatMessage[];
  /**
   * Fire a greeting automatically on mount.
   * Default false — caller should invoke greet() explicitly when the chat UI opens,
   * to avoid LLM calls on pages where chat hasn't been opened yet.
   */
  autoGreet?: boolean;
}

export interface QuoteDraft {
  service_name: string;
  quantity: string;
  specs?: string;
  notes?: string;
  session_id?: string;
}

export interface UseChatPipelineResult {
  messages: ChatMessage[];
  isTyping: boolean;
  send: (text: string) => Promise<void>;
  /** Send the opening greeting — call this when the chat UI becomes visible */
  greet: () => Promise<void>;
  quoteDraft: QuoteDraft | null;
  clearQuoteDraft: () => void;
  escalated: boolean;
  reset: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useChatPipeline(options: UseChatPipelineOptions): UseChatPipelineResult {
  const {
    userRole,
    customerType = 'regular',
    sessionId,
    conversationId,
    userId,
    initialMessages = [],
    autoGreet = false,
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isTyping, setIsTyping] = useState(false);
  const [quoteDraft, setQuoteDraft] = useState<QuoteDraft | null>(null);
  const [escalated, setEscalated] = useState(false);

  // Keep a ref of LLM-format history for the chat() call
  // (separate from display messages which use ChatMessage format)
  const historyRef = useRef<LLMChatMessage[]>(
    initialMessages
      .filter(m => !m.isHistorical) // don't re-feed historical DB messages as fresh context
      .map(m => ({
        role: m.role === 'printy' ? 'assistant' : 'user',
        content: m.text,
      }))
  );

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  // Greeting logic — extracted so it can be called explicitly or auto-fired
  const greetedRef = useRef(false);
  const greet = useCallback(async () => {
    if (greetedRef.current) return;
    greetedRef.current = true;
    console.debug('[useChatPipeline] sending greeting for role:', userRole);
    setIsTyping(true);
    try {
      const result = await chat({
        userRole,
        history: [],
        userMessage: '__greeting__',
        context: { sessionId, conversationId, userId, supabase },
        maxToolRounds: 1,
      });
      console.debug('[useChatPipeline] greeting response:', result.text?.slice(0, 80));
      setMessages([{
        id: crypto.randomUUID(),
        role: 'printy',
        text: result.text,
        ts: Date.now(),
      }]);
      historyRef.current = [{ role: 'assistant', content: result.text }];
    } catch (err) {
      console.error('[useChatPipeline] greeting failed:', err);
      setMessages([{
        id: crypto.randomUUID(),
        role: 'printy',
        text: "Hi! I'm Printy, your printing assistant. How can I help you today?",
        ts: Date.now(),
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [userRole, sessionId, conversationId, userId]);

  // Auto-greet on mount only if explicitly opted in
  useEffect(() => {
    if (autoGreet && initialMessages.length === 0) greet();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || isTyping) return;

      // Show user message immediately
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text: text.trim(),
        ts: Date.now(),
      };
      appendMessage(userMsg);
      setIsTyping(true);

      // Persist user message to DB if we have a session
      if (sessionId) {
        supabase
          .from('chat_messages')
          .insert({
            session_id: sessionId,
            conversation_id: conversationId ?? null,
            sender_id: userId ?? null,
            sender_role: userRole,
            content: text.trim(),
            // valued customers get all messages flagged urgent
            metadata: customerType === 'valued' ? { urgent: true } : {},
          })
          .then(({ error }) => {
            if (error) console.error('Failed to persist user message:', error);
          });
      }

      try {
        const result = await chat({
          userRole,
          history: historyRef.current,
          userMessage: text.trim(),
          context: { sessionId, conversationId, userId, supabase },
          maxToolRounds: 5,
        });

        // Update LLM history for next turn
        historyRef.current = [
          ...historyRef.current,
          { role: 'user', content: text.trim() },
          { role: 'assistant', content: result.text },
        ];

        const botMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'printy',
          text: result.text,
          ts: Date.now(),
        };
        appendMessage(botMsg);

        // Persist bot response to DB
        if (sessionId) {
          supabase
            .from('chat_messages')
            .insert({
              session_id: sessionId,
              conversation_id: conversationId ?? null,
              sender_id: null,
              sender_role: 'assistant',
              content: result.text,
              metadata: {
                tools_used: result.toolsUsed,
                ...(customerType === 'valued' ? { urgent: true } : {}),
              },
            })
            .then(({ error }) => {
              if (error) console.error('Failed to persist bot message:', error);
            });
        }

        // Surface side effects
        if (result.quoteDraft) {
          setQuoteDraft(result.quoteDraft as unknown as QuoteDraft);
        }
        if (result.escalated) {
          setEscalated(true);
        }
      } catch (err) {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'printy',
          text: "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
          ts: Date.now(),
        };
        appendMessage(errorMsg);
        console.error('LLM pipeline error:', err);
      } finally {
        setIsTyping(false);
      }
    },
    [
      isTyping,
      userRole,
      customerType,
      sessionId,
      conversationId,
      userId,
      appendMessage,
    ]
  );

  const clearQuoteDraft = useCallback(() => setQuoteDraft(null), []);

  const reset = useCallback(() => {
    setMessages([]);
    setIsTyping(false);
    setQuoteDraft(null);
    setEscalated(false);
    historyRef.current = [];
    greetedRef.current = false; // allow re-greeting after reset
  }, []);

  return { messages, isTyping, send, greet, quoteDraft, clearQuoteDraft, escalated, reset };
}

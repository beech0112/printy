/**
 * useAdminChat
 * Wraps useChatPipeline for the admin role.
 * Replaces the legacy stub — wired to the real AI pipeline.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@lib/supabase';
import { useChatPipeline } from '@features/chat/hooks/shared/useChatPipeline';
import type { ChatMessage, QuickReply } from '@features/chat/types/chat';

export interface UseAdminChatReturn {
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  messages: ChatMessage[];
  isTyping: boolean;
  quickReplies: QuickReply[];
  handleChatOpen: () => void;
  handleChatOpenWithTopic: (
    topic: string,
    orderId?: string,
    updateOrder?: (orderId: string, updates: any) => void,
    orders?: any[],
    refreshOrders?: () => void,
    orderIds?: string[]
  ) => void;
  handleShowConversation: (conversationId: string) => Promise<void>;
  endChatWithDelay: () => void;
  handleSendMessage: (text: string) => void;
  handleQuickReply: (value: string | { value: string; label: string }) => void;
  readOnly: boolean;
  dbSessionId: string | null;
  currentConversationId: string | null;
}

export const useAdminChat = (): UseAdminChatReturn => {
  const [chatOpen, setChatOpen] = useState(false);
  const [userId, setUserId] = useState<string | undefined>(undefined);

  // Fetch the current admin user ID once on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setUserId(data.user.id);
    });
  }, []);

  const pipeline = useChatPipeline({
    userRole: 'admin',
    userId,
    autoGreet: false,
  });

  const handleChatOpen = () => {
    setChatOpen(true);
    pipeline.greet();
  };

  const handleChatOpenWithTopic = (topic: string) => {
    setChatOpen(true);
    pipeline.send(topic);
  };

  const endChatWithDelay = () => {
    setTimeout(() => {
      setChatOpen(false);
      pipeline.reset();
    }, 300);
  };

  const handleQuickReply = (value: string | { value: string; label: string }) => {
    pipeline.send(typeof value === 'string' ? value : value.value);
  };

  return {
    chatOpen,
    setChatOpen,
    messages: pipeline.messages,
    isTyping: pipeline.isTyping,
    quickReplies: pipeline.quickReplies,
    handleChatOpen,
    handleChatOpenWithTopic,
    handleShowConversation: async () => {},
    endChatWithDelay,
    handleSendMessage: pipeline.send,
    handleQuickReply,
    readOnly: false,
    dbSessionId: null,
    currentConversationId: null,
  };
};

export default useAdminChat;

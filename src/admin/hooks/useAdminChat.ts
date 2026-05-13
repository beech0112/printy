/**
 * useAdminChat
 * Stubbed — flow engine removed. Will be replaced by the AI pipeline hook.
 */
import { useState } from 'react';
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
  const [messages] = useState<ChatMessage[]>([]);
  const [isTyping] = useState(false);
  const [quickReplies] = useState<QuickReply[]>([]);

  return {
    chatOpen,
    setChatOpen,
    messages,
    isTyping,
    quickReplies,
    handleChatOpen: () => setChatOpen(true),
    handleChatOpenWithTopic: () => {},
    handleShowConversation: async () => {},
    endChatWithDelay: () => setChatOpen(false),
    handleSendMessage: () => {},
    handleQuickReply: () => {},
    readOnly: false,
    dbSessionId: null,
    currentConversationId: null,
  };
};

export default useAdminChat;

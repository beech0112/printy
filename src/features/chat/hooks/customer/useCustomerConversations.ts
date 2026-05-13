/**
 * useCustomerConversations
 * Stubbed — flow engine removed. Will be replaced by the AI pipeline hook.
 */
import { useConversationState } from '@features/chat/hooks/shared/useConversationState';
import { useSessionCache } from '@customer/components/shared/cache/SessionCacheProvider';

export function useCustomerConversations() {
  const state = useConversationState();
  useSessionCache(); // keep provider happy

  return {
    messages: state.messages,
    isTyping: state.isTyping,
    conversations: state.conversations,
    activeId: state.activeId,
    quickReplies: state.quickReplies,
    inputPlaceholder: state.inputPlaceholder,
    sessionId: null as string | null,
    initializeFlow: async (_flowId: string, _title: string, _ctx?: any) => {},
    handleSend: async (_text: string) => {},
    handleQuickReply: async (_value: string | { value: string; label: string }) => {},
    switchConversation: async (_id: string) => {},
    endChat: async (_conversationId?: string, _sessionId?: string) => {},
    setActiveId: state.setActiveId,
    setConversations: state.setConversations,
  } as const;
}

export default useCustomerConversations;

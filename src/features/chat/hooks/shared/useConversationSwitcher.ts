/**
 * useConversationSwitcher
 * Stubbed — flow engine removed. Will be replaced by the AI pipeline.
 */
import type { ChatMessage } from '@features/chat/types/chat';

export function useConversationSwitcher() {
  const switchConversation = async (
    _conversationId: string,
    _conversations: Array<{
      id: string;
      flowId: string;
      status: 'active' | 'ended';
      messages: any[];
      session_id?: string;
    }>,
    _setActiveId: (id: string | null) => void,
    _setMessages: (msgs: ChatMessage[]) => void,
    _setQuickReplies: (qr: any[]) => void,
    _updatePlaceholder: (flowId: string, replies: any[]) => void,
    _setActiveNodeId?: (id: string | null) => void
  ) => {};

  return { switchConversation } as const;
}

export default useConversationSwitcher;

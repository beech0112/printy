/**
 * useRecentChatSessions
 *
 * ⚠️ DEPRECATED: This hook is now a no-op and should be removed from all components.
 *
 * Sessions are automatically loaded by SessionCacheProvider at CustomerRoot level.
 * All session data is available via CustomerConversationsContext.
 *
 * Migration:
 * - REMOVE calls to useRecentChatSessions(setConversations)
 * - Sessions automatically available via useCustomerConversationsContext()
 *
 * @deprecated Since 2025-10-26 - Will be removed in future version
 */
import { useEffect } from 'react';
import { getUserSessions } from '@features/chat/api/sessionQueries';
import { auth } from '@lib/supabase';

export interface ConversationLike {
  id: string;
  title: string;
  createdAt: number;
  messages: any[];
  flowId: string;
  status: 'active' | 'ended';
  icon?: React.ReactNode;
}

export function useRecentChatSessions(
  setConversations: (
    updater: (prev: ConversationLike[]) => ConversationLike[]
  ) => void
) {
  useEffect(() => {
    const loadRecentSessions = async () => {
      try {
        const { data: userData } = await auth.getUser();
        if (!userData?.user?.id) return;

        const sessions = await getUserSessions(userData.user.id);

        if (sessions && sessions.length > 0) {
          const mapped: ConversationLike[] = sessions.slice(0, 10).map(s => {
            const displayId =
              s.inquiry?.display_id ||
              s.quote?.display_id ||
              s.order?.display_id;

            return {
              id: s.sessionId,
              title: displayId || s.sessionId,
              createdAt: s.createdAt,
              messages: [],
              flowId: s.flowId,
              status: 'active',
              icon: undefined,
            };
          });

          setConversations(prev => {
            const existingIds = new Set(prev.map(c => c.id));
            const add = mapped.filter(c => !existingIds.has(c.id));
            return [...add, ...prev].sort((a, b) => b.createdAt - a.createdAt);
          });
        }
      } catch (error) {
        console.error('Failed to load recent chat sessions:', error);
      }
    };
    loadRecentSessions();
  }, [setConversations]);
}

export default useRecentChatSessions;

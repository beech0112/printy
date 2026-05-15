import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import type { ChatMessage } from '@features/chat/types/chat';

export type AdminChatRole = 'user' | 'printy';

export interface AdminChatMessage {
  id: string;
  role: AdminChatRole;
  text: string;
  ts: number;
}

export interface AdminConversation {
  id: string;
  title: string;
  createdAt: number;
  endedAt?: number; // When the chat ended (for ended chats)
  messages: AdminChatMessage[];
  status: 'active' | 'ended';
  icon?: React.ReactNode;
  flowId?: string;
  sessionId?: string; // Database session ID for admin chats
}

interface AdminConversationsContextValue {
  conversations: AdminConversation[];
  activeId: string | null;
  startConversation: (title: string) => string; // returns id
  addMessage: (role: AdminChatRole, text: string, id?: string) => void;
  endConversation: (id?: string) => void;
  setActive: (id: string | null) => void;
  clear: () => void;
  setConversations: React.Dispatch<React.SetStateAction<AdminConversation[]>>;
  loadAdminChatSessions: () => Promise<void>;
  loadMoreAdminChatSessions: () => Promise<void>;
  loadAllAdminChatSessions: () => Promise<void>;
  loadHistoricalMessages: (sessionId: string) => Promise<ChatMessage[]>;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  totalCount: number;
}

const AdminConversationsContext = createContext<
  AdminConversationsContextValue | undefined
>(undefined);

export const AdminConversationsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const loadedPagesRef = useRef<Set<number>>(new Set());
  const loadedDbIdsRef = useRef<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  const adminIdRef = useRef<string | null>(null);

  const fetchSessions = useCallback(
    async (_page: number, replace: boolean = true) => {
      // Admin chat sessions are stateless — no DB records to load.
      // In-session conversations are held in component state only.
      if (replace) {
        setLoading(false);
        setHasMore(false);
        setTotalCount(0);
      }
    },
    []
  );

  const loadAdminChatSessions = useCallback(async () => {
    await fetchSessions(1, true);
  }, [fetchSessions]);

  const loadMoreAdminChatSessions = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    const nextPage = currentPage + 1;
    if (loadedPagesRef.current.has(nextPage)) return;
    await fetchSessions(nextPage, false);
  }, [currentPage, fetchSessions, hasMore, loading, loadingMore]);

  const loadAllAdminChatSessions = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    for (let page = currentPage + 1; page <= totalPages; page += 1) {
      if (loadedPagesRef.current.has(page)) continue;
      await fetchSessions(page, false);
    }
  }, [currentPage, fetchSessions, hasMore, loading, loadingMore, totalCount]);

  // Historical messages are stored in inquiries.ai_context; not exposed here.
  const loadHistoricalMessages = async (
    _sessionId: string
  ): Promise<ChatMessage[]> => {
    return [];
  };

  // Load sessions on mount
  useEffect(() => {
    void loadAdminChatSessions();
  }, [loadAdminChatSessions]);

  const startConversation = (title: string) => {
    const id = crypto.randomUUID();
    const conv: AdminConversation = {
      id,
      title,
      createdAt: Date.now(),
      messages: [],
      status: 'active',
    };
    setConversations(prev => [conv, ...prev]);
    setActiveId(id);
    return id;
  };

  const addMessage = (role: AdminChatRole, text: string, id?: string) => {
    const targetId = id || activeId;
    if (!targetId) return;
    const msg: AdminChatMessage = {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role,
      text,
      ts: Date.now(),
    };
    setConversations(prev =>
      prev.map(c =>
        c.id === targetId ? { ...c, messages: [...c.messages, msg] } : c
      )
    );
  };

  const endConversation = (id?: string) => {
    const targetId = id || activeId;
    if (!targetId) return;
    setConversations(prev =>
      prev.map(c => (c.id === targetId ? { ...c, status: 'ended' } : c))
    );
  };

  const clear = () => setConversations([]);

  const value = useMemo<AdminConversationsContextValue>(
    () => ({
      conversations,
      activeId,
      startConversation,
      addMessage,
      endConversation,
      setActive: setActiveId,
      clear,
      setConversations,
      loadAdminChatSessions,
      loadMoreAdminChatSessions,
      loadAllAdminChatSessions,
      loadHistoricalMessages,
      loading,
      loadingMore,
      hasMore,
      totalCount,
    }),
    [
      conversations,
      activeId,
      loadAdminChatSessions,
      loadMoreAdminChatSessions,
      loadAllAdminChatSessions,
      loading,
      loadingMore,
      hasMore,
      loadHistoricalMessages,
      totalCount,
    ]
  );

  return (
    <AdminConversationsContext.Provider value={value}>
      {children}
    </AdminConversationsContext.Provider>
  );
};

export const useAdminConversations = () => {
  const ctx = useContext(AdminConversationsContext);
  if (!ctx)
    throw new Error(
      'useAdminConversations must be used within AdminConversationsProvider'
    );
  return ctx;
};

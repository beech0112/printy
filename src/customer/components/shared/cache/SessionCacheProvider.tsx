import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@lib/supabase';
import type { ConversationItem } from '@features/chat/hooks/shared/useConversationState';

interface SessionCacheContextValue {
  sessions: ConversationItem[];
  loading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  refetch: () => void;
  addSession: (session: ConversationItem) => void;
  updateSession: (
    sessionId: string,
    updates: Partial<ConversationItem>
  ) => void;
  loadMore: () => void;
  hasMore: boolean;
}

const SessionCacheContext = createContext<SessionCacheContextValue | null>(
  null
);

interface SessionCacheProviderProps {
  children: ReactNode;
  customerId?: string;
}

const INQUIRY_SELECT = `
  id,
  display_id,
  profile_id,
  type,
  status,
  subject,
  created_at,
  updated_at,
  resolved_at,
  quotes(id, display_id, status, quoted_price, updated_at),
  orders(id, display_id, status, updated_at)
`.trim();

function mapInquiryToConversation(row: any): ConversationItem {
  const quote = Array.isArray(row.quotes) ? row.quotes[0] : row.quotes;
  const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;

  const createdAt = new Date(row.created_at).getTime();

  const timestamps: number[] = [createdAt];
  if (row.updated_at) timestamps.push(new Date(row.updated_at).getTime());
  if (row.resolved_at) timestamps.push(new Date(row.resolved_at).getTime());
  if (quote?.updated_at) timestamps.push(new Date(quote.updated_at).getTime());
  if (order?.updated_at) timestamps.push(new Date(order.updated_at).getTime());
  const updatedAt = Math.max(...timestamps);

  const displayId =
    row.display_id ||
    quote?.display_id ||
    order?.display_id;

  const title = row.subject || displayId || row.id.substring(0, 8).toUpperCase();

  return {
    id: row.id,
    title,
    createdAt,
    updatedAt,
    messages: [],
    flowId: row.type || 'inquiry',
    status: row.status === 'resolved' || row.status === 'closed' ? 'ended' : 'active',
    icon: undefined,
    context: {
      inquiryId: row.id,
      displayId,
      quoteId: quote?.id,
      orderId: order?.id,
    },
  };
}

export const SessionCacheProvider: React.FC<SessionCacheProviderProps> = ({
  children,
  customerId,
}) => {
  const [sessions, setSessions] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const sessionsRef = useRef<ConversationItem[]>([]);

  const PAGE_SIZE = 50;

  const sortSessions = useCallback((list: ConversationItem[]) => {
    return [...list].sort((a, b) => {
      const aTs = a.updatedAt ?? a.createdAt;
      const bTs = b.updatedAt ?? b.createdAt;
      return bTs - aTs;
    });
  }, []);

  const replaceSessions = useCallback(
    (nextSessions: ConversationItem[]) => {
      const sorted = sortSessions(nextSessions);
      sessionsRef.current = sorted;
      setSessions(sorted);
    },
    [sortSessions]
  );

  const updateSessionsList = useCallback(
    (updater: (prev: ConversationItem[]) => ConversationItem[]) => {
      setSessions(prev => {
        const next = sortSessions(updater(prev));
        sessionsRef.current = next;
        return next;
      });
    },
    [sortSessions]
  );

  const fetchSingleSession = useCallback(
    async (inquiryId: string): Promise<ConversationItem | null> => {
      try {
        const { data, error: fetchError } = await supabase
          .from('inquiries')
          .select(INQUIRY_SELECT)
          .eq('id', inquiryId)
          .single();

        if (fetchError || !data) {
          console.error('Error fetching single inquiry:', fetchError);
          return null;
        }

        return mapInquiryToConversation(data);
      } catch (err) {
        console.error('Failed to fetch single inquiry:', err);
        return null;
      }
    },
    []
  );

  const loadSessions = useCallback(
    async ({ reset }: { reset: boolean }) => {
      if (!customerId) return;

      if (reset) {
        setLoading(true);
        setIsLoadingMore(false);
        setHasMore(true);
      } else {
        setIsLoadingMore(true);
      }

      setError(null);

      const currentOffset = reset ? 0 : sessionsRef.current.length;
      const rangeFrom = currentOffset;
      const rangeTo = currentOffset + PAGE_SIZE - 1;

      try {
        const { data, error: fetchError } = await supabase
          .from('inquiries')
          .select(INQUIRY_SELECT)
          .eq('profile_id', customerId)
          .order('created_at', { ascending: false })
          .range(rangeFrom, rangeTo);

        if (fetchError) {
          console.error('Error loading inquiries:', fetchError);
          setError(fetchError.message);
          return;
        }

        const processed: ConversationItem[] = (data || []).map(
          mapInquiryToConversation
        );

        if (reset) {
          replaceSessions(processed);
        } else if (processed.length > 0) {
          updateSessionsList(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const appended = processed.filter(s => !existingIds.has(s.id));
            if (appended.length === 0) return prev;
            return [...prev, ...appended];
          });
        }

        setHasMore((data?.length ?? 0) === PAGE_SIZE);
      } catch (err) {
        console.error('Failed to load inquiries:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (reset) {
          setLoading(false);
        } else {
          setIsLoadingMore(false);
        }
      }
    },
    [customerId, replaceSessions, updateSessionsList]
  );

  useEffect(() => {
    if (customerId) {
      void loadSessions({ reset: true });
    }
  }, [customerId, loadSessions]);

  // Real-time subscription for inquiries changes
  useEffect(() => {
    if (!customerId) return;

    const channel = supabase
      .channel(`inquiries-cache-${customerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inquiries',
          filter: `profile_id=eq.${customerId}`,
        },
        async payload => {
          const inquiryId =
            (payload.new as any)?.id || (payload.old as any)?.id;

          if (!inquiryId) return;

          if (payload.eventType === 'DELETE') {
            updateSessionsList(prev => prev.filter(s => s.id !== inquiryId));
            return;
          }

          if (payload.eventType === 'INSERT') {
            const newSession = await fetchSingleSession(inquiryId);
            if (newSession) {
              updateSessionsList(prev => {
                const without = prev.filter(s => s.id !== inquiryId);
                return [newSession, ...without];
              });
            } else {
              void loadSessions({ reset: true });
            }
            return;
          }

          if (payload.eventType === 'UPDATE') {
            const updatedSession = await fetchSingleSession(inquiryId);
            if (updatedSession) {
              updateSessionsList(prev => {
                const found = prev.some(s => s.id === inquiryId);
                if (!found) return [updatedSession, ...prev];
                return prev.map(s =>
                  s.id === inquiryId ? updatedSession : s
                );
              });
            } else {
              updateSessionsList(prev => prev.filter(s => s.id !== inquiryId));
            }
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [customerId, fetchSingleSession, loadSessions, updateSessionsList]);

  const refetch = () => {
    void loadSessions({ reset: true });
  };

  const loadMore = () => {
    if (loading || isLoadingMore || !hasMore) return;
    void loadSessions({ reset: false });
  };

  const addSession = (newSession: ConversationItem) => {
    updateSessionsList(prev => {
      const without = prev.filter(s => s.id !== newSession.id);
      return [newSession, ...without];
    });
  };

  const updateSession = (
    sessionId: string,
    updates: Partial<ConversationItem>
  ) => {
    updateSessionsList(prev =>
      prev.map(s => (s.id === sessionId ? { ...s, ...updates } : s))
    );
  };

  const value: SessionCacheContextValue = {
    sessions,
    loading,
    isLoadingMore,
    error,
    refetch,
    addSession,
    updateSession,
    loadMore,
    hasMore,
  };

  return (
    <SessionCacheContext.Provider value={value}>
      {children}
    </SessionCacheContext.Provider>
  );
};

export const useSessionCache = (): SessionCacheContextValue => {
  const context = useContext(SessionCacheContext);
  if (!context) {
    throw new Error(
      'useSessionCache must be used within a SessionCacheProvider'
    );
  }
  return context;
};

// Custom hook to automatically set up session cache for customer components
export const useCustomerSessionCache = (customerId?: string) => {
  const sessionCache = useSessionCache();

  const customerSessions = customerId
    ? sessionCache.sessions.filter(
        session => session.context?.orderId || session.flowId !== 'about'
      )
    : sessionCache.sessions;

  return {
    ...sessionCache,
    sessions: customerSessions,
  };
};

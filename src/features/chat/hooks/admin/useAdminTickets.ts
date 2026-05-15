import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { supabase } from '@lib/supabase';

export type AdminTicketRow = {
  inquiry_id: string;
  display_id?: string | null;
  inquiry_status: string | null;
  subject: string | null;
  body: string | null;
  customer_id: string | null;
  received_at: string | null;
  updated_at: string | null;
  resolved_at?: string | null;
  customer_full_name?: string | null;
  customer_first_name?: string | null;
  customer_last_name?: string | null;
  customer_type?: string | null;
  updated_by?: string | null;
  // legacy stubs (kept for TicketsCard compat)
  inquiry_type: string | null;
  order_id: string | null;
  session_id: string | null;
};

type LoadInquiriesOptions = {
  pageSize?: number;
  useAdvancedFallbacks?: boolean;
};

const DEFAULT_PAGE_SIZE = 25;

const SELECT = `
  id,
  display_id,
  profile_id,
  subject,
  body,
  status,
  created_at,
  updated_at,
  resolved_at,
  updated_by,
  profiles:profile_id(first_name, last_name, email, customer_type)
`.trim();

const normalizeRow = (row: any): AdminTicketRow => {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const first = profile?.first_name || '';
  const last = profile?.last_name || '';
  const full = `${first} ${last}`.trim() || null;

  return {
    inquiry_id: row.id,
    display_id: row.display_id ?? null,
    inquiry_status: row.status ?? null,
    subject: row.subject ?? null,
    body: row.body ?? null,
    customer_id: row.profile_id ?? null,
    received_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    resolved_at: row.resolved_at ?? null,
    customer_full_name: full,
    customer_first_name: first || null,
    customer_last_name: last || null,
    customer_type: profile?.customer_type ?? null,
    updated_by: row.updated_by ?? null,
    inquiry_type: null,
    order_id: null,
    session_id: null,
  };
};

export function useAdminTickets(options: LoadInquiriesOptions = {}) {
  const { pageSize = DEFAULT_PAGE_SIZE } = options;

  const [tickets, setTickets] = useState<AdminTicketRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const loadedPagesRef = useRef<Set<number>>(new Set());

  const fetchPage = useCallback(
    async (page: number, replace: boolean = page === 1) => {
      const from = (page - 1) * pageSize;
      if (replace) setLoading(true);
      else { if (loadingMore) return; setLoadingMore(true); }
      setError(null);

      try {
        const { data, error: err, count } = await supabase
          .from('inquiries')
          .select(SELECT, { count: 'exact' })
          .order('updated_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (err) throw err;

        const normalized = (data || []).map(normalizeRow);
        setTotalCount(count || 0);
        loadedPagesRef.current.add(page);

        if (replace) {
          setTickets(normalized);
          if (!activeId && normalized.length > 0) setActiveId(normalized[0].inquiry_id);
        } else {
          setTickets(prev => {
            const merged = [...prev];
            for (const row of normalized) {
              const i = merged.findIndex(t => t.inquiry_id === row.inquiry_id);
              if (i >= 0) merged[i] = row;
              else merged.push(row);
            }
            return merged.sort(
              (a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
            );
          });
        }
      } catch (e: any) {
        setError('Unable to load inquiries.');
        if (replace) setTickets([]);
      } finally {
        if (replace) setLoading(false);
        else setLoadingMore(false);
      }
    },
    [pageSize, activeId, loadingMore]
  );

  useEffect(() => {
    loadedPagesRef.current.clear();
    void fetchPage(1, true);
    setCurrentPage(1);
  }, [fetchPage]);

  // Realtime
  useEffect(() => {
    const fetchAndMerge = async (id: string) => {
      const { data } = await supabase.from('inquiries').select(SELECT).eq('id', id).single();
      if (!data) return;
      const normalized = normalizeRow(data);
      setTickets(prev => {
        const i = prev.findIndex(t => t.inquiry_id === id);
        if (i >= 0) { const next = [...prev]; next[i] = normalized; return next; }
        return [normalized, ...prev].sort(
          (a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
        );
      });
    };

    const channel = supabase
      .channel('admin-inquiries-ticket-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inquiries' }, async payload => {
        const id = (payload.new as any)?.id || (payload.old as any)?.id;
        if (!id) return;
        if (payload.eventType === 'DELETE') {
          setTickets(prev => prev.filter(t => t.inquiry_id !== id));
          return;
        }
        await fetchAndMerge(id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const active = useMemo(
    () => tickets.find(t => t.inquiry_id === activeId) || null,
    [tickets, activeId]
  );

  const hasMore = useMemo(() => totalCount > tickets.length, [totalCount, tickets.length]);

  return {
    tickets,
    active,
    activeId,
    setActiveId,
    loading,
    error,
    hasMore,
    totalCount,
    loadingMore,
    loadingAll,
    loadMore: async () => {
      if (!hasMore || loadingMore) return;
      const next = currentPage + 1;
      if (loadedPagesRef.current.has(next)) return;
      await fetchPage(next, false);
      setCurrentPage(next);
    },
    loadAll: async () => {
      if (loadingAll || !hasMore) return;
      setLoadingAll(true);
      try {
        const totalPages = Math.ceil(totalCount / pageSize);
        for (let p = 1; p <= totalPages; p++) {
          if (loadedPagesRef.current.has(p)) continue;
          await fetchPage(p, false);
        }
      } finally { setLoadingAll(false); }
    },
    reload: () => {
      loadedPagesRef.current.clear();
      void fetchPage(1, true);
      setCurrentPage(1);
    },
  };
}

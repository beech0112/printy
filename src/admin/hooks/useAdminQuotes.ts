/**
 * useAdminQuotes
 * Fetches inquiries (quote requests) from Supabase for admin view.
 * Inquiries are the customer-submitted requests; quotes are the admin proposals.
 * Admin sees inquiries + their linked quotes/proposals.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@lib/supabase';

export interface AdminQuoteRow {
  id: string;
  display_id: string;
  customer_id: string;
  customer_name: string;
  customer_email?: string;
  customer_type?: string;
  subject: string;
  status: string;
  quoted_amount: string;
  created_at: string;
  updated_at: string;
  accepted_at?: string | null;
  session_id?: string | null;
  updated_by?: string | null;
  ended_at?: string | null;
  // legacy compat
  customer: string;
  total: string;
  date: string;
  product_name: string;
}

const DEFAULT_PAGE_SIZE = 25;

const normalizeRow = (row: any): AdminQuoteRow => {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const firstName = profile?.first_name || '';
  const lastName = profile?.last_name || '';
  const customerName = `${firstName} ${lastName}`.trim() || profile?.email || row.profile_id;

  const quotes = Array.isArray(row.quotes) ? row.quotes : [];
  const latestQuote = quotes.find((q: any) => q.quoted_price != null) || quotes[0];
  const quotedAmount = latestQuote?.quoted_price != null
    ? `₱${Number(latestQuote.quoted_price).toLocaleString()}`
    : 'Not quoted';

  return {
    id: row.id,
    display_id: row.display_id || row.id,
    customer_id: row.profile_id,
    customer_name: customerName,
    customer_email: profile?.email,
    customer_type: profile?.customer_type,
    subject: row.subject || '',
    status: row.status,
    quoted_amount: quotedAmount,
    created_at: row.created_at,
    updated_at: row.updated_at,
    customer: customerName,
    total: quotedAmount,
    date: new Date(row.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    product_name: row.subject || 'Quote Request',
  };
};

const SELECT = `
  id,
  display_id,
  profile_id,
  subject,
  status,
  created_at,
  updated_at,
  profiles:profile_id(first_name, last_name, email, customer_type),
  quotes(
    id,
    status,
    quoted_price,
    admin_notes,
    proposal_sent_at
  )
`.trim();

export function useAdminQuotes(pageSize: number = DEFAULT_PAGE_SIZE) {
  const [quotes, setQuotes] = useState<AdminQuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadedPagesRef = useRef<Set<number>>(new Set());

  const fetchPage = useCallback(
    async (page: number, replaceExisting: boolean = page === 1) => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      if (replaceExisting) setLoading(true);
      else setLoadingMore(true);

      try {
        const { data, error: err, count } = await supabase
          .from('inquiries')
          .select(SELECT, { count: 'exact' })
          .order('updated_at', { ascending: false })
          .range(from, to);

        if (err) { setError(err.message); return; }

        const normalized = (data || []).map(normalizeRow);
        setTotalCount(count || 0);
        loadedPagesRef.current.add(page);

        setQuotes(prev => {
          if (replaceExisting) return normalized;
          const merged = [...prev];
          for (const row of normalized) {
            const i = merged.findIndex(q => q.id === row.id);
            if (i >= 0) merged[i] = row;
            else merged.push(row);
          }
          return merged.sort(
            (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
        });
      } catch (e: any) {
        setError(e?.message || 'Unknown error');
      } finally {
        if (replaceExisting) setLoading(false);
        else setLoadingMore(false);
      }
    },
    [pageSize]
  );

  const loadInitial = useCallback(async () => {
    loadedPagesRef.current.clear();
    await fetchPage(1, true);
    setCurrentPage(1);
  }, [fetchPage]);

  useEffect(() => { void loadInitial(); }, [loadInitial]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('admin-inquiries-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inquiries' }, async payload => {
        const id = (payload.new as any)?.id || (payload.old as any)?.id;
        if (!id) return;
        if (payload.eventType === 'DELETE') {
          setQuotes(prev => prev.filter(q => q.id !== id));
          setTotalCount(prev => Math.max(0, prev - 1));
          return;
        }
        const { data } = await supabase.from('inquiries').select(SELECT).eq('id', id).single();
        if (!data) return;
        const normalized = normalizeRow(data);
        setQuotes(prev => {
          const i = prev.findIndex(q => q.id === id);
          if (i >= 0) { const next = [...prev]; next[i] = normalized; return next; }
          if (payload.eventType === 'INSERT') setTotalCount(c => c + 1);
          return [normalized, ...prev];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const hasMore = totalCount > quotes.length;

  const loadMore = useCallback(async () => {
    if (loadingAll || loadingMore || !hasMore) return;
    const next = currentPage + 1;
    if (loadedPagesRef.current.has(next)) return;
    await fetchPage(next, false);
    setCurrentPage(next);
  }, [currentPage, fetchPage, hasMore, loadingAll, loadingMore]);

  const loadAll = useCallback(async () => {
    if (loadingAll || !hasMore) return;
    setLoadingAll(true);
    try {
      const totalPages = Math.ceil(totalCount / pageSize);
      for (let p = currentPage + 1; p <= totalPages; p++) {
        if (loadedPagesRef.current.has(p)) continue;
        await fetchPage(p, false);
      }
    } finally { setLoadingAll(false); }
  }, [currentPage, fetchPage, hasMore, loadingAll, pageSize, totalCount]);

  const refresh = useCallback(() => { void loadInitial(); }, [loadInitial]);

  return { quotes, loading, error, totalCount, hasMore, loadMore, loadAll, loadingAll, loadingMore, refresh };
}

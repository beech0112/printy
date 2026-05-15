/**
 * useAdminOrders
 * Fetches all orders from Supabase orders table for admin view.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@lib/supabase';

export interface AdminOrderRow {
  id: string;
  order_id: string;
  display_id: string;
  customer_id: string;
  customer_name: string;
  customer_type: string;
  product_name: string;
  total_amount: string;
  status: string;
  payment_status: string;
  created_at: string;
  updated_at: string;
  updated_by?: string | null;
  completed_at?: string | null;
  // legacy compat
  customer: string;
  total: string;
  date: string;
  proofOfPaymentUrl?: string;
}

const DEFAULT_PAGE_SIZE = 25;

const SELECT = `
  id,
  display_id,
  profile_id,
  status,
  payment_status,
  total_amount,
  proof_files,
  created_at,
  updated_at,
  updated_by,
  profiles:profile_id(first_name, last_name, email, customer_type),
  inquiries:inquiry_id(subject)
`.trim();

const normalizeRow = (order: any): AdminOrderRow => {
  const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
  const firstName = profile?.first_name || '';
  const lastName = profile?.last_name || '';
  const customerName = `${firstName} ${lastName}`.trim() || profile?.email || order.profile_id;

  const inquiry = Array.isArray(order.inquiries) ? order.inquiries[0] : order.inquiries;
  const productName = inquiry?.subject || `Order ${order.display_id || order.id}`;

  const proofFiles: string[] = order.proof_files || [];

  return {
    id: order.id,
    order_id: order.id,
    display_id: order.display_id || order.id,
    customer_id: order.profile_id,
    customer_name: customerName,
    customer_type: profile?.customer_type || 'regular',
    product_name: productName,
    total_amount: `₱${Number(order.total_amount || 0).toLocaleString()}`,
    status: order.status,
    payment_status: order.payment_status || 'pending',
    created_at: order.created_at,
    updated_at: order.updated_at,
    updated_by: order.updated_by || null,
    customer: customerName,
    total: `₱${Number(order.total_amount || 0).toLocaleString()}`,
    date: new Date(order.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    proofOfPaymentUrl: proofFiles[0] || undefined,
  };
};

export function useAdminOrders(pageSize: number = DEFAULT_PAGE_SIZE) {
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const loadedPagesRef = useRef<Set<number>>(new Set());

  const fetchPage = useCallback(
    async (page: number, replaceExisting: boolean = page === 1) => {
      const from = (page - 1) * pageSize;
      if (replaceExisting) setLoading(true);
      else setLoadingMore(true);

      try {
        const { data, error: err, count } = await supabase
          .from('orders')
          .select(SELECT, { count: 'exact' })
          .order('updated_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (err) { setError(err.message); return; }

        const normalized = (data || []).map(normalizeRow);
        setTotalCount(count || 0);
        loadedPagesRef.current.add(page);

        setOrders(prev => {
          if (replaceExisting) return normalized;
          const merged = [...prev];
          for (const row of normalized) {
            const i = merged.findIndex(o => o.id === row.id);
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

  useEffect(() => {
    loadedPagesRef.current.clear();
    void fetchPage(1, true);
    setCurrentPage(1);
  }, [fetchPage]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async payload => {
        const id = (payload.new as any)?.id || (payload.old as any)?.id;
        if (!id) return;
        if (payload.eventType === 'DELETE') {
          setOrders(prev => prev.filter(o => o.id !== id));
          setTotalCount(prev => Math.max(0, prev - 1));
          return;
        }
        const { data } = await supabase.from('orders').select(SELECT).eq('id', id).single();
        if (!data) return;
        const normalized = normalizeRow(data);
        setOrders(prev => {
          const i = prev.findIndex(o => o.id === id);
          if (i >= 0) { const next = [...prev]; next[i] = normalized; return next; }
          if (payload.eventType === 'INSERT') setTotalCount(c => c + 1);
          return [normalized, ...prev];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const refresh = useCallback(() => {
    loadedPagesRef.current.clear();
    void fetchPage(1, true);
    setCurrentPage(1);
  }, [fetchPage]);

  const hasMore = totalCount > orders.length;

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    const next = currentPage + 1;
    if (loadedPagesRef.current.has(next)) return;
    await fetchPage(next, false);
    setCurrentPage(next);
  }, [currentPage, fetchPage, hasMore, loadingMore]);

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

  return { orders, loading, error, totalCount, hasMore, loadMore, loadAll, loadingMore, loadingAll, refresh };
}

export default useAdminOrders;

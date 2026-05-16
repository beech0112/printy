/**
 * useRecentOrder
 * Fetches the latest order for the current user.
 */
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@lib/supabase';
import { formatCurrency } from '@shared/utils/priceFormatter';
import type { RecentOrder } from '@shared/types/customer';

export type RecentOrderData = RecentOrder;

const ORDER_SELECT = `
  id,
  display_id,
  status,
  payment_status,
  created_at,
  updated_at,
  total_amount
`.trim();

export function useRecentOrder() {
  const [data, setData] = useState<RecentOrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const dataRef = useRef<RecentOrderData | null>(null);

  const normalizeOrder = (rawData: any): RecentOrderData => {
    let total: string | undefined = undefined;
    if (rawData.total_amount) {
      total = formatCurrency(Number(rawData.total_amount));
    }

    return {
      id: rawData.id,
      displayId: rawData.display_id,
      title: 'Order',
      status: rawData.status || 'unknown',
      createdAt: new Date(rawData.created_at).getTime(),
      updatedAt: new Date(rawData.updated_at).getTime(),
      paymentVerifiedAt: undefined,
      completedAt: undefined,
      total,
    };
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }
        setUserId(user.id);

        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select(ORDER_SELECT)
          .eq('profile_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (orderError) {
          setError(orderError.message);
          setLoading(false);
          return;
        }

        if (orderData) {
          const normalized = normalizeOrder(orderData);
          setData(normalized);
          dataRef.current = normalized;
        } else {
          dataRef.current = null;
        }
      } catch (e: any) {
        setError(e?.message || 'Unknown error');
        dataRef.current = null;
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`orders-customer-recent-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `profile_id=eq.${userId}`,
        },
        async payload => {
          const orderId =
            (payload.new as any)?.id || (payload.old as any)?.id;
          if (!orderId) return;

          try {
            if (payload.eventType === 'DELETE') {
              if (dataRef.current?.id === orderId) {
                const { data: latestData, error: latestError } = await supabase
                  .from('orders')
                  .select(ORDER_SELECT)
                  .eq('profile_id', userId)
                  .order('updated_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (!latestError && latestData) {
                  const normalized = normalizeOrder(latestData);
                  setData(normalized);
                  dataRef.current = normalized;
                } else {
                  setData(null);
                  dataRef.current = null;
                }
              }
              return;
            }

            const { data: fullOrder, error: fetchError } = await supabase
              .from('orders')
              .select(ORDER_SELECT)
              .eq('id', orderId)
              .single();

            if (fetchError || !fullOrder) {
              console.error('[useRecentOrder] Error fetching updated order:', fetchError);
              return;
            }

            const normalizedOrder = normalizeOrder(fullOrder);
            const currentOrder = dataRef.current;

            const shouldUpdate =
              !currentOrder ||
              currentOrder.id === orderId ||
              normalizedOrder.updatedAt > currentOrder.updatedAt;

            if (shouldUpdate) {
              setData(normalizedOrder);
              dataRef.current = normalizedOrder;
            }
          } catch (e) {
            console.error('[useRecentOrder] Error processing realtime update:', e);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { data, loading, error } as const;
}

export default useRecentOrder;

/**
 * useRecentQuote
 * Fetches the latest quote for the current user using admin real-time patterns.
 */
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@lib/supabase';
import { formatCurrency } from '@shared/utils/priceFormatter';
import type { RecentQuote } from '@shared/types/customer';

const QUOTE_SELECT = `
  id,
  display_id,
  status,
  quoted_price,
  accepted_at,
  rejected_at,
  created_at,
  updated_at
`.trim();

export function useRecentQuote(customerId?: string) {
  const [data, setData] = useState<RecentQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const dataRef = useRef<RecentQuote | null>(null);

  // Fetch user ID if customerId is not provided
  useEffect(() => {
    const fetchUserId = async () => {
      try {
        if (customerId) {
          setUserId(customerId);
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
        }
      } catch (e) {
        console.error('[useRecentQuote] Error fetching user:', e);
      }
    };

    fetchUserId();
  }, [customerId]);

  // Normalization function
  const normalizeQuote = (rawData: any): RecentQuote => {
    const quotedPrice = rawData.quoted_price;
    const formattedPrice =
      quotedPrice != null ? formatCurrency(Number(quotedPrice)) : undefined;

    const createdAt = new Date(rawData.created_at).getTime();
    const updatedAt = rawData.updated_at
      ? new Date(rawData.updated_at).getTime()
      : createdAt;

    const acceptedAt =
      rawData.status === 'accepted' && rawData.accepted_at
        ? new Date(rawData.accepted_at).getTime()
        : undefined;
    const rejectedAt =
      rawData.status === 'rejected' && rawData.rejected_at
        ? new Date(rawData.rejected_at).getTime()
        : undefined;

    return {
      id: rawData.id,
      displayId: rawData.display_id || rawData.id.slice(0, 8).toUpperCase(),
      status: rawData.status as any,
      quotedPrice: formattedPrice,
      createdAt,
      updatedAt,
      acceptedAt,
      rejectedAt,
    };
  };

  // Fetch initial recent quote
  useEffect(() => {
    const loadRecentQuote = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const { data: quoteData, error: quoteError } = await supabase
          .from('quotes')
          .select(QUOTE_SELECT)
          .eq('profile_id', userId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (quoteError) {
          setError(quoteError.message);
          setLoading(false);
          return;
        }

        if (quoteData) {
          const normalizedQuote = normalizeQuote(quoteData);
          setData(normalizedQuote);
          dataRef.current = normalizedQuote;
        } else {
          dataRef.current = null;
        }

        setError(null);
      } catch (err) {
        console.error('Error loading recent quote:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load recent quote'
        );
        dataRef.current = null;
      } finally {
        setLoading(false);
      }
    };

    loadRecentQuote();
  }, [userId]);

  // Update ref whenever data changes
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Real-time subscription for quotes changes
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('quotes-customer-recent')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotes',
          filter: `profile_id=eq.${userId}`,
        },
        async payload => {
          const quoteId =
            (payload.new as any)?.id || (payload.old as any)?.id;
          if (!quoteId) return;

          try {
            if (payload.eventType === 'DELETE') {
              if (dataRef.current?.id === quoteId) {
                const { data: latestData, error: latestError } = await supabase
                  .from('quotes')
                  .select(QUOTE_SELECT)
                  .eq('profile_id', userId)
                  .order('updated_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (!latestError && latestData) {
                  const normalizedQuote = normalizeQuote(latestData);
                  setData(normalizedQuote);
                  dataRef.current = normalizedQuote;
                } else {
                  setData(null);
                  dataRef.current = null;
                }
              }
              return;
            }

            const { data: fullQuote, error: fetchError } = await supabase
              .from('quotes')
              .select(QUOTE_SELECT)
              .eq('id', quoteId)
              .single();

            if (fetchError || !fullQuote) {
              console.error(
                '[useRecentQuote] Error fetching updated quote:',
                fetchError
              );
              return;
            }

            const normalizedQuote = normalizeQuote(fullQuote);
            const currentQuote = dataRef.current;

            const shouldUpdate =
              !currentQuote ||
              currentQuote.id === quoteId ||
              normalizedQuote.updatedAt > currentQuote.updatedAt;

            if (shouldUpdate) {
              setData(normalizedQuote);
              dataRef.current = normalizedQuote;
            }
          } catch (e) {
            console.error(
              '[useRecentQuote] Error processing realtime update:',
              e
            );
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

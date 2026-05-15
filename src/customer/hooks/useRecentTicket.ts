/**
 * useRecentTicket
 * Fetches the latest inquiry/ticket for the current user.
 */
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@lib/supabase';
import { formatInquiryType } from '@shared/utils/statusFormatter';
import type { RecentTicket } from '@shared/types/customer';

export type RecentTicketData = RecentTicket;

const TICKET_SELECT = `
  id,
  display_id,
  status,
  type,
  created_at,
  updated_at,
  resolved_at
`.trim();

export function useRecentTicket() {
  const [data, setData] = useState<RecentTicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const dataRef = useRef<RecentTicketData | null>(null);

  const normalizeTicket = (rawData: any): RecentTicketData => {
    const createdAt = new Date(rawData.created_at).getTime();
    const updatedAt = rawData.updated_at
      ? new Date(rawData.updated_at).getTime()
      : createdAt;
    const resolvedAt = rawData.resolved_at
      ? new Date(rawData.resolved_at).getTime()
      : undefined;

    return {
      id: rawData.id,
      displayId: rawData.display_id || rawData.id.slice(0, 8).toUpperCase(),
      subject: formatInquiryType(rawData.type || 'other'),
      status: rawData.status || 'unknown',
      createdAt,
      updatedAt,
      resolvedAt,
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

        const { data: inquiryData, error: inquiryError } = await supabase
          .from('inquiries')
          .select(TICKET_SELECT)
          .eq('profile_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (inquiryError) {
          setError(inquiryError.message);
          setLoading(false);
          return;
        }

        if (inquiryData) {
          const ticketData = normalizeTicket(inquiryData);
          setData(ticketData);
          dataRef.current = ticketData;
        } else {
          dataRef.current = null;
        }
      } catch (e: any) {
        console.error('[useRecentTicket] Initialization error:', e);
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
      .channel(`inquiries-customer-recent-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inquiries',
          filter: `profile_id=eq.${userId}`,
        },
        async payload => {
          const inquiryId =
            (payload.new as any)?.id || (payload.old as any)?.id;
          if (!inquiryId) return;

          try {
            if (payload.eventType === 'DELETE') {
              if (dataRef.current?.id === inquiryId) {
                const { data: latestData, error: latestError } = await supabase
                  .from('inquiries')
                  .select(TICKET_SELECT)
                  .eq('profile_id', userId)
                  .order('updated_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (!latestError && latestData) {
                  const ticketData = normalizeTicket(latestData);
                  setData(ticketData);
                  dataRef.current = ticketData;
                } else {
                  setData(null);
                  dataRef.current = null;
                }
              }
              return;
            }

            const { data: fullTicket, error: fetchError } = await supabase
              .from('inquiries')
              .select(TICKET_SELECT)
              .eq('id', inquiryId)
              .single();

            if (fetchError || !fullTicket) {
              console.error('[useRecentTicket] Error fetching updated ticket:', fetchError);
              return;
            }

            const normalizedTicket = normalizeTicket(fullTicket);
            const currentTicket = dataRef.current;

            const shouldUpdate =
              !currentTicket ||
              currentTicket.id === inquiryId ||
              normalizedTicket.updatedAt > currentTicket.updatedAt;

            if (shouldUpdate) {
              setData(normalizedTicket);
              dataRef.current = normalizedTicket;
            }
          } catch (e) {
            console.error('[useRecentTicket] Error processing realtime update:', e);
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

export default useRecentTicket;

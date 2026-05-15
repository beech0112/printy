/**
 * Unified query functions for conversations (inquiries, quotes, orders).
 *
 * The old chat_sessions_v2 table no longer exists. Conversations are now
 * represented directly as inquiries (type='quote_request' | 'ticket'),
 * with quotes and orders linked via FK.
 */

import { supabase } from '@lib/supabase';

export interface SessionWithRelations {
  sessionId: string;       // maps to inquiry.id
  flowId: string;          // maps to inquiry.type
  status: string;
  createdAt: number;
  inquiry?: {
    inquiry_id: string;
    display_id: string;
    inquiry_type: string;
    inquiry_status: string;
  };
  quote?: {
    quote_id: string;
    display_id: string;
    status: string;
    total_price?: number;
  };
  order?: {
    order_id: string;
    display_id: string;
    status: string;
  };
  type: 'inquiry' | 'quote' | 'general' | 'order';
}

export interface InquiryWithSession {
  inquiry_id: string;
  display_id: string;
  customer_id: string;
  inquiry_type: string;
  inquiry_status: string;
  created_at: string;
  updated_at?: string;
  resolved_at?: string;
  order_id?: string | null;
  // Additional camelCase fields for hooks
  inquiryId: string;
  displayId: string;
  inquiryType: string;
  inquiryStatus: string;
  createdAt: number;
  updatedAt?: number;
  resolvedAt?: number;
  orderId?: string | null;
}

export interface QuoteWithSession {
  quote_id: string;
  display_id: string;
  customer_id: string;
  status: string;
  quoted_price?: number;
  created_at: string;
  updated_at?: string;
  // Additional camelCase fields for hooks
  quoteId: string;
  displayId: string;
  createdAt: number;
  updatedAt?: number;
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

function mapInquiryToSession(row: any): SessionWithRelations {
  const quote = Array.isArray(row.quotes) ? row.quotes[0] : row.quotes;
  const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
  return {
    sessionId: row.id,
    flowId: row.type || 'general',
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    inquiry: {
      inquiry_id: row.id,
      display_id: row.display_id,
      inquiry_type: row.type,
      inquiry_status: row.status,
    },
    quote: quote
      ? {
          quote_id: quote.id,
          display_id: quote.display_id,
          status: quote.status,
          total_price: quote.quoted_price,
        }
      : undefined,
    order: order
      ? { order_id: order.id, display_id: order.display_id, status: order.status }
      : undefined,
    type: order ? 'order' : quote ? 'quote' : 'inquiry',
  };
}

/**
 * Get all inquiries for a user, shaped as SessionWithRelations for backward compat.
 */
export async function getUserSessions(
  userId: string
): Promise<SessionWithRelations[]> {
  const { data, error } = await supabase
    .from('inquiries')
    .select(INQUIRY_SELECT)
    .eq('profile_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch user inquiries:', error);
    return [];
  }

  return (data || []).map(mapInquiryToSession);
}

/**
 * Get an inquiry by ID.
 */
export async function getInquiryWithSession(
  inquiryId: string
): Promise<InquiryWithSession | null> {
  const { data, error } = await supabase
    .from('inquiries')
    .select('id, display_id, profile_id, type, status, created_at, updated_at, resolved_at')
    .eq('id', inquiryId)
    .single();

  if (error || !data) {
    console.error('Failed to fetch inquiry:', error);
    return null;
  }

  const row = data as any;
  return {
    inquiry_id: row.id,
    display_id: row.display_id,
    customer_id: row.profile_id,
    inquiry_type: row.type,
    inquiry_status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    resolved_at: row.resolved_at,
    inquiryId: row.id,
    displayId: row.display_id,
    inquiryType: row.type,
    inquiryStatus: row.status,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : undefined,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).getTime() : undefined,
  };
}

/**
 * Get a quote by ID.
 */
export async function getQuoteWithSession(
  quoteId: string
): Promise<QuoteWithSession | null> {
  const { data, error } = await supabase
    .from('quotes')
    .select('id, display_id, profile_id, status, quoted_price, created_at, updated_at')
    .eq('id', quoteId)
    .single();

  if (error || !data) {
    console.error('Failed to fetch quote:', error);
    return null;
  }

  const row = data as any;
  return {
    quote_id: row.id,
    display_id: row.display_id,
    customer_id: row.profile_id,
    status: row.status,
    quoted_price: row.quoted_price,
    created_at: row.created_at,
    updated_at: row.updated_at,
    quoteId: row.id,
    displayId: row.display_id,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : undefined,
  };
}

/**
 * Get inquiries for a given inquiry ID (returns single-element array for compat).
 */
export async function getSessionsForInquiry(
  inquiryId: string
): Promise<SessionWithRelations[]> {
  const { data, error } = await supabase
    .from('inquiries')
    .select(INQUIRY_SELECT)
    .eq('id', inquiryId);

  if (error) {
    console.error('Failed to fetch inquiry:', error);
    return [];
  }

  return (data || []).map(mapInquiryToSession);
}

/**
 * Get inquiries linked to a quote ID.
 */
export async function getSessionsForQuote(
  quoteId: string
): Promise<SessionWithRelations[]> {
  const { data, error } = await supabase
    .from('inquiries')
    .select(INQUIRY_SELECT)
    .eq('quotes.id', quoteId);

  if (error) {
    console.error('Failed to fetch inquiries for quote:', error);
    return [];
  }

  return (data || []).map(mapInquiryToSession);
}

/**
 * No-op: messages are now in ai_context on inquiries, not a separate table.
 */
export async function getSessionMessages(_sessionId: string) {
  return [];
}

/**
 * No-op: sessions are now inquiries, created by the AI pipeline.
 */
export async function createSessionWithFKs(_params: {
  customerId: string;
  flowId: string;
  inquiryId?: string;
  quoteId?: string;
  metadata?: any;
}): Promise<{ sessionId: string } | null> {
  return null;
}

/**
 * No-op: no session table to link.
 */
export async function linkInquiryToSession(
  _inquiryId: string,
  _sessionId: string
): Promise<boolean> {
  return true;
}

/**
 * No-op: no session table to link.
 */
export async function linkQuoteToSession(
  _quoteId: string,
  _sessionId: string
): Promise<boolean> {
  return true;
}

/**
 * Get all inquiries for admin view.
 */
export async function getAdminInquirySessions(): Promise<SessionWithRelations[]> {
  const { data, error } = await supabase
    .from('inquiries')
    .select(INQUIRY_SELECT)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Failed to fetch admin inquiries:', error);
    return [];
  }

  return (data || []).map(mapInquiryToSession);
}

/**
 * Get customer inquiries (quote_requests and tickets).
 */
export async function getCustomerInquiries(
  customerId: string
): Promise<InquiryWithSession[]> {
  const { data, error } = await supabase
    .from('inquiries')
    .select('id, display_id, profile_id, type, status, subject, created_at, updated_at, resolved_at')
    .eq('profile_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch customer inquiries:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    inquiry_id: row.id,
    display_id: row.display_id,
    customer_id: row.profile_id,
    inquiry_type: row.type,
    inquiry_status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    resolved_at: row.resolved_at,
    inquiryId: row.id,
    displayId: row.display_id,
    inquiryType: row.type,
    inquiryStatus: row.status,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : undefined,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).getTime() : undefined,
  }));
}

/**
 * Get customer quotes.
 */
export async function getCustomerQuotes(
  customerId: string
): Promise<QuoteWithSession[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select('id, display_id, profile_id, status, quoted_price, created_at, updated_at')
    .eq('profile_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch customer quotes:', error);
    return [];
  }

  return (data || []).map((quote: any) => ({
    quote_id: quote.id,
    display_id: quote.display_id,
    customer_id: quote.profile_id,
    status: quote.status,
    quoted_price: quote.quoted_price,
    created_at: quote.created_at,
    updated_at: quote.updated_at,
    quoteId: quote.id,
    displayId: quote.display_id,
    createdAt: new Date(quote.created_at).getTime(),
    updatedAt: quote.updated_at ? new Date(quote.updated_at).getTime() : undefined,
  }));
}

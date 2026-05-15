/**
 * Shared helper functions for fetching and formatting quote details
 *
 * This module consolidates duplicate logic from customer and admin quote detail actions,
 * improving code maintainability and consistency.
 *
 * Performance Note: These helpers also optimize data fetching by reducing redundant queries
 * through proper data structure and field selection.
 */

import { supabase } from '@lib/supabase';

export interface QuoteDetailsData {
  originalRequest: string;
  hasProposal: boolean;
  proposal: {
    proposalId: string;
    specFinal: any;
    quotedPrice: number;
    notes: string;
    createdAt: string;
  } | null;
}

/**
 * Fetch original customer messages from a quote session
 */
export async function fetchOriginalCustomerRequest(
  inquiryId: string
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('inquiries')
      .select('subject, ai_context')
      .eq('id', inquiryId)
      .single();

    if (error || !data) {
      console.error(
        '[fetchOriginalCustomerRequest] Error fetching inquiry:',
        error
      );
      return 'No original request found.';
    }

    const parts: string[] = [];

    if ((data as any).subject) {
      parts.push((data as any).subject);
    }

    const ctx = (data as any).ai_context;
    if (ctx && typeof ctx === 'object' && ctx.customer_message) {
      parts.push(String(ctx.customer_message));
    }

    return parts.length > 0 ? parts.join('\n') : 'No original request found.';
  } catch (error) {
    console.error('[fetchOriginalCustomerRequest] Unexpected error:', error);
    return 'No original request found.';
  }
}

/**
 * Fetch latest proposal for a quote session
 */
export async function fetchLatestProposal(
  inquiryId: string
): Promise<QuoteDetailsData['proposal']> {
  try {
    const { data: quoteRows, error } = await supabase
      .from('quotes')
      .select('id, spec_final, quoted_price, admin_notes, proposal_sent_at')
      .eq('inquiry_id', inquiryId)
      .not('proposal_sent_at', 'is', null)
      .order('proposal_sent_at', { ascending: false })
      .limit(1);

    if (error || !quoteRows || quoteRows.length === 0) {
      return null;
    }

    const q = quoteRows[0];
    return {
      proposalId: q.id,
      specFinal: q.spec_final || {},
      quotedPrice: q.quoted_price,
      notes: q.admin_notes || '',
      createdAt: q.proposal_sent_at,
    };
  } catch (error) {
    console.error('[fetchLatestProposal] Unexpected error:', error);
    return null;
  }
}

/**
 * Fetch complete quote details (original request + latest proposal)
 * This function combines both queries for convenience
 */
export async function fetchCompleteQuoteDetails(
  sessionId: string
): Promise<QuoteDetailsData> {
  const [originalRequest, proposal] = await Promise.all([
    fetchOriginalCustomerRequest(sessionId),
    fetchLatestProposal(sessionId),
  ]);

  return {
    originalRequest,
    hasProposal: proposal !== null,
    proposal,
  };
}

/**
 * Format proposal specifications into a readable text format
 */
type ProposalSpecOptions = {
  includeCategory?: boolean;
};

export function formatProposalSpecs(
  specData: any,
  adminNotes?: string,
  options: ProposalSpecOptions = {}
): string[] {
  const lines: string[] = [];
  const { includeCategory = true } = options;

  if (specData.product_name) {
    lines.push(`• Product: ${specData.product_name}`);
  }

  if (includeCategory && specData.category) {
    lines.push(`• Category: ${specData.category}`);
  }

  if (specData.description) {
    lines.push(`• Description: ${specData.description}`);
  }

  if (specData.size) {
    lines.push(`• Size: ${specData.size}`);
  }

  if (Array.isArray(specData.materials) && specData.materials.length > 0) {
    lines.push(`• Materials: ${specData.materials.join(', ')}`);
  }

  if (specData.color) {
    lines.push(`• Color: ${specData.color}`);
  }

  if (Array.isArray(specData.finishing) && specData.finishing.length > 0) {
    lines.push(`• Finishing: ${specData.finishing.join(', ')}`);
  }

  if (specData.quantity) {
    lines.push(`• Quantity: ${specData.quantity}`);
  }

  if (specData.deadline) {
    lines.push(`• Deadline: ${specData.deadline}`);
  }

  if (specData.delivery_method) {
    lines.push(`• Delivery Method: ${specData.delivery_method}`);
  }

  if (specData.notes) {
    lines.push(`• Notes: ${specData.notes}`);
  }

  if (adminNotes) {
    lines.push(`• Admin Notes: ${adminNotes}`);
  }

  return lines;
}

/**
 * Format complete quote details for customer view
 */
export function formatQuoteDetailsForCustomer(
  quoteDetails: QuoteDetailsData
): string {
  let text = `Your Original Request:\n\n${quoteDetails.originalRequest}`;

  if (quoteDetails.hasProposal && quoteDetails.proposal) {
    const proposalLines = formatProposalSpecs(
      quoteDetails.proposal.specFinal,
      quoteDetails.proposal.notes,
      { includeCategory: false }
    );

    text += '\n\nAdmin Proposal:\n';
    text += proposalLines.join('\n');
    text += `\n\nQuoted Price: ₱${quoteDetails.proposal.quotedPrice}`;
  } else {
    text +=
      '\n\nYour quote request is being reviewed by our admin team. We will send you a detailed proposal with pricing soon.';
  }

  return text;
}

/**
 * Format complete quote details for admin view
 */
export function formatQuoteDetailsForAdmin(
  quoteDetails: QuoteDetailsData
): string {
  let text = `Original Customer Request:\n\n${quoteDetails.originalRequest}`;

  if (quoteDetails.hasProposal && quoteDetails.proposal) {
    const proposalLines = formatProposalSpecs(
      quoteDetails.proposal.specFinal,
      quoteDetails.proposal.notes
    );

    text += '\n\nLatest Draft/Proposal:\n';
    text += proposalLines.join('\n');

    if (quoteDetails.proposal.quotedPrice != null) {
      text += `\n• Quoted Price: ₱${quoteDetails.proposal.quotedPrice}`;
    }
  }

  return text;
}

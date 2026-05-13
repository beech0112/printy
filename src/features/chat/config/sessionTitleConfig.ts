/**
 * Session title helpers.
 * Flow-based title map removed — sessions are now titled by the AI pipeline
 * from the conversation context (inquiry/quote/order display IDs).
 */

function isUUID(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function formatDisplayId(displayId: string): string {
  if (isUUID(displayId)) {
    return `${displayId.substring(0, 8)}...`;
  }
  return displayId;
}

interface SessionTitleParams {
  topic?: string;
  /** @deprecated use topic */
  flowId?: string;
  metadata?: {
    title?: string;
    context?: { display_id?: string; [key: string]: any };
    [key: string]: any;
  };
  inquiry?: { display_id?: string };
  quote?: { display_id?: string };
  order?: { display_id?: string };
}

export function getSessionTitle(params: SessionTitleParams): string {
  const { topic: topicParam, flowId, metadata, inquiry, quote, order } = params;
  const topic = topicParam ?? flowId;

  if (metadata?.title) return metadata.title;

  if (metadata?.context?.display_id) {
    const base = topic || 'Chat';
    return `${base}: ${formatDisplayId(metadata.context.display_id)}`;
  }

  if (quote?.display_id) return `Quote: ${formatDisplayId(quote.display_id)}`;
  if (order?.display_id) return `Order: ${formatDisplayId(order.display_id)}`;
  if (inquiry?.display_id) return `Ticket: ${formatDisplayId(inquiry.display_id)}`;

  return topic || 'Chat';
}

/**
 * AI Tool Definitions
 *
 * Tool schemas passed to the LLM (Ollama/Cohere function calling format).
 * When the LLM decides to call a tool, `llm.ts` executes the handler
 * and feeds the result back as a tool message.
 *
 * Customer tools: get_services, draft_quote_request, check_order_status,
 *   escalate_to_human, create_quote_request, get_my_quotes, get_quote_details,
 *   accept_quote, reject_quote, get_my_orders, create_support_ticket
 *
 * Admin tools (filtered out for non-admin roles):
 *   get_pending_quotes, get_quote_details_admin, send_quote_proposal,
 *   create_order_from_quote, get_pending_payments, verify_payment,
 *   deny_payment, update_order_status
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, OllamaToolProperty>;
      required?: string[];
    };
  };
}

interface OllamaToolProperty {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string };
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  tool: string;
  result: unknown;
  error?: string;
}

export interface ToolExecutionContext {
  sessionId?: string;
  userId?: string;
  conversationId?: string;
  supabase?: import('@supabase/supabase-js').SupabaseClient;
}

// ─── Admin tool names (for role-based filtering in llm.ts) ────────────────────

export const ADMIN_TOOL_NAMES: string[] = [
  'get_pending_quotes',
  'get_quote_details_admin',
  'send_quote_proposal',
  'create_order_from_quote',
  'get_pending_payments',
  'verify_payment',
  'deny_payment',
  'update_order_status',
];

// ─── Tool Schemas ─────────────────────────────────────────────────────────────

export const TOOLS: OllamaTool[] = [
  // ── Customer: browsing & service discovery ──────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'get_services',
      description:
        'Returns the full list of active printing services grouped by category. Use this when the customer asks "what do you offer" or needs to browse options.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description:
              'Optional: filter by category name. One of: "BIR Registered Forms", "Commercial Forms", "Business Forms", "Commercial Printing", "Packaging", "Digital Printing", "Large Format Printing".',
          },
        },
      },
    },
  },

  // ── Customer: quote request ─────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'draft_quote_request',
      description:
        'Creates a draft quote request when the customer has provided enough information about what they need. Call this once you have: service name, quantity, and any relevant specs.',
      parameters: {
        type: 'object',
        properties: {
          service_name: {
            type: 'string',
            description: 'The name of the printing service requested.',
          },
          quantity: {
            type: 'string',
            description: 'How many units the customer needs.',
          },
          specs: {
            type: 'string',
            description:
              'Any additional specifications: size, paper type, color, finishing, deadline, etc.',
          },
          notes: {
            type: 'string',
            description: 'Any extra context or special requests from the customer.',
          },
        },
        required: ['service_name', 'quantity'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'create_quote_request',
      description:
        'Submits a formal quote request to B.J. Santiago by creating an inquiry record. Call this after collecting the customer\'s print job description. Returns a display_id the customer can reference.',
      parameters: {
        type: 'object',
        properties: {
          subject: {
            type: 'string',
            description: 'Short title summarizing what is being requested (e.g. "Business Card Printing - 500 pcs").',
          },
          body: {
            type: 'string',
            description: 'Full details of the print job: product, size, quantity, material, color, finishing, deadline, delivery method.',
          },
          service_id: {
            type: 'string',
            description: 'Optional UUID of the matching printing service from the catalog.',
          },
        },
        required: ['subject', 'body'],
      },
    },
  },

  // ── Customer: quote tracking ────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'get_my_quotes',
      description:
        'Returns all quote requests submitted by the current customer. Use when the customer asks about their pending quotes or wants to see what they\'ve requested.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_quote_details',
      description:
        'Returns the full details of a specific quote by its display ID (e.g. QUO-000001). Includes status, specs, and any proposal from the admin.',
      parameters: {
        type: 'object',
        properties: {
          quote_id: {
            type: 'string',
            description: 'The display ID of the quote (e.g. QUO-000001).',
          },
        },
        required: ['quote_id'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'accept_quote',
      description:
        'Marks a quote proposal as accepted by the customer. Call this when the customer confirms they agree to the proposed price and specs.',
      parameters: {
        type: 'object',
        properties: {
          quote_id: {
            type: 'string',
            description: 'The display ID of the quote to accept (e.g. QUO-000001).',
          },
        },
        required: ['quote_id'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'reject_quote',
      description:
        'Marks a quote proposal as rejected by the customer. Call this when the customer declines the proposed price or specs.',
      parameters: {
        type: 'object',
        properties: {
          quote_id: {
            type: 'string',
            description: 'The display ID of the quote to reject (e.g. QUO-000001).',
          },
        },
        required: ['quote_id'],
      },
    },
  },

  // ── Customer: order tracking ────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'check_order_status',
      description:
        "Looks up the status of an existing order by order ID or display ID. Use when the customer asks 'where is my order' or provides an order number.",
      parameters: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'The order ID or display ID (e.g. ORD-000123).',
          },
        },
        required: ['order_id'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_my_orders',
      description:
        'Returns all orders for the current customer. Use when the customer asks about their orders, delivery status, or payment status.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },

  // ── Customer: support tickets ───────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'create_support_ticket',
      description:
        'Creates a support ticket for a quality issue, delivery problem, billing concern, or other inquiry. Returns a display_id the customer can reference.',
      parameters: {
        type: 'object',
        properties: {
          subject: {
            type: 'string',
            description: 'Short title of the issue (e.g. "Print quality problem - Order ORD-000012").',
          },
          body: {
            type: 'string',
            description: 'Full description of the issue including what happened, when, and any relevant order details.',
          },
          service_id: {
            type: 'string',
            description: 'Optional UUID of the related printing service.',
          },
        },
        required: ['subject', 'body'],
      },
    },
  },

  // ── General ─────────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'escalate_to_human',
      description:
        "Flags this conversation for a human agent to take over. Use when: the customer is frustrated, the request is too complex or custom, or you cannot confidently help.",
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Brief reason for escalation.',
          },
        },
        required: ['reason'],
      },
    },
  },

  // ── Admin only ───────────────────────────────────────────────────────────────

  {
    type: 'function',
    function: {
      name: 'get_pending_quotes',
      description:
        'Admin only. Returns all open or in-progress quote requests (inquiries) that need a proposal. Use when the admin asks what quotes are pending review.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_quote_details_admin',
      description:
        'Admin only. Returns full details of a quote request including customer info, inquiry body, and any associated quotes and specs.',
      parameters: {
        type: 'object',
        properties: {
          inquiry_id: {
            type: 'string',
            description: 'The display ID of the inquiry (e.g. INQ-000001).',
          },
        },
        required: ['inquiry_id'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'send_quote_proposal',
      description:
        'Admin only. Sends a price proposal to a customer for their quote request. Creates a quote_proposals record and updates the quote status to sent.',
      parameters: {
        type: 'object',
        properties: {
          inquiry_id: {
            type: 'string',
            description: 'The display ID of the customer inquiry (e.g. INQ-000001).',
          },
          unit_price: {
            type: 'number',
            description: 'Price per unit in PHP.',
          },
          quantity: {
            type: 'number',
            description: 'Quantity agreed upon.',
          },
          notes: {
            type: 'string',
            description: 'Optional notes or specs summary for the customer.',
          },
        },
        required: ['inquiry_id', 'unit_price', 'quantity'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'create_order_from_quote',
      description:
        'Admin only. Creates an order from an accepted quote. Sets order status to confirmed. Use after customer accepts the proposal.',
      parameters: {
        type: 'object',
        properties: {
          quote_id: {
            type: 'string',
            description: 'The display ID of the accepted quote (e.g. QUO-000001).',
          },
        },
        required: ['quote_id'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_pending_payments',
      description:
        'Admin only. Returns all orders with uploaded payment proofs that are awaiting verification.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'verify_payment',
      description:
        'Admin only. Approves a payment proof and advances the order to in_production status. Confirm with admin before calling.',
      parameters: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'The display ID of the order (e.g. ORD-000001).',
          },
        },
        required: ['order_id'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'deny_payment',
      description:
        'Admin only. Rejects a payment proof with a reason. The customer will need to reupload. Always confirm with admin before calling.',
      parameters: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'The display ID of the order (e.g. ORD-000001).',
          },
          reason: {
            type: 'string',
            description: 'Reason for denial to share with the customer.',
          },
        },
        required: ['order_id', 'reason'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'update_order_status',
      description:
        'Admin only. Updates the fulfillment status of an order. Use to advance orders through production, pickup, or delivery.',
      parameters: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'The display ID of the order (e.g. ORD-000001).',
          },
          status: {
            type: 'string',
            enum: ['pending', 'confirmed', 'in_production', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled'],
            description: 'The new status for the order.',
          },
        },
        required: ['order_id', 'status'],
      },
    },
  },
];

// ─── Static service data (fallback for get_services) ──────────────────────────

const SERVICES_BY_CATEGORY: Record<string, string[]> = {
  'BIR Registered Forms': ['Sales Invoice', 'Purchase Order', 'Delivery Receipt'],
  'Commercial Forms': ['Insurance Form', 'Application Form', 'Registration Form'],
  'Business Forms': ['Business Card', 'Company Folder', 'Letterhead', 'Envelope'],
  'Commercial Printing': ['Brochures', 'Flyers', 'Posters', 'Banners'],
  Packaging: ['Soap Box', 'Coffee / Tea Box', 'Pharmaceutical Box', 'Paper Bag', 'Hang Tag'],
  'Digital Printing': ['Photo Prints', 'Canvas Prints', 'Stickers', 'Labels'],
  'Large Format Printing': ['Signage', 'Vehicle Wraps', 'Window Graphics'],
};

// ─── Tool Handlers ────────────────────────────────────────────────────────────

export async function executeTool(
  call: ToolCall,
  context: ToolExecutionContext
): Promise<ToolResult> {
  try {
    switch (call.name) {

      // ── Customer tools ───────────────────────────────────────────────────────

      case 'get_services': {
        const category = call.arguments.category as string | undefined;
        if (category && SERVICES_BY_CATEGORY[category]) {
          return { tool: call.name, result: { category, services: SERVICES_BY_CATEGORY[category] } };
        }
        return { tool: call.name, result: SERVICES_BY_CATEGORY };
      }

      case 'draft_quote_request': {
        const { service_name, quantity, specs, notes } = call.arguments as {
          service_name: string;
          quantity: string;
          specs?: string;
          notes?: string;
        };
        return {
          tool: call.name,
          result: {
            draft: true,
            service_name,
            quantity,
            specs: specs ?? '',
            notes: notes ?? '',
            session_id: context.sessionId,
          },
        };
      }

      case 'create_quote_request': {
        const { subject, body, service_id } = call.arguments as {
          subject: string;
          body: string;
          service_id?: string;
        };
        if (!context.supabase || !context.userId) {
          return { tool: call.name, result: null, error: 'Authentication required to submit a quote request.' };
        }
        const { data, error } = await context.supabase
          .from('inquiries')
          .insert({
            profile_id: context.userId,
            subject,
            body,
            ...(service_id ? { service_id } : {}),
            status: 'open',
          })
          .select('display_id')
          .single();
        if (error) return { tool: call.name, result: null, error: error.message };
        return { tool: call.name, result: { success: true, display_id: data.display_id } };
      }

      case 'get_my_quotes': {
        if (!context.supabase || !context.userId) {
          return { tool: call.name, result: null, error: 'Authentication required.' };
        }
        const { data, error } = await context.supabase
          .from('quotes')
          .select('display_id, status, total_amount, created_at, updated_at')
          .eq('profile_id', context.userId)
          .order('created_at', { ascending: false });
        if (error) return { tool: call.name, result: null, error: error.message };
        return { tool: call.name, result: data ?? [] };
      }

      case 'get_quote_details': {
        const { quote_id } = call.arguments as { quote_id: string };
        if (!context.supabase || !context.userId) {
          return { tool: call.name, result: null, error: 'Authentication required.' };
        }
        const { data, error } = await context.supabase
          .from('quotes')
          .select('display_id, status, total_amount, notes, created_at, updated_at, quote_proposals(unit_price, quantity, line_total, notes, is_accepted)')
          .eq('profile_id', context.userId)
          .or(`display_id.eq.${quote_id},id.eq.${quote_id}`)
          .maybeSingle();
        if (error) return { tool: call.name, result: null, error: error.message };
        if (!data) return { tool: call.name, result: null, error: 'Quote not found.' };
        return { tool: call.name, result: data };
      }

      case 'accept_quote': {
        const { quote_id } = call.arguments as { quote_id: string };
        if (!context.supabase || !context.userId) {
          return { tool: call.name, result: null, error: 'Authentication required.' };
        }
        const { error } = await context.supabase
          .from('quotes')
          .update({ status: 'accepted', accepted_at: new Date().toISOString() })
          .eq('profile_id', context.userId)
          .or(`display_id.eq.${quote_id},id.eq.${quote_id}`);
        if (error) return { tool: call.name, result: null, error: error.message };
        return { tool: call.name, result: { success: true, quote_id } };
      }

      case 'reject_quote': {
        const { quote_id } = call.arguments as { quote_id: string };
        if (!context.supabase || !context.userId) {
          return { tool: call.name, result: null, error: 'Authentication required.' };
        }
        const { error } = await context.supabase
          .from('quotes')
          .update({ status: 'rejected', rejected_at: new Date().toISOString() })
          .eq('profile_id', context.userId)
          .or(`display_id.eq.${quote_id},id.eq.${quote_id}`);
        if (error) return { tool: call.name, result: null, error: error.message };
        return { tool: call.name, result: { success: true, quote_id } };
      }

      case 'check_order_status': {
        const { order_id } = call.arguments as { order_id: string };
        if (!context.supabase) {
          return { tool: call.name, result: null, error: 'Supabase not available' };
        }
        const { data, error } = await context.supabase
          .from('orders')
          .select('display_id, status, payment_status, total_amount, created_at, updated_at')
          .or(`display_id.eq.${order_id},id.eq.${order_id}`)
          .maybeSingle();
        if (error) return { tool: call.name, result: null, error: error.message };
        if (!data) return { tool: call.name, result: null, error: 'Order not found.' };
        return { tool: call.name, result: data };
      }

      case 'get_my_orders': {
        if (!context.supabase || !context.userId) {
          return { tool: call.name, result: null, error: 'Authentication required.' };
        }
        const { data, error } = await context.supabase
          .from('orders')
          .select('display_id, status, payment_status, total_amount, is_pickup, created_at, updated_at')
          .eq('profile_id', context.userId)
          .order('created_at', { ascending: false });
        if (error) return { tool: call.name, result: null, error: error.message };
        return { tool: call.name, result: data ?? [] };
      }

      case 'create_support_ticket': {
        const { subject, body, service_id } = call.arguments as {
          subject: string;
          body: string;
          service_id?: string;
        };
        if (!context.supabase || !context.userId) {
          return { tool: call.name, result: null, error: 'Authentication required to submit a support ticket.' };
        }
        const { data, error } = await context.supabase
          .from('inquiries')
          .insert({
            profile_id: context.userId,
            subject,
            body,
            ...(service_id ? { service_id } : {}),
            status: 'open',
          })
          .select('display_id')
          .single();
        if (error) return { tool: call.name, result: null, error: error.message };
        return { tool: call.name, result: { success: true, display_id: data.display_id } };
      }

      case 'escalate_to_human': {
        const { reason } = call.arguments as { reason: string };
        if (context.supabase && context.sessionId) {
          await context.supabase
            .from('chat_sessions')
            .update({ metadata: { escalated: true, escalation_reason: reason } })
            .eq('id', context.sessionId);
        }
        return { tool: call.name, result: { escalated: true, reason } };
      }

      // ── Admin tools ──────────────────────────────────────────────────────────

      case 'get_pending_quotes': {
        if (!context.supabase) {
          return { tool: call.name, result: null, error: 'Supabase not available.' };
        }
        const { data, error } = await context.supabase
          .from('inquiries')
          .select('display_id, subject, status, created_at, profiles(display_name, email, customer_type)')
          .in('status', ['open', 'in_progress'])
          .order('created_at', { ascending: true });
        if (error) return { tool: call.name, result: null, error: error.message };
        return { tool: call.name, result: data ?? [] };
      }

      case 'get_quote_details_admin': {
        const { inquiry_id } = call.arguments as { inquiry_id: string };
        if (!context.supabase) {
          return { tool: call.name, result: null, error: 'Supabase not available.' };
        }
        const { data, error } = await context.supabase
          .from('inquiries')
          .select('display_id, subject, body, status, created_at, attachments, profiles(display_name, email, customer_type), quotes(display_id, status, total_amount, quote_proposals(unit_price, quantity, line_total, notes))')
          .or(`display_id.eq.${inquiry_id},id.eq.${inquiry_id}`)
          .maybeSingle();
        if (error) return { tool: call.name, result: null, error: error.message };
        if (!data) return { tool: call.name, result: null, error: 'Inquiry not found.' };
        return { tool: call.name, result: data };
      }

      case 'send_quote_proposal': {
        const { inquiry_id, unit_price, quantity, notes } = call.arguments as {
          inquiry_id: string;
          unit_price: number;
          quantity: number;
          notes?: string;
        };
        if (!context.supabase || !context.userId) {
          return { tool: call.name, result: null, error: 'Authentication required.' };
        }
        // Find the inquiry to get its linked quote
        const { data: inquiry, error: inqErr } = await context.supabase
          .from('inquiries')
          .select('id, quotes(id)')
          .or(`display_id.eq.${inquiry_id},id.eq.${inquiry_id}`)
          .maybeSingle();
        if (inqErr || !inquiry) {
          return { tool: call.name, result: null, error: inqErr?.message ?? 'Inquiry not found.' };
        }
        const quotes = inquiry.quotes as any[];
        let quoteId: string;
        if (quotes && quotes.length > 0) {
          quoteId = quotes[0].id;
        } else {
          // Create the quote record first
          const { data: newQuote, error: qErr } = await context.supabase
            .from('quotes')
            .insert({
              inquiry_id: inquiry.id,
              status: 'draft',
              total_amount: unit_price * quantity,
            })
            .select('id')
            .single();
          if (qErr || !newQuote) return { tool: call.name, result: null, error: qErr?.message ?? 'Failed to create quote.' };
          quoteId = newQuote.id;
        }
        // Insert proposal
        const { error: propErr } = await context.supabase
          .from('quote_proposals')
          .insert({
            quote_id: quoteId,
            spec_id: (await context.supabase.from('quote_specs').insert({ quantity }).select('id').single()).data?.id,
            proposed_by: context.userId,
            unit_price,
            quantity,
            notes: notes ?? null,
          });
        if (propErr) return { tool: call.name, result: null, error: propErr.message };
        // Update quote status to sent
        await context.supabase
          .from('quotes')
          .update({ status: 'sent', sent_at: new Date().toISOString(), total_amount: unit_price * quantity })
          .eq('id', quoteId);
        return { tool: call.name, result: { success: true, inquiry_id, quote_id: quoteId } };
      }

      case 'create_order_from_quote': {
        const { quote_id } = call.arguments as { quote_id: string };
        if (!context.supabase) {
          return { tool: call.name, result: null, error: 'Supabase not available.' };
        }
        const { data: quote, error: qErr } = await context.supabase
          .from('quotes')
          .select('id, profile_id, service_id, spec_id, total_amount, status')
          .or(`display_id.eq.${quote_id},id.eq.${quote_id}`)
          .maybeSingle();
        if (qErr || !quote) return { tool: call.name, result: null, error: qErr?.message ?? 'Quote not found.' };
        if (quote.status !== 'accepted') {
          return { tool: call.name, result: null, error: `Quote status is "${quote.status}" — must be "accepted" to create an order.` };
        }
        const { data: order, error: oErr } = await context.supabase
          .from('orders')
          .insert({
            profile_id: quote.profile_id,
            quote_id: quote.id,
            service_id: quote.service_id ?? null,
            spec_id: quote.spec_id ?? null,
            total_amount: quote.total_amount,
            status: 'confirmed',
            payment_status: 'pending',
          })
          .select('display_id')
          .single();
        if (oErr || !order) return { tool: call.name, result: null, error: oErr?.message ?? 'Failed to create order.' };
        return { tool: call.name, result: { success: true, display_id: order.display_id } };
      }

      case 'get_pending_payments': {
        if (!context.supabase) {
          return { tool: call.name, result: null, error: 'Supabase not available.' };
        }
        const { data, error } = await context.supabase
          .from('orders')
          .select('display_id, status, payment_status, total_amount, proof_files, created_at, profiles(display_name, email, customer_type)')
          .eq('payment_status', 'pending')
          .not('proof_files', 'eq', '{}')
          .order('created_at', { ascending: true });
        if (error) return { tool: call.name, result: null, error: error.message };
        return { tool: call.name, result: data ?? [] };
      }

      case 'verify_payment': {
        const { order_id } = call.arguments as { order_id: string };
        if (!context.supabase || !context.userId) {
          return { tool: call.name, result: null, error: 'Authentication required.' };
        }
        const { error } = await context.supabase
          .from('orders')
          .update({
            payment_status: 'verified',
            payment_verified_by: context.userId,
            payment_verified_at: new Date().toISOString(),
            status: 'in_production',
          })
          .or(`display_id.eq.${order_id},id.eq.${order_id}`);
        if (error) return { tool: call.name, result: null, error: error.message };
        return { tool: call.name, result: { success: true, order_id, new_status: 'in_production' } };
      }

      case 'deny_payment': {
        const { order_id, reason } = call.arguments as { order_id: string; reason: string };
        if (!context.supabase || !context.userId) {
          return { tool: call.name, result: null, error: 'Authentication required.' };
        }
        const { error } = await context.supabase
          .from('orders')
          .update({
            payment_status: 'denied',
            payment_denied_by: context.userId,
            ai_context: { denial_reason: reason },
          })
          .or(`display_id.eq.${order_id},id.eq.${order_id}`);
        if (error) return { tool: call.name, result: null, error: error.message };
        return { tool: call.name, result: { success: true, order_id, reason } };
      }

      case 'update_order_status': {
        const { order_id, status } = call.arguments as { order_id: string; status: string };
        const validStatuses = ['pending', 'confirmed', 'in_production', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
          return { tool: call.name, result: null, error: `Invalid status "${status}". Must be one of: ${validStatuses.join(', ')}` };
        }
        if (!context.supabase) {
          return { tool: call.name, result: null, error: 'Supabase not available.' };
        }
        const { error } = await context.supabase
          .from('orders')
          .update({ status })
          .or(`display_id.eq.${order_id},id.eq.${order_id}`);
        if (error) return { tool: call.name, result: null, error: error.message };
        return { tool: call.name, result: { success: true, order_id, new_status: status } };
      }

      default:
        return { tool: call.name, result: null, error: `Unknown tool: ${call.name}` };
    }
  } catch (err) {
    return {
      tool: call.name,
      result: null,
      error: err instanceof Error ? err.message : 'Tool execution failed',
    };
  }
}

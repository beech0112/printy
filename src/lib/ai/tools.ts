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
  // ── Customer: personalized greeting briefing ────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'get_customer_briefing',
      description:
        'Call ONLY on greeting (when userMessage is "__greeting__"). Fetches the customer\'s first name and all pending items needing attention: quote proposals awaiting accept/reject, denied payment proofs, active order statuses, and unread ticket replies. Use the returned data to build a personalized greeting.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },

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
        'Submits a confirmed quote request after the customer has typed "yes" to the draft summary. Call ONLY after explicit customer confirmation. Stores all spec fields in ai_context. Returns a display_id (QTR-XXXXXX).',
      parameters: {
        type: 'object',
        properties: {
          product: {
            type: 'string',
            description: 'What the customer wants printed (e.g. "Business cards").',
          },
          description: {
            type: 'string',
            description: 'Details, use case, design notes.',
          },
          size: {
            type: 'string',
            description: 'Dimensions or standard format (e.g. "3.5x2in", "A4").',
          },
          quantity: {
            type: 'string',
            description: 'Number of units.',
          },
          materials: {
            type: 'string',
            description: 'Paper or material type (e.g. "16pt cardstock", "Vinyl").',
          },
          color: {
            type: 'string',
            description: 'Color spec (e.g. "Full Color", "B&W", "Pantone 186C").',
          },
          finishing: {
            type: 'string',
            description: 'Finishing options (e.g. "Glossy UV", "Matte", "Spot UV").',
          },
          deadline: {
            type: 'string',
            description: 'When the customer needs the job completed.',
          },
          delivery_method: {
            type: 'string',
            enum: ['pickup', 'delivery'],
            description: 'Pickup at Sampaloc branch or delivery to customer address.',
          },
          attachments: {
            type: 'array',
            description: 'Optional list of uploaded file URLs attached to this request.',
            items: { type: 'string' },
          },
          service_id: {
            type: 'string',
            description: 'Optional UUID of the matching printing service from the catalog.',
          },
          is_valued_customer: {
            type: 'string',
            enum: ['true', 'false'],
            description: 'Pass "true" for valued customers so the inquiry is flagged urgent.',
          },
        },
        required: ['product', 'description', 'size', 'quantity', 'materials', 'color', 'finishing', 'deadline', 'delivery_method'],
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

  // ── Customer: payment flow ──────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'get_order_for_payment',
      description:
        'Fetches the full order summary (product, specs, amount due, status) for the payment flow. Call this at the start of the pay-order or reupload-payment flow to show the customer what they are paying for.',
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
      name: 'get_payment_assets',
      description:
        'Returns payment method details for the customer: bank transfer account info and/or QRPH codes. Call after the customer selects a payment method.',
      parameters: {
        type: 'object',
        properties: {
          method: {
            type: 'string',
            enum: ['bank_transfer', 'qrph'],
            description: 'The payment method the customer selected.',
          },
        },
        required: ['method'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'submit_payment_proof',
      description:
        'Records that the customer has uploaded payment proof for an order. Updates order status to verifying_payment. Call after the customer uploads their proof file.',
      parameters: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'The display ID of the order (e.g. ORD-000001).',
          },
          proof_urls: {
            type: 'array',
            description: 'List of uploaded file URLs for the payment proof.',
            items: { type: 'string' },
          },
        },
        required: ['order_id'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'resubmit_payment_proof',
      description:
        'Re-records payment proof after a denial. Same as submit_payment_proof but used in the reupload flow. Updates order status back to verifying_payment.',
      parameters: {
        type: 'object',
        properties: {
          order_id: {
            type: 'string',
            description: 'The display ID of the order (e.g. ORD-000001).',
          },
          proof_urls: {
            type: 'array',
            description: 'List of uploaded file URLs for the new payment proof.',
            items: { type: 'string' },
          },
        },
        required: ['order_id'],
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
        'Admin only. Sends a price proposal to a customer after admin has typed "yes" to the proposal summary. Creates or updates the quotes row and notifies the customer.',
      parameters: {
        type: 'object',
        properties: {
          inquiry_id: {
            type: 'string',
            description: 'The display ID of the quote request (e.g. QTR-000001).',
          },
          quoted_price: {
            type: 'number',
            description: 'Total quoted price in PHP as typed by the admin.',
          },
          spec_final: {
            type: 'string',
            description: 'JSON string of the confirmed spec object (product, size, quantity, materials, color, finishing, deadline, delivery_method).',
          },
          admin_notes: {
            type: 'string',
            description: 'Optional notes from admin to include with the proposal.',
          },
        },
        required: ['inquiry_id', 'quoted_price', 'spec_final'],
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
            enum: ['awaiting_payment', 'verifying_payment', 'reupload_payment', 'processing', 'for_pickup', 'for_delivery', 'completed', 'cancelled'],
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

      case 'get_customer_briefing': {
        if (!context.supabase || !context.userId) {
          return { tool: call.name, result: { first_name: null, pending: [] }, error: 'Authentication required.' };
        }
        const sb = context.supabase;
        const uid = context.userId;

        // Fetch in parallel
        const [profileRes, quotesRes, ordersRes, ticketsRes] = await Promise.all([
          // First name
          sb.from('profiles').select('first_name, customer_type').eq('id', uid).maybeSingle(),

          // Pending quote proposals (status = 'sent', not yet accepted/rejected)
          sb.from('quotes')
            .select('display_id, quoted_price, spec_final, sent_at, inquiry_id')
            .eq('profile_id', uid)
            .eq('status', 'sent')
            .order('sent_at', { ascending: false })
            .limit(3),

          // Active orders -- any non-completed, non-cancelled
          sb.from('orders')
            .select('display_id, status, payment_status, total_amount, ai_context')
            .eq('profile_id', uid)
            .not('status', 'in', '("completed","cancelled")')
            .order('updated_at', { ascending: false })
            .limit(5),

          // Tickets with unread admin replies (status = 'pending_customer_reply')
          sb.from('inquiries')
            .select('display_id, subject, status, ai_context')
            .eq('profile_id', uid)
            .eq('type', 'ticket')
            .eq('status', 'pending_customer_reply')
            .order('updated_at', { ascending: false })
            .limit(3),
        ]);

        const firstName = profileRes.data?.first_name ?? null;
        const customerType = profileRes.data?.customer_type ?? 'regular';

        // Build pending items in priority order per the greeting doc
        const pending: Array<{ type: string; priority: number; data: Record<string, unknown> }> = [];

        // 1. Denied payment proofs
        const deniedOrders = (ordersRes.data ?? []).filter(o => o.status === 'reupload_payment');
        for (const o of deniedOrders) {
          pending.push({
            type: 'denied_payment',
            priority: 1,
            data: {
              order_id: o.display_id,
              denial_reason: (o.ai_context as any)?.denial_reason ?? null,
              amount: o.total_amount,
            },
          });
        }

        // 2. Quote proposals awaiting response
        for (const q of (quotesRes.data ?? [])) {
          const spec = q.spec_final as any;
          pending.push({
            type: 'quote_proposal',
            priority: 2,
            data: {
              quote_id: q.display_id,
              price: q.quoted_price,
              product: spec?.product ?? spec?.raw ?? 'your order',
            },
          });
        }

        // 3. Orders ready for pickup or out for delivery
        const readyOrders = (ordersRes.data ?? []).filter(
          o => o.status === 'for_pickup' || o.status === 'for_delivery'
        );
        for (const o of readyOrders) {
          pending.push({
            type: o.status === 'for_pickup' ? 'ready_for_pickup' : 'out_for_delivery',
            priority: 3,
            data: { order_id: o.display_id, amount: o.total_amount },
          });
        }

        // 4. Ticket replies
        for (const t of (ticketsRes.data ?? [])) {
          const thread = (t.ai_context as any)?.thread ?? [];
          const lastAdminMsg = [...thread].reverse().find((m: any) => m.role === 'admin');
          pending.push({
            type: 'ticket_reply',
            priority: 4,
            data: {
              ticket_id: t.display_id,
              subject: t.subject,
              reply_preview: lastAdminMsg?.message?.slice(0, 100) ?? null,
            },
          });
        }

        // 5. Orders in production (informational)
        const processingOrders = (ordersRes.data ?? []).filter(o => o.status === 'processing');
        for (const o of processingOrders) {
          pending.push({
            type: 'order_in_production',
            priority: 5,
            data: { order_id: o.display_id, amount: o.total_amount },
          });
        }

        pending.sort((a, b) => a.priority - b.priority);

        return {
          tool: call.name,
          result: { first_name: firstName, customer_type: customerType, pending },
        };
      }

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
        const {
          product, description, size, quantity, materials, color,
          finishing, deadline, delivery_method, attachments,
          service_id, is_valued_customer,
        } = call.arguments as {
          product: string;
          description: string;
          size: string;
          quantity: string;
          materials: string;
          color: string;
          finishing: string;
          deadline: string;
          delivery_method: 'pickup' | 'delivery';
          attachments?: string[];
          service_id?: string;
          is_valued_customer?: string;
        };
        if (!context.supabase || !context.userId) {
          return { tool: call.name, result: null, error: 'Authentication required to submit a quote request.' };
        }
        const subject = `${product} - ${quantity} units`;
        const aiContext = {
          product, description, size, quantity, materials, color,
          finishing, deadline, delivery_method,
          attachments: attachments ?? [],
          urgent: is_valued_customer === 'true',
        };
        const { data, error } = await context.supabase
          .from('inquiries')
          .insert({
            profile_id: context.userId,
            type: 'quote_request',
            subject,
            body: `${product}: ${description}`,
            status: 'new',
            ai_context: aiContext,
            ...(service_id ? { service_id } : {}),
            ...(attachments?.length ? { attachments } : {}),
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
          .select('display_id, status, total_amount, quoted_price, admin_notes, spec_final, created_at, updated_at')
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
        const now = new Date().toISOString();
        // Fetch the quote to get inquiry_id for the admin notification
        const { data: quote, error: fetchErr } = await context.supabase
          .from('quotes')
          .select('id, inquiry_id, quoted_price, spec_final')
          .eq('profile_id', context.userId)
          .or(`display_id.eq.${quote_id},id.eq.${quote_id}`)
          .maybeSingle();
        if (fetchErr || !quote) {
          return { tool: call.name, result: null, error: fetchErr?.message ?? 'Quote not found.' };
        }
        const { error } = await context.supabase
          .from('quotes')
          .update({ status: 'accepted', accepted_at: now })
          .eq('id', quote.id);
        if (error) return { tool: call.name, result: null, error: error.message };
        // Notify admin (profile_id left null — admin sees all in-app notifications)
        // Find any admin profile to notify
        const { data: adminProfiles } = await context.supabase
          .from('profiles')
          .select('id')
          .eq('role', 'admin')
          .limit(1);
        if (adminProfiles && adminProfiles.length > 0) {
          await context.supabase.from('notifications').insert({
            profile_id: adminProfiles[0].id,
            channel: 'in_app',
            status: 'sent',
            title: 'Quote accepted',
            body: `A customer accepted quote ${quote_id}. Ready to create an order.`,
            inquiry_id: quote.inquiry_id ?? null,
            quote_id: quote.id,
            sent_at: now,
          });
        }
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
            type: 'ticket',
            subject,
            body,
            ...(service_id ? { service_id } : {}),
            status: 'new',
          })
          .select('display_id')
          .single();
        if (error) return { tool: call.name, result: null, error: error.message };
        return { tool: call.name, result: { success: true, display_id: data.display_id } };
      }

      case 'get_order_for_payment': {
        const { order_id } = call.arguments as { order_id: string };
        if (!context.supabase || !context.userId) {
          return { tool: call.name, result: null, error: 'Authentication required.' };
        }
        const { data, error } = await context.supabase
          .from('orders')
          .select('display_id, status, payment_status, total_amount, is_pickup, ai_context, quotes(quoted_price, spec_final, admin_notes)')
          .eq('profile_id', context.userId)
          .or(`display_id.eq.${order_id},id.eq.${order_id}`)
          .maybeSingle();
        if (error) return { tool: call.name, result: null, error: error.message };
        if (!data) return { tool: call.name, result: null, error: 'Order not found.' };
        const quote = (data.quotes as any)?.[0] ?? data.quotes;
        const spec = quote?.spec_final as any;
        return {
          tool: call.name,
          result: {
            order_id: data.display_id,
            status: data.status,
            payment_status: data.payment_status,
            amount_due: data.total_amount,
            delivery: data.is_pickup ? 'Pickup at Sampaloc, Manila' : 'Delivery',
            denial_reason: (data.ai_context as any)?.denial_reason ?? null,
            product: spec?.product ?? null,
            specs: spec ?? null,
          },
        };
      }

      case 'get_payment_assets': {
        const { method } = call.arguments as { method: 'bank_transfer' | 'qrph' };
        // Storage buckets not yet created — return placeholder info
        // TODO: replace with Supabase storage public URLs when buckets are set up
        if (method === 'bank_transfer') {
          return {
            tool: call.name,
            result: {
              method: 'bank_transfer',
              note: 'Bank transfer details image not yet available. Please contact us at bjsantiagoinc@gmail.com or +632 8781 3457 for account details.',
              image_url: null,
            },
          };
        }
        return {
          tool: call.name,
          result: {
            method: 'qrph',
            note: 'QR code image not yet available. Please contact us at bjsantiagoinc@gmail.com or +632 8781 3457 for payment details.',
            image_url: null,
          },
        };
      }

      case 'submit_payment_proof': {
        const { order_id, proof_urls } = call.arguments as { order_id: string; proof_urls?: string[] };
        if (!context.supabase || !context.userId) {
          return { tool: call.name, result: null, error: 'Authentication required.' };
        }
        // Fetch order to get its UUID and profile for notification
        const { data: order, error: fetchErr } = await context.supabase
          .from('orders')
          .select('id, profile_id')
          .eq('profile_id', context.userId)
          .or(`display_id.eq.${order_id},id.eq.${order_id}`)
          .maybeSingle();
        if (fetchErr || !order) {
          return { tool: call.name, result: null, error: fetchErr?.message ?? 'Order not found.' };
        }
        const { error } = await context.supabase
          .from('orders')
          .update({
            status: 'verifying_payment',
            payment_status: 'pending',
            ...(proof_urls?.length ? { proof_files: proof_urls } : {}),
          })
          .eq('id', order.id);
        if (error) return { tool: call.name, result: null, error: error.message };
        // Notify admin
        const { data: adminProfiles } = await context.supabase
          .from('profiles').select('id').eq('role', 'admin').limit(1);
        if (adminProfiles?.[0]) {
          await context.supabase.from('notifications').insert({
            profile_id: adminProfiles[0].id,
            channel: 'in_app',
            status: 'sent',
            title: 'Payment proof submitted',
            body: `${order_id} — customer has uploaded payment proof. Please verify.`,
            order_id: order.id,
            sent_at: new Date().toISOString(),
          });
        }
        return { tool: call.name, result: { success: true, order_id, new_status: 'verifying_payment' } };
      }

      case 'resubmit_payment_proof': {
        const { order_id, proof_urls } = call.arguments as { order_id: string; proof_urls?: string[] };
        if (!context.supabase || !context.userId) {
          return { tool: call.name, result: null, error: 'Authentication required.' };
        }
        const { data: order, error: fetchErr } = await context.supabase
          .from('orders')
          .select('id')
          .eq('profile_id', context.userId)
          .or(`display_id.eq.${order_id},id.eq.${order_id}`)
          .maybeSingle();
        if (fetchErr || !order) {
          return { tool: call.name, result: null, error: fetchErr?.message ?? 'Order not found.' };
        }
        const { error } = await context.supabase
          .from('orders')
          .update({
            status: 'verifying_payment',
            payment_status: 'pending',
            ...(proof_urls?.length ? { proof_files: proof_urls } : {}),
          })
          .eq('id', order.id);
        if (error) return { tool: call.name, result: null, error: error.message };
        const { data: adminProfiles } = await context.supabase
          .from('profiles').select('id').eq('role', 'admin').limit(1);
        if (adminProfiles?.[0]) {
          await context.supabase.from('notifications').insert({
            profile_id: adminProfiles[0].id,
            channel: 'in_app',
            status: 'sent',
            title: 'Payment proof resubmitted',
            body: `${order_id} — customer has re-uploaded payment proof after denial. Please verify.`,
            order_id: order.id,
            sent_at: new Date().toISOString(),
          });
        }
        return { tool: call.name, result: { success: true, order_id, new_status: 'verifying_payment' } };
      }

      case 'escalate_to_human': {
        const { reason } = call.arguments as { reason: string };
        return { tool: call.name, result: { escalated: true, reason } };
      }

      // ── Admin tools ──────────────────────────────────────────────────────────

      case 'get_pending_quotes': {
        if (!context.supabase) {
          return { tool: call.name, result: null, error: 'Supabase not available.' };
        }
        const { data, error } = await context.supabase
          .from('inquiries')
          .select('display_id, subject, status, ai_context, created_at, profiles(first_name, last_name, display_name, email, customer_type)')
          .eq('type', 'quote_request')
          .in('status', ['new', 'in_progress'])
          .order('created_at', { ascending: true });
        if (error) return { tool: call.name, result: null, error: error.message };
        // Sort: valued customer (urgent) requests first
        const sorted = (data ?? []).sort((a: any, b: any) => {
          const aUrgent = a.ai_context?.urgent === true ? 0 : 1;
          const bUrgent = b.ai_context?.urgent === true ? 0 : 1;
          return aUrgent - bUrgent;
        });
        return { tool: call.name, result: sorted };
      }

      case 'get_quote_details_admin': {
        const { inquiry_id } = call.arguments as { inquiry_id: string };
        if (!context.supabase) {
          return { tool: call.name, result: null, error: 'Supabase not available.' };
        }
        const { data, error } = await context.supabase
          .from('inquiries')
          .select('display_id, subject, body, status, created_at, attachments, profiles(display_name, email, customer_type), quotes(display_id, status, total_amount, quoted_price, admin_notes, spec_final, proposal_sent_at)')
          .or(`display_id.eq.${inquiry_id},id.eq.${inquiry_id}`)
          .maybeSingle();
        if (error) return { tool: call.name, result: null, error: error.message };
        if (!data) return { tool: call.name, result: null, error: 'Inquiry not found.' };
        return { tool: call.name, result: data };
      }

      case 'send_quote_proposal': {
        const { inquiry_id, quoted_price, spec_final, admin_notes } = call.arguments as {
          inquiry_id: string;
          quoted_price: number;
          spec_final: string;
          admin_notes?: string;
        };
        if (!context.supabase || !context.userId) {
          return { tool: call.name, result: null, error: 'Authentication required.' };
        }
        // Find the inquiry and its profile_id
        const { data: inquiry, error: inqErr } = await context.supabase
          .from('inquiries')
          .select('id, profile_id, quotes(id)')
          .or(`display_id.eq.${inquiry_id},id.eq.${inquiry_id}`)
          .maybeSingle();
        if (inqErr || !inquiry) {
          return { tool: call.name, result: null, error: inqErr?.message ?? 'Inquiry not found.' };
        }
        let specObj: Record<string, unknown>;
        try {
          specObj = typeof spec_final === 'string' ? JSON.parse(spec_final) : spec_final;
        } catch {
          specObj = { raw: spec_final };
        }
        const now = new Date().toISOString();
        const linkedQuotes = inquiry.quotes as any[];
        let quoteId: string;
        let quoteDisplayId: string;
        if (linkedQuotes && linkedQuotes.length > 0) {
          quoteId = linkedQuotes[0].id;
          const { error: upErr } = await context.supabase
            .from('quotes')
            .update({
              quoted_price,
              total_amount: quoted_price,
              admin_notes: admin_notes ?? null,
              spec_final: specObj,
              proposed_by: context.userId,
              proposal_sent_at: now,
              status: 'sent',
              sent_at: now,
            })
            .eq('id', quoteId);
          if (upErr) return { tool: call.name, result: null, error: upErr.message };
          const { data: q } = await context.supabase
            .from('quotes').select('display_id').eq('id', quoteId).single();
          quoteDisplayId = q?.display_id ?? quoteId;
        } else {
          const { data: newQuote, error: qErr } = await context.supabase
            .from('quotes')
            .insert({
              inquiry_id: inquiry.id,
              profile_id: inquiry.profile_id,
              quoted_price,
              total_amount: quoted_price,
              admin_notes: admin_notes ?? null,
              spec_final: specObj,
              proposed_by: context.userId,
              proposal_sent_at: now,
              status: 'sent',
              sent_at: now,
            })
            .select('id, display_id')
            .single();
          if (qErr || !newQuote) return { tool: call.name, result: null, error: qErr?.message ?? 'Failed to create quote.' };
          quoteId = newQuote.id;
          quoteDisplayId = newQuote.display_id;
        }
        // Update inquiry status to in_progress
        await context.supabase
          .from('inquiries')
          .update({ status: 'in_progress' })
          .eq('id', inquiry.id);
        // Notify the customer
        await context.supabase
          .from('notifications')
          .insert({
            profile_id: inquiry.profile_id,
            channel: 'in_app',
            status: 'sent',
            title: 'Quote proposal received',
            body: `Your quote request has been reviewed. A proposal of ₱${quoted_price.toLocaleString('en-PH')} has been sent. Tap to review.`,
            inquiry_id: inquiry.id,
            quote_id: quoteId,
            sent_at: now,
          });
        return { tool: call.name, result: { success: true, inquiry_id, quote_id: quoteDisplayId } };
      }

      case 'create_order_from_quote': {
        const { quote_id } = call.arguments as { quote_id: string };
        if (!context.supabase) {
          return { tool: call.name, result: null, error: 'Supabase not available.' };
        }
        const { data: quote, error: qErr } = await context.supabase
          .from('quotes')
          .select('id, profile_id, total_amount, status')
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
            total_amount: quote.total_amount,
            status: 'awaiting_payment',
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
            status: 'processing',
          })
          .or(`display_id.eq.${order_id},id.eq.${order_id}`);
        if (error) return { tool: call.name, result: null, error: error.message };
        return { tool: call.name, result: { success: true, order_id, new_status: 'processing' } };
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
            status: 'reupload_payment',
            ai_context: { denial_reason: reason },
          })
          .or(`display_id.eq.${order_id},id.eq.${order_id}`);
        if (error) return { tool: call.name, result: null, error: error.message };
        return { tool: call.name, result: { success: true, order_id, reason } };
      }

      case 'update_order_status': {
        const { order_id, status } = call.arguments as { order_id: string; status: string };
        const validStatuses = ['awaiting_payment', 'verifying_payment', 'reupload_payment', 'processing', 'for_pickup', 'for_delivery', 'completed', 'cancelled'];
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

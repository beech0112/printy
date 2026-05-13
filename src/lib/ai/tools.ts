/**
 * AI Tool Definitions
 *
 * Tool schemas passed to the LLM (Ollama function calling format).
 * When the LLM decides to call a tool, `llm.ts` executes the handler
 * and feeds the result back as a tool message.
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

// ─── Tool Schemas ─────────────────────────────────────────────────────────────

export const TOOLS: OllamaTool[] = [
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
];

// ─── Tool Handlers ────────────────────────────────────────────────────────────

// Static service data matching the DB — used by get_services tool
const SERVICES_BY_CATEGORY: Record<string, string[]> = {
  'BIR Registered Forms': ['Sales Invoice', 'Purchase Order', 'Delivery Receipt'],
  'Commercial Forms': ['Insurance Form', 'Application Form', 'Registration Form'],
  'Business Forms': ['Business Card', 'Company Folder', 'Letterhead', 'Envelope'],
  'Commercial Printing': ['Brochures', 'Flyers', 'Posters', 'Banners'],
  Packaging: ['Soap Box', 'Coffee / Tea Box', 'Pharmaceutical Box', 'Paper Bag', 'Hang Tag'],
  'Digital Printing': ['Photo Prints', 'Canvas Prints', 'Stickers', 'Labels'],
  'Large Format Printing': ['Signage', 'Vehicle Wraps', 'Window Graphics'],
};

export interface ToolExecutionContext {
  sessionId?: string;
  userId?: string;
  conversationId?: string;
  // Injected by the caller so tool handlers can interact with Supabase
  supabase?: import('@supabase/supabase-js').SupabaseClient;
}

export async function executeTool(
  call: ToolCall,
  context: ToolExecutionContext
): Promise<ToolResult> {
  try {
    switch (call.name) {
      case 'get_services': {
        const category = call.arguments.category as string | undefined;
        if (category && SERVICES_BY_CATEGORY[category]) {
          return {
            tool: call.name,
            result: { category, services: SERVICES_BY_CATEGORY[category] },
          };
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
        // Return the draft — the UI layer decides whether to auto-submit or show a confirm step
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

      case 'check_order_status': {
        const { order_id } = call.arguments as { order_id: string };
        if (!context.supabase) {
          return { tool: call.name, result: null, error: 'Supabase not available' };
        }
        const { data, error } = await context.supabase
          .from('orders')
          .select('display_id, status, created_at, updated_at')
          .or(`display_id.eq.${order_id},id.eq.${order_id}`)
          .maybeSingle();

        if (error) return { tool: call.name, result: null, error: error.message };
        if (!data) return { tool: call.name, result: null, error: 'Order not found' };
        return { tool: call.name, result: data };
      }

      case 'escalate_to_human': {
        const { reason } = call.arguments as { reason: string };
        // Mark in session metadata — the admin panel watches for this flag
        if (context.supabase && context.sessionId) {
          await context.supabase
            .from('chat_sessions')
            .update({
              metadata: { escalated: true, escalation_reason: reason },
            })
            .eq('id', context.sessionId);
        }
        return { tool: call.name, result: { escalated: true, reason } };
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

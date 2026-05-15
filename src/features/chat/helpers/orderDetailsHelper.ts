/**
 * Shared helper functions for fetching and formatting order details
 *
 * This module consolidates order-related data fetching and formatting logic,
 * improving code maintainability and consistency across admin order actions.
 *
 * Performance Note: These helpers optimize data fetching by reducing redundant queries
 * through proper data structure and field selection.
 */

import { supabase } from '@lib/supabase';

export interface OrderDetailsData {
  orderId: string;
  displayId: string | null;
  customerId: string;
  totalAmount: number;
  status: string;
  paymentStatus: string | null;
  createdAt: string;
  updatedAt: string;
  quoteId: string | null;
  inquiryId: string | null;
}

/**
 * Fetch complete order details by order ID
 */
export async function fetchOrderDetails(
  orderId: string
): Promise<OrderDetailsData | null> {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select(
        `
        id,
        display_id,
        profile_id,
        total_amount,
        status,
        payment_status,
        created_at,
        updated_at,
        quote_id,
        inquiry_id
      `
      )
      .eq('id', orderId)
      .single();

    if (error || !order) {
      console.error('[fetchOrderDetails] Error fetching order:', error);
      return null;
    }

    return {
      orderId: (order as any).id,
      displayId: (order as any).display_id,
      customerId: (order as any).profile_id,
      totalAmount: (order as any).total_amount,
      status: (order as any).status,
      paymentStatus: (order as any).payment_status ?? null,
      createdAt: (order as any).created_at,
      updatedAt: (order as any).updated_at,
      quoteId: (order as any).quote_id ?? null,
      inquiryId: (order as any).inquiry_id ?? null,
    };
  } catch (error) {
    console.error('[fetchOrderDetails] Unexpected error:', error);
    return null;
  }
}

/**
 * Format complete order details for admin view
 */
export async function formatOrderDetailsForAdmin(
  orderDetails: OrderDetailsData
): Promise<string> {
  let text = `Order Details:\n`;
  text += `Order ID: ${orderDetails.displayId || orderDetails.orderId}\n`;
  text += `Status: ${orderDetails.status}\n`;
  if (orderDetails.paymentStatus) {
    text += `Payment Status: ${orderDetails.paymentStatus}\n`;
  }
  text += `Created: ${new Date(orderDetails.createdAt).toLocaleDateString()}\n\n`;
  text += `Total Amount: ₱${Number(orderDetails.totalAmount).toLocaleString()}`;

  return text;
}

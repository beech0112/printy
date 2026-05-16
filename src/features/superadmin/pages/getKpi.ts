/**
 * KPI functions — DISABLED
 * Superadmin iteration is not active. All exports are stubs returning null.
 * Re-implement against inquiries/orders/quotes when superadmin is scoped.
 */

export interface DateRange {
  startDate: string;
  endDate: string;
}

export async function getFirstContactResolutionRate(_range: DateRange): Promise<number | null> { return null; }
export async function getAverageInitialResponseTime(_range: DateRange): Promise<number | null> { return null; }
export async function getAverageCustomerSatisfactionScore(_range: DateRange): Promise<number | null> { return null; }
export async function getEscalationRate(_range: DateRange): Promise<number | null> { return null; }
export async function getAverageServiceRequestThroughputTime(_range: DateRange): Promise<number | null> { return null; }
export async function getOrdersSourcedFromChatRate(_range: DateRange, _ordersFromOtherChannels: number): Promise<number | null> { return null; }
export async function getJobOrderAccuracyRate(_range: DateRange): Promise<number | null> { return null; }
export async function getOrderStatusInquiryRate(_range: DateRange): Promise<number | null> { return null; }
export async function getUpToDateServicePortfolioRate(_range: DateRange): Promise<number | null> { return null; }
export async function getServicePortfolioUtilizationRate(_range: DateRange): Promise<number | null> { return null; }

/**
 * Service-related type definitions
 * Used for printing services and categories throughout the application
 */

export interface ServiceCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Compat aliases
  category_id?: string;
  category_name?: string;
  display_order?: number;
}

export interface PrintingService {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  base_price: number | null;
  price_unit: string | null;
  min_quantity: number | null;
  turnaround_days: number | null;
  metadata: any;
  status: 'active' | 'inactive' | 'retired';
  created_at: string;
  updated_at: string;
  category?: ServiceCategory;
  // Optional aggregate: all-time completed orders count (from service_order_stats view)
  total_order_count?: number;
  // Compat aliases
  service_id?: string;
  service_name?: string;
  display_id?: string;
}

export interface ServiceWithCategory extends PrintingService {
  category: ServiceCategory;
}

export interface ServiceCategoryWithCount {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  service_count: number;
  services: PrintingService[];
  // Compat aliases
  category_id?: string;
  category_name?: string;
  display_order?: number;
}

// Legacy type for backward compatibility during migration
export interface ServiceItem {
  id: string;
  name: string;
  code: string;
  status: 'Active' | 'Inactive' | 'Retired';
  category: string;
}

// Helper type for service status
export type ServiceStatus = 'active' | 'inactive' | 'retired';

// Helper type for service filtering
export interface ServiceFilters {
  status?: ServiceStatus[];
  category_id?: string[];
  search?: string;
}

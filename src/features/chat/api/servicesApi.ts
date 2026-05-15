/**
 * Services API module
 * Handles all service-related database operations and realtime subscriptions
 */

import { supabase } from '@lib/supabase';
import type {
  ServiceCategory,
  ServiceWithCategory,
  ServiceCategoryWithCount,
  ServiceFilters,
} from '@shared/types/service';
import type { SelectOption } from '@shared/components/ui/SearchableSelect';

let serviceOrderStatsCache: Promise<Record<string, number>> | null = null;

export function invalidateServiceOrderStatsCache(): void {
  serviceOrderStatsCache = null;
}

const SERVICE_SELECT = '*, category:service_categories(*)';
const CATEGORY_SELECT = '*, services:printing_services(*)';

function normalizeService(s: any): ServiceWithCategory {
  const cat = s.category;
  return {
    ...s,
    // Compat aliases so existing consumers don't break
    service_id: s.id,
    service_name: s.name,
    display_id: s.id,
    category: cat
      ? {
          ...cat,
          category_id: cat.id,
          category_name: cat.name,
          display_order: cat.sort_order,
        }
      : undefined,
  };
}

function normalizeCategory(cat: any, services: any[] = []): ServiceCategoryWithCount {
  return {
    ...cat,
    category_id: cat.id,
    category_name: cat.name,
    display_order: cat.sort_order,
    service_count: services.length,
    services: services.map(s => normalizeService({ ...s, category: cat })),
  };
}

/**
 * Fetch all services with their categories
 */
export async function fetchAllServices(): Promise<ServiceWithCategory[]> {
  const { data, error } = await supabase
    .from('printing_services')
    .select(SERVICE_SELECT)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all services:', error);
    throw error;
  }

  const services = (data || []).map(normalizeService);

  try {
    const counts = await fetchServiceOrderStats();
    return services.map(s => ({ ...s, total_order_count: counts[s.id] ?? 0 }));
  } catch {
    return services;
  }
}

/**
 * Fetch only active services
 */
export async function fetchActiveServices(): Promise<ServiceWithCategory[]> {
  const { data, error } = await supabase
    .from('printing_services')
    .select(SERVICE_SELECT)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching active services:', error);
    throw error;
  }

  const services = (data || []).map(normalizeService);

  try {
    const counts = await fetchServiceOrderStats();
    return services.map(s => ({ ...s, total_order_count: counts[s.id] ?? 0 }));
  } catch {
    return services;
  }
}

/**
 * Fetch services grouped by category
 */
export async function fetchServicesByCategory(): Promise<ServiceCategoryWithCount[]> {
  const { data, error } = await supabase
    .from('service_categories')
    .select(CATEGORY_SELECT)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching services by category:', error);
    throw error;
  }

  let counts: Record<string, number> = {};
  try { counts = await fetchServiceOrderStats(); } catch {}

  return (data || []).map((cat: any) => {
    const services = cat.services || [];
    const norm = normalizeCategory(cat, services);
    return {
      ...norm,
      services: norm.services.map(s => ({
        ...s,
        total_order_count: counts[s.id] ?? 0,
      })),
    };
  });
}

/**
 * Fetch active services grouped by category
 */
export async function fetchActiveServicesByCategory(): Promise<ServiceCategoryWithCount[]> {
  const { data, error } = await supabase
    .from('service_categories')
    .select(`*, services:printing_services!inner(*)`)
    .eq('is_active', true)
    .eq('services.status', 'active')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching active services by category:', error);
    throw error;
  }

  let counts: Record<string, number> = {};
  try { counts = await fetchServiceOrderStats(); } catch {}

  return (data || []).map((cat: any) => {
    const services = cat.services || [];
    const norm = normalizeCategory(cat, services);
    return {
      ...norm,
      services: norm.services.map(s => ({
        ...s,
        total_order_count: counts[s.id] ?? 0,
      })),
    };
  });
}

/**
 * Fetch services with filters
 */
export async function fetchServicesWithFilters(
  filters: ServiceFilters
): Promise<ServiceWithCategory[]> {
  let query = supabase.from('printing_services').select(SERVICE_SELECT);

  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  if (filters.category_id && filters.category_id.length > 0) {
    query = query.in('category_id', filters.category_id);
  }

  if (filters.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching filtered services:', error);
    throw error;
  }

  return (data || []).map(normalizeService);
}

/**
 * Fetch all categories
 */
export async function fetchCategories(): Promise<ServiceCategory[]> {
  const { data, error } = await supabase
    .from('service_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }

  return (data || []).map((cat: any) => ({
    ...cat,
    category_id: cat.id,
    category_name: cat.name,
    display_order: cat.sort_order,
  })) as ServiceCategory[];
}

/**
 * Get active categories (alias for fetchCategories)
 */
export const getActiveCategories = fetchCategories;

/**
 * Get active services for a given category (minimal fields for dropdown)
 */
export async function getActiveServicesByCategory(
  categoryId: string
): Promise<Array<{ display_id: string; service_name: string }>> {
  if (!categoryId) return [];
  const { data, error } = await supabase
    .from('printing_services')
    .select('id, name')
    .eq('status', 'active')
    .eq('category_id', categoryId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching services by category:', error);
    throw error;
  }
  return (data || []).map((s: any) => ({
    display_id: s.id,
    service_name: s.name,
  }));
}

/** Get a single category by id (minimal) */
export async function getCategoryById(
  categoryId: string
): Promise<{ category_id: string; category_name: string } | null> {
  const { data, error } = await supabase
    .from('service_categories')
    .select('id, name')
    .eq('id', categoryId)
    .maybeSingle();
  if (error) {
    console.error('Error fetching category by id:', error);
    return null;
  }
  if (!data) return null;
  return { category_id: (data as any).id, category_name: (data as any).name };
}

/**
 * Search categories and return SelectOption format
 */
export async function categoryOptions(
  q = '',
  limit = 50
): Promise<SelectOption[]> {
  const like = q?.trim() ? `%${q.trim()}%` : undefined;
  const base = supabase
    .from('service_categories')
    .select('id, name')
    .eq('is_active', true);
  const query = like ? base.ilike('name', like) : base;
  const { data, error } = await query
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .limit(limit);
  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
  return (data || []).map((c: any) => ({
    value: c.id,
    label: c.name,
  }));
}

/**
 * Search services by category and return SelectOption format
 */
export async function serviceOptions(
  categoryId: string,
  q = '',
  limit = 100
): Promise<SelectOption[]> {
  if (!categoryId) return [];
  const searchTerm = q?.trim() || '';
  const base = supabase
    .from('printing_services')
    .select('id, name')
    .eq('status', 'active')
    .eq('category_id', categoryId);
  const query = searchTerm
    ? base.ilike('name', `%${searchTerm}%`)
    : base;
  const { data, error } = await query
    .order('name', { ascending: true })
    .limit(limit);
  if (error) {
    console.error('Error fetching services:', error);
    return [];
  }
  return (data || []).map((s: any) => ({
    value: s.id,
    label: s.name,
  }));
}

/**
 * Subscribe to services changes for realtime updates
 */
export function subscribeToServices(
  onUpdate: (services: ServiceWithCategory[]) => void
) {
  return supabase
    .channel('printing_services_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'printing_services' },
      () => { fetchAllServices().then(onUpdate).catch(console.error); }
    )
    .subscribe();
}

/**
 * Subscribe to service categories changes for realtime updates
 */
export function subscribeToServiceCategories(onUpdate: () => void) {
  return supabase
    .channel('service_categories_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'service_categories' },
      () => { onUpdate(); }
    )
    .subscribe();
}

/**
 * Subscribe to active services changes
 */
export function subscribeToActiveServices(
  onUpdate: (services: ServiceWithCategory[]) => void
) {
  return supabase
    .channel('printing_services_active_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'printing_services',
        filter: 'status=eq.active',
      },
      () => { fetchActiveServices().then(onUpdate).catch(console.error); }
    )
    .subscribe();
}

/**
 * Get service by ID
 */
export async function fetchServiceByDisplayId(
  displayId: string
): Promise<ServiceWithCategory | null> {
  const { data, error } = await supabase
    .from('printing_services')
    .select(SERVICE_SELECT)
    .eq('id', displayId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching service by ID:', error);
    throw error;
  }

  const service = normalizeService(data);
  try {
    const counts = await fetchServiceOrderStats();
    return { ...service, total_order_count: counts[service.id] ?? 0 };
  } catch {
    return service;
  }
}

/**
 * Search services by name or description
 */
export async function searchServices(
  searchTerm: string
): Promise<ServiceWithCategory[]> {
  const { data, error } = await supabase
    .from('printing_services')
    .select(SERVICE_SELECT)
    .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error searching services:', error);
    throw error;
  }

  const services = (data || []).map(normalizeService);
  try {
    const counts = await fetchServiceOrderStats();
    return services.map(s => ({ ...s, total_order_count: counts[s.id] ?? 0 }));
  } catch {
    return services;
  }
}

/**
 * Fetch per-service completed order counts from the view
 */
async function fetchServiceOrderStatsFromDb(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('service_order_stats')
    .select('service_id,total_order_count');
  if (error) {
    console.error('Error fetching service order stats:', error);
    throw error;
  }
  const result: Record<string, number> = {};
  (data || []).forEach((row: any) => {
    if (row.service_id)
      result[row.service_id] = Number(row.total_order_count) || 0;
  });
  return result;
}

export async function fetchServiceOrderStats(
  options: { forceRefresh?: boolean; useCache?: boolean } = {}
): Promise<Record<string, number>> {
  const { forceRefresh = false, useCache = true } = options;

  if (!useCache) {
    if (forceRefresh) invalidateServiceOrderStatsCache();
    return fetchServiceOrderStatsFromDb();
  }

  if (!serviceOrderStatsCache || forceRefresh) {
    serviceOrderStatsCache = fetchServiceOrderStatsFromDb().catch(error => {
      serviceOrderStatsCache = null;
      throw error;
    });
  }

  return serviceOrderStatsCache;
}

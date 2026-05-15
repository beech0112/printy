import { supabase } from '@lib/supabase';

export type Region = { id: string; name: string };
export type Province = { id: string; name: string; region_id: string };
export type City = { id: string; name: string; province_id: string };

export type Option = { value: string; label: string };

const toOption = (row: Region | Province | City): Option => ({
  value: row.id,
  label: row.name,
});

export async function searchRegions(
  query: string,
  limit = 50
): Promise<Region[]> {
  const like = query?.trim() ? `%${query.trim()}%` : undefined;
  const base = supabase.from('regions').select('id, name');
  const q = like ? base.ilike('name', like) : base;
  const { data, error } = await q
    .order('name', { ascending: true })
    .limit(limit);
  if (error) {
    console.error('Error fetching regions:', error);
    return [];
  }
  return (data || []) as Region[];
}

export async function searchProvinces(
  regionId: string,
  query: string,
  limit = 100
): Promise<Province[]> {
  if (!regionId) return [];
  const like = query?.trim() ? `%${query.trim()}%` : undefined;
  const base = supabase
    .from('provinces')
    .select('id, name, region_id')
    .eq('region_id', regionId);
  const q = like ? base.ilike('name', like) : base;
  const { data, error } = await q
    .order('name', { ascending: true })
    .limit(limit);
  if (error) {
    console.error('Error fetching provinces:', error);
    return [];
  }
  return (data || []) as Province[];
}

export async function searchCities(
  provinceId: string,
  query: string,
  limit = 100
): Promise<City[]> {
  if (!provinceId) return [];
  const like = query?.trim() ? `%${query.trim()}%` : undefined;
  const base = supabase
    .from('cities')
    .select('id, name, province_id')
    .eq('province_id', provinceId);
  const q = like ? base.ilike('name', like) : base;
  const { data, error } = await q
    .order('name', { ascending: true })
    .limit(limit);
  if (error) {
    console.error('Error fetching cities:', error);
    return [];
  }
  return (data || []) as City[];
}

export async function regionOptions(q = '', limit = 50): Promise<Option[]> {
  const rows = await searchRegions(q, limit);
  return rows.map(toOption);
}

export async function provinceOptions(
  regionId: string,
  q = '',
  limit = 100
): Promise<Option[]> {
  const rows = await searchProvinces(regionId, q, limit);
  return rows.map(toOption);
}

export async function cityOptions(
  provinceId: string,
  q = '',
  limit = 100
): Promise<Option[]> {
  const rows = await searchCities(provinceId, q, limit);
  return rows.map(toOption);
}

export async function findRegionIdByName(
  regionName: string
): Promise<string | null> {
  if (!regionName || !regionName.trim()) return null;
  const { data, error } = await supabase
    .from('regions')
    .select('id')
    .ilike('name', regionName.trim())
    .maybeSingle();
  if (error) {
    console.error('Error finding region ID:', error);
    return null;
  }
  return data?.id || null;
}

export async function findProvinceIdByName(
  provinceName: string,
  regionId: string
): Promise<string | null> {
  if (!provinceName || !provinceName.trim() || !regionId) return null;
  const { data, error } = await supabase
    .from('provinces')
    .select('id')
    .eq('region_id', regionId)
    .ilike('name', provinceName.trim())
    .maybeSingle();
  if (error) {
    console.error('Error finding province ID:', error);
    return null;
  }
  return data?.id || null;
}

export async function findCityIdByName(
  cityName: string,
  provinceId: string
): Promise<string | null> {
  if (!cityName || !cityName.trim() || !provinceId) return null;
  const { data, error } = await supabase
    .from('cities')
    .select('id')
    .eq('province_id', provinceId)
    .ilike('name', cityName.trim())
    .maybeSingle();
  if (error) {
    if (error.code === 'PGRST116') {
      console.error(
        `Error finding city ID: Duplicate cities found for "${cityName}" in province ${provinceId}.`,
        error
      );
    } else {
      console.error('Error finding city ID:', error);
    }
    return null;
  }
  return data?.id || null;
}

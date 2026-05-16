import { supabase } from '@lib/supabase';
import { normalizePhone } from '@/shared/utils/formsFormatter';

export interface CustomerProfile {
  customer_id: string;
  first_name: string;
  last_name: string;
  contact_no: string;
  email_address: string;
  customer_type: string;
  gender?: string;
  birthday?: string;
  address: {
    id?: string;
    region_id?: string;
    province_id?: string;
    city_id?: string;
    region_name?: string;
    province_name?: string;
    city_name?: string;
    barangay?: string;
    street?: string;
    zip_code?: string;
    is_default?: boolean;
  };
}

export interface UpdateProfileData {
  first_name?: string;
  last_name?: string;
  contact_no?: string;
  email_address?: string;
  gender?: string;
  birthday?: string;
  address?: {
    region_id?: string;
    province_id?: string;
    city_id?: string;
    barangay?: string;
    street?: string;
    zip_code?: string;
  };
}

export class ProfileService {
  static async getProfile(userId: string): Promise<CustomerProfile | null> {
    try {
      if (!supabase) return null;

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, customer_type')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        if (
          profileError.message.includes('Failed to fetch') ||
          profileError.message.includes('NetworkError')
        ) {
          return null;
        }
        throw new Error(`Failed to fetch profile: ${profileError.message}`);
      }

      if (!profileData) return null;

      const { data: addressData } = await supabase
        .from('user_addresses')
        .select(
          'id, region_id, province_id, city_id, barangay, street, zip_code, is_default, region:regions(name), province:provinces(name), city:cities(name)'
        )
        .eq('profile_id', userId)
        .eq('is_default', true)
        .maybeSingle();

      const addr = addressData as any;
      const address: CustomerProfile['address'] = addr
        ? {
            id: addr.id,
            region_id: addr.region_id,
            province_id: addr.province_id,
            city_id: addr.city_id,
            region_name: addr.region?.name ?? '',
            province_name: addr.province?.name ?? '',
            city_name: addr.city?.name ?? '',
            barangay: addr.barangay ?? '',
            street: addr.street ?? '',
            zip_code: addr.zip_code ?? '',
            is_default: addr.is_default,
          }
        : {};

      return {
        customer_id: profileData.id,
        first_name: profileData.first_name || '',
        last_name: profileData.last_name || '',
        contact_no: profileData.phone || '',
        email_address: profileData.email || '',
        customer_type: profileData.customer_type || '',
        address,
      };
    } catch (error) {
      console.error('Error in ProfileService.getProfile:', error);
      if (
        error instanceof Error &&
        (error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError'))
      ) {
        return null;
      }
      throw error;
    }
  }

  static async updateProfile(
    userId: string,
    updates: UpdateProfileData
  ): Promise<boolean> {
    try {
      if (updates.contact_no !== undefined) {
        const normalizedPhone = normalizePhone(updates.contact_no);
        if (normalizedPhone) {
          const { data: duplicateCheck, error: phoneCheckError } =
            await supabase.rpc('check_auth_user_duplicates', {
              p_email: null,
              p_phone: normalizedPhone,
              p_exclude_user_id: userId,
            });

          if (phoneCheckError) {
            console.error('Error checking phone:', phoneCheckError);
            return false;
          }

          if (duplicateCheck?.phone_exists) {
            throw new Error(
              'DUPLICATE_PHONE: This mobile number is already registered. Please use a different number.'
            );
          }
        }
      }

      const profileUpdates: Record<string, unknown> = {};
      if (updates.first_name !== undefined)
        profileUpdates.first_name = updates.first_name;
      if (updates.last_name !== undefined)
        profileUpdates.last_name = updates.last_name;
      if (updates.contact_no !== undefined)
        profileUpdates.phone = normalizePhone(updates.contact_no);

      if (Object.keys(profileUpdates).length > 0) {
        const { error } = await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', userId);
        if (error) {
          console.error('Error updating profile:', error);
          return false;
        }
      }

      if (updates.address) {
        const a = updates.address;
        const addressPayload: Record<string, unknown> = {};
        if (a.region_id !== undefined) addressPayload.region_id = a.region_id;
        if (a.province_id !== undefined)
          addressPayload.province_id = a.province_id;
        if (a.city_id !== undefined) addressPayload.city_id = a.city_id;
        if (a.barangay !== undefined) addressPayload.barangay = a.barangay;
        if (a.street !== undefined) addressPayload.street = a.street;
        if (a.zip_code !== undefined) addressPayload.zip_code = a.zip_code;

        if (Object.keys(addressPayload).length > 0) {
          const { data: existing } = await supabase
            .from('user_addresses')
            .select('id')
            .eq('profile_id', userId)
            .eq('is_default', true)
            .maybeSingle();

          if (existing) {
            const { error } = await supabase
              .from('user_addresses')
              .update({ ...addressPayload, updated_at: new Date().toISOString() })
              .eq('id', existing.id);
            if (error) {
              console.error('Error updating address:', error);
              return false;
            }
          } else {
            const { error } = await supabase
              .from('user_addresses')
              .insert({ ...addressPayload, profile_id: userId, is_default: true });
            if (error) {
              console.error('Error inserting address:', error);
              return false;
            }
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Error in ProfileService.updateProfile:', error);
      if (error instanceof Error && error.message.includes('DUPLICATE_PHONE')) {
        throw error;
      }
      return false;
    }
  }

  static formatAddress(address: CustomerProfile['address']): string {
    const parts: string[] = [];
    if (address.street) parts.push(address.street);
    if (address.barangay) parts.push(address.barangay);
    if (address.city_name) parts.push(address.city_name);
    if (address.province_name) parts.push(address.province_name);
    if (address.region_name) parts.push(address.region_name);
    if (address.zip_code) parts.push(address.zip_code);
    return parts.join(', ');
  }

  static getDisplayName(firstName: string, lastName: string): string {
    const first = firstName?.trim() || '';
    const last = lastName?.trim() || '';
    return `${first} ${last}`.trim();
  }
}

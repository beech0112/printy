import { supabase } from '@lib/supabase';

export interface CustomerSearchResult {
  customer_id: string;
  first_name: string;
  last_name: string;
  email_address: string;
  contact_no: string;
  customer_type: string;
}

export interface CustomerDetails extends CustomerSearchResult {
  gender?: string;
  birthday?: string;
  address?: {
    street?: string;
    barangay?: string;
    city_name?: string;
    province_name?: string;
    region_name?: string;
    zip_code?: string;
  };
}

export class CustomerService {
  static async searchCustomers(query: string): Promise<CustomerSearchResult[]> {
    try {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) return [];

      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          trimmedQuery
        );

      if (isUUID) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, phone, customer_type')
          .eq('id', trimmedQuery)
          .limit(10);

        if (error) {
          console.error('Error searching customers by ID:', error);
          return [];
        }

        return (data || []).map((r: any) => ({
          customer_id: r.id,
          first_name: r.first_name || '',
          last_name: r.last_name || '',
          email_address: r.email || '',
          contact_no: r.phone || '',
          customer_type: r.customer_type || 'regular',
        }));
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, customer_type')
        .or(
          `email.ilike.%${trimmedQuery}%,first_name.ilike.%${trimmedQuery}%,last_name.ilike.%${trimmedQuery}%`
        )
        .limit(10);

      if (error) {
        console.error('Error searching customers:', error);
        return [];
      }

      return (data || []).map((r: any) => ({
        customer_id: r.id,
        first_name: r.first_name || '',
        last_name: r.last_name || '',
        email_address: r.email || '',
        contact_no: r.phone || '',
        customer_type: r.customer_type || 'regular',
      }));
    } catch (error) {
      console.error('Error in searchCustomers:', error);
      return [];
    }
  }

  static async getCustomerById(
    customerId: string
  ): Promise<CustomerDetails | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, customer_type')
        .eq('id', customerId)
        .single();

      if (error) {
        console.error('Error fetching customer:', error);
        return null;
      }

      if (!data) return null;

      const customerType = data.customer_type
        ? String(data.customer_type).trim().toLowerCase()
        : 'regular';
      const normalizedCustomerType =
        customerType === 'valued' || customerType === 'regular'
          ? customerType
          : 'regular';

      return {
        customer_id: (data as any).id,
        first_name: (data as any).first_name || '',
        last_name: (data as any).last_name || '',
        email_address: (data as any).email || '',
        contact_no: (data as any).phone || '',
        customer_type: normalizedCustomerType,
        address: undefined,
      };
    } catch (error) {
      console.error('Error in getCustomerById:', error);
      return null;
    }
  }

  static async updateCustomerType(
    customerId: string,
    customerType: 'regular' | 'valued'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (customerType !== 'regular' && customerType !== 'valued') {
        return {
          success: false,
          error: 'Invalid customer type. Must be "regular" or "valued".',
        };
      }

      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData?.user) {
        return { success: false, error: 'User not authenticated.' };
      }

      const currentUserId = userData.user.id;

      const { data: adminCheck, error: adminCheckError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUserId)
        .single();

      if (adminCheckError || !adminCheck) {
        console.error('Error checking admin status:', adminCheckError);
        return { success: false, error: 'Unable to verify admin permissions.' };
      }

      const userRole = String((adminCheck as any).role || '').toLowerCase();
      const isAdmin = userRole === 'admin' || userRole === 'superadmin';

      if (!isAdmin) {
        return {
          success: false,
          error:
            'Only admins can update customer types. Superadmins are not allowed to perform this action.',
        };
      }

      const { data: customerData, error: customerFetchError } = await supabase
        .from('profiles')
        .select('customer_type')
        .eq('id', customerId)
        .single();

      if (customerFetchError || !customerData) {
        console.error('Error fetching customer:', customerFetchError);
        return { success: false, error: 'Customer not found.' };
      }

      const currentCustomerType = String(
        (customerData as any).customer_type || ''
      )
        .toLowerCase()
        .trim();

      if (currentCustomerType === 'valued' && customerType === 'regular') {
        return {
          success: false,
          error:
            'Cannot change customer type from valued to regular. Changes are one-way only (regular to valued).',
        };
      }

      if (currentCustomerType === customerType) {
        return { success: true };
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({ customer_type: customerType })
        .eq('id', customerId)
        .select();

      if (error) {
        console.error('Error updating customer type:', error);
        return {
          success: false,
          error: error.message || 'Failed to update customer type.',
        };
      }

      if (!data || data.length === 0) {
        return {
          success: false,
          error:
            'Update was blocked. The customer may not exist, or you may not have permission to update this customer.',
        };
      }

      const updatedType = (data[0] as any)?.customer_type;
      if (updatedType !== customerType) {
        return {
          success: false,
          error: `Update completed but customer type is "${updatedType}" instead of "${customerType}".`,
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in updateCustomerType:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update customer type.',
      };
    }
  }
}

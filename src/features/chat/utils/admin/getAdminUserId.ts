import { supabase } from '@lib/supabase';

/**
 * Get the CURRENT authenticated admin user ID from the customer table.
 * This must reflect the actor who triggered the action so DB triggers
 * can attribute and exclude them correctly for notifications.
 */
export async function getAdminUserId(): Promise<string> {
  // Get current authenticated user (auth.users.id)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    console.error(
      '[getAdminUserId] Error fetching current auth user:',
      authError
    );
    throw new Error('Not authenticated');
  }

  // Verify this auth user is an admin in public.profiles and return the same UUID
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (error || !data) {
    console.error(
      '[getAdminUserId] Error fetching profile record for current user:',
      error
    );
    throw new Error('Failed to resolve current user');
  }

  const role = String((data as any).role || '').toLowerCase();
  if (role !== 'admin' && role !== 'superadmin') {
    console.error('[getAdminUserId] Current user is not an admin');
    throw new Error('Forbidden: user is not an admin');
  }

  return (data as any).id;
}

/**
 * Get all admin user IDs from the customer table
 * Used for creating notifications to all admins
 */
export async function getAllAdminIds(): Promise<string[]> {
  const { data: admins, error: adminError } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['admin', 'superadmin']);

  if (adminError || !admins) {
    console.error('[getAllAdminIds] Error fetching admin users:', adminError);
    throw new Error('Failed to fetch admin users');
  }

  return admins.map((admin: any) => admin.id);
}

/**
 * Get admin user information by customer_id
 * Returns admin's first_name and last_name for display purposes
 * Uses RPC function to bypass RLS, allowing customers to see admin names in conversations
 */
export async function getAdminUserInfo(
  adminId: string
): Promise<{ first_name: string; last_name: string; fullName: string } | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', adminId)
      .single();

    if (error || !data) {
      console.error('[getAdminUserInfo] Error fetching admin user:', error);
      return null;
    }

    const first_name = (data as any).first_name || '';
    const last_name = (data as any).last_name || '';
    return {
      first_name,
      last_name,
      fullName: [first_name, last_name].filter(Boolean).join(' ') || 'Admin',
    };
  } catch (error) {
    console.error('[getAdminUserInfo] Unexpected error:', error);
    return null;
  }
}

/**
 * Get admin user information for multiple admin IDs
 * Useful for batch fetching admin names when displaying multiple messages
 * Uses RPC function to bypass RLS, allowing customers to see admin names in conversations
 */
export async function getAdminUserInfoBatch(
  adminIds: string[]
): Promise<
  Map<string, { first_name: string; last_name: string; fullName: string }>
> {
  const adminInfoMap = new Map<
    string,
    { first_name: string; last_name: string; fullName: string }
  >();

  if (adminIds.length === 0) {
    return adminInfoMap;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', adminIds);

    if (error) {
      console.error('[getAdminUserInfoBatch] Error fetching admin users:', error);
      return adminInfoMap;
    }

    for (const row of data || []) {
      const first_name = (row as any).first_name || '';
      const last_name = (row as any).last_name || '';
      adminInfoMap.set((row as any).id, {
        first_name,
        last_name,
        fullName: [first_name, last_name].filter(Boolean).join(' ') || 'Admin',
      });
    }
  } catch (error) {
    console.error('[getAdminUserInfoBatch] Unexpected error:', error);
  }

  return adminInfoMap;
}

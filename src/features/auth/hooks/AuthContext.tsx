import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@lib/supabase';

// profiles.role — who you are in the system
export type ProfileRole = 'customer' | 'admin' | 'superadmin';

// profiles.customer_type — VIP tier, only meaningful for role='customer'
export type CustomerType = 'regular' | 'valued';

// The merged "effective role" used by routing guards — kept for backward compat
// regular customer   → 'regular'
// valued customer    → 'valued'
// admin              → 'admin'
// superadmin         → 'superadmin'
export type Role = 'regular' | 'valued' | 'admin' | 'superadmin';

export const getHomePath = (role?: Role) => {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'superadmin':
      return '/superadmin';
    case 'valued':
    case 'regular':
    default:
      return '/customer';
  }
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  /** Effective role used by routing guards */
  role: Role | undefined;
  /** Raw profiles.role — 'customer' | 'admin' | 'superadmin' */
  profileRole: ProfileRole | undefined;
  /** profiles.customer_type — only set for role='customer' rows */
  customerType: CustomerType | undefined;
};

type AuthContextValue = AuthState & {
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  loading: true,
  session: null,
  user: null,
  role: undefined,
  profileRole: undefined,
  customerType: undefined,
  refresh: async () => {},
});

async function fetchProfileForUser(user: User | null): Promise<{
  role: Role | undefined;
  profileRole: ProfileRole | undefined;
  customerType: CustomerType | undefined;
}> {
  if (!user?.id) return { role: undefined, profileRole: undefined, customerType: undefined };
  try {
    const { data } = await supabase
      .from('profiles')
      .select('role, customer_type')
      .eq('id', user.id)
      .maybeSingle();

    if (!data) return { role: undefined, profileRole: undefined, customerType: undefined };

    const profileRole = data.role as ProfileRole;
    const customerType = (data.customer_type ?? undefined) as CustomerType | undefined;

    // Effective role for routing
    let role: Role;
    if (profileRole === 'admin') role = 'admin';
    else if (profileRole === 'superadmin') role = 'superadmin';
    else role = customerType === 'valued' ? 'valued' : 'regular';

    return { role, profileRole, customerType };
  } catch {
    return { role: 'regular', profileRole: 'customer', customerType: 'regular' };
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AuthState>({
    loading: true,
    session: null,
    user: null,
    role: undefined,
    profileRole: undefined,
    customerType: undefined,
  });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data: userData } = await supabase.auth.getUser();
      const session = sessionData.session ?? null;
      const user = userData.user ?? null;
      const profile = await fetchProfileForUser(user);
      if (mounted) setState({ loading: false, session, user, ...profile });
    };

    load();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setState(s => ({ ...s, loading: true }));
        (async () => {
          const user = session?.user ?? null;
          const profile = await fetchProfileForUser(user);
          if (mounted)
            setState({ loading: false, session: session ?? null, user, ...profile });
        })();
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const refresh = async () => {
    setState(s => ({ ...s, loading: true }));
    const { data: sessionData } = await supabase.auth.getSession();
    const { data: userData } = await supabase.auth.getUser();
    const session = sessionData.session ?? null;
    const user = userData.user ?? null;
    const profile = await fetchProfileForUser(user);
    setState({ loading: false, session, user, ...profile });
  };

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, refresh }),
    [state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@lib/supabase';
import { useToast } from '@lib/useToast';
import { formatPasswordInput } from '@/shared/utils/formsFormatter';
import {
  assertHumanTurnstile,
  primeTurnstile,
  renderInlineTurnstile,
} from '@lib/turnstile';

export interface SignInFormData {
  email: string;
  password: string;
  keepLoggedIn: boolean;
}

export const useSignIn = () => {
  const navigate = useNavigate();
  const [toasts, toast] = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [, setTurnstileReady] = useState(false);
  const [formData, setFormData] = useState<SignInFormData>({
    email: '',
    password: '',
    keepLoggedIn: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Warm-up Turnstile token in the background for snappier submit
    primeTurnstile('signin');

    // Mount a visible inline widget under password that auto-runs
    // Wait for the element to be in the DOM before rendering
    const renderTurnstile = async () => {
      let retries = 0;
      while (retries < 50) {
        const element = document.getElementById('turnstile-signin');
        if (element) {
          await renderInlineTurnstile(
            'turnstile-signin',
            'signin',
            'always',
            () => {
              setTurnstileReady(true);
            }
          );
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }
    };
    renderTurnstile();

    const mql = window.matchMedia('(min-width: 1024px)');
    const modern = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    const legacy = function (this: MediaQueryList, e: MediaQueryListEvent) {
      setIsDesktop(e.matches);
    };
    setIsDesktop(mql.matches);
    if (mql.addEventListener) mql.addEventListener('change', modern);
    else (mql as MediaQueryList).addListener(legacy);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', modern);
      else (mql as MediaQueryList).removeListener(legacy);
    };
  }, []);

  const setField = useCallback(
    (field: keyof SignInFormData, value: string | boolean) => {
      // Remove spaces from password field
      if (field === 'password' && typeof value === 'string') {
        value = formatPasswordInput(value);
      }
      setFormData(prev => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
        await assertHumanTurnstile('signin');
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (error) throw error;
        const user = data.user;
        const userId = user?.id;
        let destination = '/customer';

        if (userId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, customer_type')
            .eq('id', userId)
            .maybeSingle();

          const routeMap: Record<string, string> = {
            admin: '/admin',
            superadmin: '/superadmin',
            customer: '/customer',
            guest: '/customer',
          };
          destination = profile?.role
            ? (routeMap[profile.role] ?? '/customer')
            : '/customer';
        }
        // Store signin success flag for destination page to show toast
        sessionStorage.setItem('signin-success', 'true');
        // Navigate immediately - toast will show on destination page
        navigate(destination);
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Please check your credentials and try again.';
        toast.error('Sign In Failed', message);
      } finally {
        setLoading(false);
      }
    },
    [formData, navigate, toast]
  );

  return {
    toasts,
    toast,
    formData,
    setField,
    showPassword,
    setShowPassword,
    loading,
    isDesktop,
    // turnstileReady,
    handleSubmit,
  };
};

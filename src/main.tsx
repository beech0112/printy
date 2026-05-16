import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

import { AuthProvider } from '@auth/hooks/AuthContext';
import { SessionCacheProvider } from '@customer/components/shared/cache/SessionCacheProvider';
import { supabase } from '@lib/supabase';

const RootApp = () => {
  const [customerId, setCustomerId] = useState<string | undefined>();

  useEffect(() => {
    const getCustomerId = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCustomerId(user?.id);
    };
    getCustomerId();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setCustomerId(session?.user?.id);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <SessionCacheProvider customerId={customerId}>
          <App />
        </SessionCacheProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>
);

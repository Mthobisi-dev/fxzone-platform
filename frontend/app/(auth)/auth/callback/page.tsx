'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { safeOAuthDestination } from '@/lib/oauthRedirect';
import { useAuthStore } from '@/stores/authStore';

/** Completes Supabase OAuth PKCE redirects before entering the dashboard. */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('Completing secure sign-in…');
  const started = useRef(false);

  useEffect(() => {
    const finishSignIn = async () => {
      if (started.current) return;
      started.current = true;
      const query = new URLSearchParams(window.location.search);
      const destination = safeOAuthDestination(query.get('next'));
      const code = query.get('code');
      const flowId = query.get('sb_flow_id');
      const errorDescription = query.get('error_description') || query.get('error');
      if (errorDescription) {
        setMessage(errorDescription);
        return;
      }
      const result = code
        ? await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined)
        : await supabase.auth.getSession();
      if (result.error || !result.data.session) {
        setMessage(result.error?.message || 'Google sign-in could not be completed. Please try again.');
        return;
      }
      useAuthStore.getState()._setFromSession(result.data.session, 'SIGNED_IN');
      router.replace(destination);
      router.refresh();
    };
    void finishSignIn();
  }, [router]);

  return <main className="min-h-screen flex items-center justify-center bg-[var(--color-background)] p-6"><p className="text-sm text-[var(--color-text-muted)]" role="status">{message}</p></main>;
}

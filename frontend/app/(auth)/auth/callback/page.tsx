'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { safeOAuthDestination } from '@/lib/oauthRedirect';
import { getOAuthSupabaseClient } from '@/lib/supabaseOAuth';
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
      const oauthClient = getOAuthSupabaseClient();
      const result = code
        ? await oauthClient.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined)
        : await oauthClient.auth.getSession();
      if (result.error || !result.data.session) {
        setMessage(result.error?.message || 'Google sign-in could not be completed. Please try again.');
        return;
      }

      // The rest of FxZone currently uses the established browser client. Copy
      // the verified OAuth session into that client so existing API auth,
      // realtime subscriptions, and auth listeners continue to work unchanged.
      const persisted = await supabase.auth.setSession({
        access_token: result.data.session.access_token,
        refresh_token: result.data.session.refresh_token,
      });
      if (persisted.error || !persisted.data.session) {
        setMessage(persisted.error?.message || 'Google sign-in could not be saved. Please try again.');
        return;
      }

      useAuthStore.getState()._setFromSession(persisted.data.session, 'SIGNED_IN');
      router.replace(destination);
      router.refresh();
    };
    void finishSignIn();
  }, [router]);

  return <main className="min-h-screen flex items-center justify-center bg-[var(--color-background)] p-6"><p className="text-sm text-[var(--color-text-muted)]" role="status">{message}</p></main>;
}

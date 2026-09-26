'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

/** Completes Supabase OAuth PKCE redirects before entering the dashboard. */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('Completing secure sign-in…');

  useEffect(() => {
    const finishSignIn = async () => {
      const query = new URLSearchParams(window.location.search);
      const next = query.get('next');
      const destination = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
      const code = query.get('code');
      const errorDescription = query.get('error_description');
      if (errorDescription) {
        setMessage(decodeURIComponent(errorDescription));
        return;
      }
      const result = code ? await supabase.auth.exchangeCodeForSession(code) : await supabase.auth.getSession();
      if (result.error || !result.data.session) {
        setMessage(result.error?.message || 'Google sign-in could not be completed. Please try again.');
        return;
      }
      router.replace(destination);
      router.refresh();
    };
    void finishSignIn();
  }, [router]);

  return <main className="min-h-screen flex items-center justify-center bg-[var(--color-background)] p-6"><p className="text-sm text-[var(--color-text-muted)]" role="status">{message}</p></main>;
}

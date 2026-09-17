'use client';

/**
 * ClientInitializer — app-level bootstrapper.
 *
 * Responsibilities:
 *  1. Subscribe to Supabase onAuthStateChange ONCE — this is the
 *     single source of truth for session state. Any token refresh or
 *     OAuth redirect is handled here automatically.
 *  2. Initialize theme and notification stores after auth is resolved.
 *
 * Note: We deliberately do NOT call initialize() manually because
 * onAuthStateChange fires immediately with the current session, making
 * a separate getSession() call redundant and a source of race conditions.
 */

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { supabase } from '@/lib/supabase';

export function ClientInitializer() {
  useEffect(() => {
    // Subscribe to Supabase auth events — handles:
    //  - INITIAL_SESSION: fires immediately with current session or null
    //  - SIGNED_IN: user logged in
    //  - SIGNED_OUT: user logged out
    //  - TOKEN_REFRESHED: Supabase auto-refreshed the JWT
    //  - USER_UPDATED: profile metadata changed
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Drive auth state from Supabase events, not from ad-hoc initialize() calls
        useAuthStore.getState()._setFromSession(session);

        // After sign-in, load notifications
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          if (session) {
            // Defer to avoid blocking auth state update
            setTimeout(() => {
              useNotificationStore.getState().fetchNotifications();
            }, 500);
          }
        }

        // On sign-out, clear notifications
        if (event === 'SIGNED_OUT') {
          useNotificationStore.setState({ notifications: [], unreadCount: 0 });
        }
      }
    );

    // Initialize theme (safe, no auth needed)
    useThemeStore.getState().initialize();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}

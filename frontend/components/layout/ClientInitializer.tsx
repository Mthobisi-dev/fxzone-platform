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
import { initializeClientBootstrap } from '@/lib/clientBootstrap';
import { useChatStore } from '@/stores/chatStore';

export function ClientInitializer() {
  useEffect(() => {
    return initializeClientBootstrap({
      initializeTheme: () => useThemeStore.getState().initialize(),
      subscribeAuth: () => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event, session) => {
            useAuthStore.getState()._setFromSession(session, event);
            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
              setTimeout(() => useNotificationStore.getState().fetchNotifications(), 500);
              setTimeout(() => useChatStore.getState().fetchConversations(), 500);
            }
            if (event === 'SIGNED_OUT') {
              useNotificationStore.setState({ notifications: [], unreadCount: 0 });
              useChatStore.setState({ conversations: [], activeConversationId: null, messages: {}, typingUsers: {} });
            }
          }
        );
        return () => subscription.unsubscribe();
      },
      onAuthError: (error) => console.error('[Auth] Supabase browser initialization failed:', error),
    });
  }, []);

  return null;
}

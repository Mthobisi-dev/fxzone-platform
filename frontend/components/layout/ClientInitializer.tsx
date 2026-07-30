'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { supabase } from '@/lib/supabase';

export function ClientInitializer() {
  useEffect(() => {
    // Listen for Supabase OAuth/Google session state updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        localStorage.setItem('fxzone_access_token', session.access_token);
        if (session.refresh_token) {
          localStorage.setItem('fxzone_refresh_token', session.refresh_token);
        }
        // Sync profiles with backend
        await useAuthStore.getState().initialize();
      }
    });

    // Initialize Auth
    useAuthStore.getState().initialize();
    // Initialize Theme
    useThemeStore.getState().initialize();
    // Initialize Notifications
    useNotificationStore.getState().fetchNotifications();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}

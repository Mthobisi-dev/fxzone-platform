/**
 * useAuth — thin hook over useAuthStore.
 *
 * Route protection: pass requireAuth=true to auto-redirect to /login
 * when the session check has completed and no session is found.
 *
 * Reliability: loading=true until Supabase confirms session status, so
 * protected pages never flash-redirect before auth resolves.
 */

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function useAuth(requireAuth = false, redirectPath = '/login') {
  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    isInitialized,
    error,
    login,
    loginWithGoogle,
    register,
    logout,
    deleteAccount,
    updateProfile,
    initialize,
  } = useAuthStore();

  // Only call initialize() if onAuthStateChange hasn't fired yet
  // (i.e., if we are still in the pre-initialized state with no cached user)
  const didCallInit = useRef(false);
  useEffect(() => {
    if (!isInitialized && !isLoading && !didCallInit.current) {
      didCallInit.current = true;
      initialize();
    }
  }, [isInitialized, isLoading, initialize]);

  // Route protection: only redirect AFTER initialization is complete
  const redirecting = useRef(false);
  useEffect(() => {
    if (
      requireAuth &&
      isInitialized &&
      !isLoading &&
      !isAuthenticated &&
      !redirecting.current
    ) {
      redirecting.current = true;
      if (typeof window !== 'undefined') {
        window.location.href = redirectPath;
      }
    }
  }, [requireAuth, isInitialized, isLoading, isAuthenticated, redirectPath]);

  return {
    user,
    token,
    isAuthenticated,
    // Keep the spinner up until Supabase has confirmed session status
    isLoading: !isInitialized || isLoading,
    error,
    login,
    loginWithGoogle,
    register,
    logout,
    deleteAccount,
    updateProfile,
  };
}

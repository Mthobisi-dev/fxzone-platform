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

  // Call initialize() immediately if state is not initialized yet
  const didCallInit = useRef(false);
  useEffect(() => {
    if (!isInitialized && !didCallInit.current) {
      didCallInit.current = true;
      initialize();
    }
  }, [isInitialized, initialize]);

  // Route protection: only redirect AFTER initialization has completed
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

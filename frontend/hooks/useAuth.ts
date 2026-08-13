import { useEffect } from 'react';
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
    updateProfile,
    initialize
  } = useAuthStore();

  useEffect(() => {
    // Run background token validation if not yet initialized
    if (!isInitialized && !isLoading) {
      initialize();
    }
  }, [isInitialized, isLoading, initialize]);

  useEffect(() => {
    // ONLY redirect if initialization is completely DONE and user is NOT authenticated
    if (requireAuth && isInitialized && !isLoading && !isAuthenticated) {
      if (typeof window !== 'undefined') {
        window.location.href = redirectPath;
      }
    }
  }, [requireAuth, isInitialized, isLoading, isAuthenticated, redirectPath]);

  return {
    user,
    token,
    isAuthenticated,
    isLoading: isLoading || !isInitialized, // Return loading state until fully initialized
    error,
    login,
    loginWithGoogle,
    register,
    logout,
    updateProfile,
  };
}

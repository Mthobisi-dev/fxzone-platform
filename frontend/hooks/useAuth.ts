import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function useAuth(requireAuth = false, redirectPath = '/login') {
  const { user, token, isAuthenticated, isLoading, error, login, loginWithGoogle, register, logout, updateProfile, initialize } = useAuthStore();

  useEffect(() => {
    // Run initialization if not yet done
    if (!isAuthenticated && !token && !isLoading) {
      initialize();
    }
  }, [isAuthenticated, token, initialize, isLoading]);

  useEffect(() => {
    // If auth is required, verify user is logged in once loading completes
    if (requireAuth && !isLoading && !isAuthenticated) {
      if (typeof window !== 'undefined') {
        window.location.href = redirectPath;
      }
    }
  }, [requireAuth, isAuthenticated, isLoading, redirectPath]);

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    login,
    loginWithGoogle,
    register,
    logout,
    updateProfile,
  };
}

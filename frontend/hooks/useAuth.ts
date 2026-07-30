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
    const hasLocalToken = typeof window !== 'undefined' ? !!localStorage.getItem('fxzone_access_token') : false;
    
    // If auth is required, verify user is logged in and not initializing a local token
    if (requireAuth && !isLoading && !isAuthenticated && !hasLocalToken) {
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

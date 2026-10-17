import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export function useAuth(requireAuth = false, redirectPath = '/login') {
  const router = useRouter();
  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    isInitialized,
    error,
    login,
    loginWithGoogle,
    register: registerInStore,
    logout: logoutInStore,
    deleteAccount: deleteAccountInStore,
    updateProfile,
    initialize,
  } = useAuthStore();

  const register = useCallback(async (...args: Parameters<typeof registerInStore>) => {
    await registerInStore(...args);
    // Signup can require email confirmation, in which case the form stays visible.
    if (useAuthStore.getState().isAuthenticated) router.replace('/dashboard');
  }, [registerInStore, router]);

  const logout = useCallback(async () => {
    await logoutInStore();
    router.replace('/login');
    router.refresh();
  }, [logoutInStore, router]);

  const deleteAccount = useCallback(async () => {
    await deleteAccountInStore();
    router.replace('/login');
    router.refresh();
  }, [deleteAccountInStore, router]);

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
      router.replace(redirectPath);
    }
  }, [requireAuth, isInitialized, isLoading, isAuthenticated, redirectPath, router]);

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

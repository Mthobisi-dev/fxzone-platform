import { create } from 'zustand';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface User {
  id: string;
  email: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.post('/api/auth/login', { email, password });
      localStorage.setItem('fxzone_access_token', data.access_token);
      localStorage.setItem('fxzone_refresh_token', data.refresh_token);
      set({
        user: data.user,
        token: data.access_token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      set({
        error: err.detail || 'Failed to authenticate user.',
        isLoading: false,
      });
      throw err;
    }
  },

  loginWithGoogle: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : '/dashboard',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) {
        throw error;
      }
      // OAuth redirect will handle the rest — session picked up by auth listener on return
    } catch (err: any) {
      console.warn('Google OAuth sign-in failed:', err);
      set({
        error: 'Google login is not available. To enable it, the Google provider must be configured in the Supabase Dashboard (Authentication → Providers → Google). Please sign in with email and password instead.',
        isLoading: false,
      });
    }
  },

  register: async (registerData) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.post('/api/auth/register', registerData);
      localStorage.setItem('fxzone_access_token', data.access_token);
      localStorage.setItem('fxzone_refresh_token', data.refresh_token);
      set({
        user: data.user,
        token: data.access_token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      set({
        error: err.detail || 'Registration failed.',
        isLoading: false,
      });
      throw err;
    }
  },

  logout: () => {
    // Also sign out from Supabase if active
    supabase.auth.signOut().catch(() => {});
    localStorage.removeItem('fxzone_access_token');
    localStorage.removeItem('fxzone_refresh_token');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },

  updateProfile: async (profileData) => {
    set({ isLoading: true, error: null });
    try {
      const updatedUser = await api.put('/api/auth/me', profileData);
      set({ user: updatedUser, isLoading: false });
    } catch (err: any) {
      set({
        error: err.detail || 'Failed to update profile.',
        isLoading: false,
      });
      throw err;
    }
  },

  initialize: async () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('fxzone_access_token');
    if (!token) return;

    set({ isLoading: true });
    try {
      const user = await api.get('/api/auth/me');
      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      // Token expired or invalid
      localStorage.removeItem('fxzone_access_token');
      localStorage.removeItem('fxzone_refresh_token');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));

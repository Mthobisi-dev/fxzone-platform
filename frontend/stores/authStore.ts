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
  isInitialized: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (email?: string, name?: string, avatar_url?: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  initialize: () => Promise<void>;
}

// Synchronous initial state hydration from localStorage to prevent flash/redirect on refresh
const getInitialState = () => {
  if (typeof window === 'undefined') {
    return {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
    };
  }

  const token = localStorage.getItem('fxzone_access_token');
  const cachedUserStr = localStorage.getItem('fxzone_user');
  let user: User | null = null;
  if (cachedUserStr) {
    try {
      user = JSON.parse(cachedUserStr);
    } catch {
      user = null;
    }
  }

  const hasToken = !!token;
  return {
    user,
    token,
    isAuthenticated: hasToken, // Optimistically true while background validation runs
    isLoading: hasToken,       // Loading true while background validation runs
    isInitialized: !hasToken,  // If no token exists, marked initialized immediately
  };
};

export const useAuthStore = create<AuthState>((set, get) => ({
  ...getInitialState(),
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.post('/api/auth/login', { email, password });
      if (typeof window !== 'undefined') {
        localStorage.setItem('fxzone_access_token', data.access_token);
        localStorage.setItem('fxzone_refresh_token', data.refresh_token);
        localStorage.setItem('fxzone_user', JSON.stringify(data.user));
      }
      set({
        user: data.user,
        token: data.access_token,
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    } catch (err: any) {
      set({
        error: err.detail || 'Failed to authenticate user.',
        isLoading: false,
        isInitialized: true,
      });
      throw err;
    }
  },

  loginWithGoogle: async (email?: string, name?: string, avatar_url?: string) => {
    set({ isLoading: true, error: null });
    try {
      const userEmail = email || 'google.trader@fxzone.com';
      const userName = name || userEmail.split('@')[0].replace('.', ' ').replace(/^./, str => str.toUpperCase());
      const userAvatar = avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${userEmail}`;

      const googlePayload = {
        email: userEmail,
        name: userName,
        avatar_url: userAvatar,
      };

      const data = await api.post('/api/auth/google', googlePayload);
      if (typeof window !== 'undefined') {
        localStorage.setItem('fxzone_access_token', data.access_token);
        localStorage.setItem('fxzone_refresh_token', data.refresh_token);
        localStorage.setItem('fxzone_user', JSON.stringify(data.user));
      }
      set({
        user: data.user,
        token: data.access_token,
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
        error: null,
      });
      if (typeof window !== 'undefined') {
        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      set({
        error: err?.detail || 'Google sign-in failed. Please try email login.',
        isLoading: false,
        isInitialized: true,
      });
      throw err;
    }
  },

  register: async (registerData) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.post('/api/auth/register', registerData);
      if (typeof window !== 'undefined') {
        localStorage.setItem('fxzone_access_token', data.access_token);
        localStorage.setItem('fxzone_refresh_token', data.refresh_token);
        localStorage.setItem('fxzone_user', JSON.stringify(data.user));
      }
      set({
        user: data.user,
        token: data.access_token,
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    } catch (err: any) {
      set({
        error: err.detail || 'Registration failed.',
        isLoading: false,
        isInitialized: true,
      });
      throw err;
    }
  },

  logout: () => {
    supabase.auth.signOut().catch(() => {});
    if (typeof window !== 'undefined') {
      localStorage.removeItem('fxzone_access_token');
      localStorage.removeItem('fxzone_refresh_token');
      localStorage.removeItem('fxzone_user');
    }
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: true,
      error: null,
    });
  },

  updateProfile: async (profileData) => {
    set({ isLoading: true, error: null });
    try {
      const updatedUser = await api.put('/api/auth/me', profileData);
      if (typeof window !== 'undefined') {
        localStorage.setItem('fxzone_user', JSON.stringify(updatedUser));
      }
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
    if (!token) {
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
      });
      return;
    }

    set({ isLoading: true });
    try {
      const user = await api.get('/api/auth/me');
      localStorage.setItem('fxzone_user', JSON.stringify(user));
      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
      });
    } catch (err) {
      // Token expired or invalid
      localStorage.removeItem('fxzone_access_token');
      localStorage.removeItem('fxzone_refresh_token');
      localStorage.removeItem('fxzone_user');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
      });
    }
  },
}));

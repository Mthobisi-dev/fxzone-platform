import { create } from 'zustand';
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
  deleteAccount: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  initialize: () => Promise<void>;
}

function buildUserFromSession(session: any): User {
  const sup = session?.user;
  if (!sup) throw new Error('No user in session');
  const meta = sup.user_metadata || {};
  return {
    id: sup.id,
    email: sup.email || '',
    username: meta.username || meta.name?.replace(/\s+/g, '_').toLowerCase() || sup.email?.split('@')[0] || 'user',
    display_name: meta.display_name || meta.full_name || meta.name || '',
    avatar_url: meta.avatar_url || meta.picture || `https://api.dicebear.com/8.x/initials/svg?seed=${sup.email}`,
    bio: meta.bio || '',
    role: meta.role || 'trader',
  };
}

// Synchronous initial state hydration
const getInitialState = () => {
  if (typeof window === 'undefined') {
    return { user: null, token: null, isAuthenticated: false, isLoading: false, isInitialized: false };
  }
  const cachedUserStr = localStorage.getItem('fxzone_user');
  let user: User | null = null;
  if (cachedUserStr) {
    try { user = JSON.parse(cachedUserStr); } catch { user = null; }
  }
  return {
    user,
    token: null,
    isAuthenticated: !!user,
    isLoading: !!user, // still need to verify session
    isInitialized: !user,
  };
};

export const useAuthStore = create<AuthState>((set, get) => ({
  ...getInitialState(),
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error('No session returned from Supabase');

      const user = buildUserFromSession(data.session);
      const token = data.session.access_token;

      if (typeof window !== 'undefined') {
        localStorage.setItem('fxzone_user', JSON.stringify(user));
      }
      set({ user, token, isAuthenticated: true, isLoading: false, isInitialized: true, error: null });
      if (typeof window !== 'undefined') window.location.href = '/dashboard';
    } catch (err: any) {
      const msg = err?.message || 'Invalid email or password.';
      set({ error: msg, isLoading: false, isInitialized: true });
      const e: any = new Error(msg);
      e.detail = msg;
      throw e;
    }
  },

  loginWithGoogle: async (email?: string, name?: string, avatar_url?: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/dashboard` },
      });
      if (error) throw error;
      // OAuth redirects; state will be resolved by initialize() after redirect
    } catch (err: any) {
      const msg = err?.message || 'Google sign-in failed. Please try email login.';
      set({ error: msg, isLoading: false, isInitialized: true });
      throw err;
    }
  },

  register: async (registerData) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signUp({
        email: registerData.email,
        password: registerData.password,
        options: {
          data: {
            username: registerData.username,
            display_name: registerData.display_name || registerData.username,
            role: registerData.role || 'trader',
          },
        },
      });
      if (error) throw error;

      // If email confirmation is enabled, Supabase won't return a session immediately
      if (!data.session) {
        set({ isLoading: false, isInitialized: true, error: null });
        // Show user a message that they need to confirm email
        if (typeof window !== 'undefined') {
          alert('Registration successful! Please check your email to confirm your account, then log in.');
          window.location.href = '/login';
        }
        return;
      }

      const user = buildUserFromSession(data.session);
      const token = data.session.access_token;
      if (typeof window !== 'undefined') {
        localStorage.setItem('fxzone_user', JSON.stringify(user));
      }
      set({ user, token, isAuthenticated: true, isLoading: false, isInitialized: true, error: null });
      if (typeof window !== 'undefined') window.location.href = '/dashboard';
    } catch (err: any) {
      const msg = err?.message || 'Registration failed.';
      set({ error: msg, isLoading: false, isInitialized: true });
      const e: any = new Error(msg);
      e.detail = msg;
      throw e;
    }
  },

  logout: () => {
    supabase.auth.signOut().catch(() => {});
    if (typeof window !== 'undefined') {
      localStorage.removeItem('fxzone_user');
      localStorage.removeItem('fxzone_saved_posts');
      sessionStorage.clear();
    }
    set({ user: null, token: null, isAuthenticated: false, isLoading: false, isInitialized: true, error: null });
    if (typeof window !== 'undefined') window.location.href = '/login';
  },

  deleteAccount: async () => {
    try {
      await supabase.auth.signOut().catch(() => {});
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('fxzone_user');
        localStorage.removeItem('fxzone_saved_posts');
        sessionStorage.clear();
      }
      set({ user: null, token: null, isAuthenticated: false, isLoading: false, isInitialized: true, error: null });
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
  },

  updateProfile: async (profileData) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          username: profileData.username,
          display_name: profileData.display_name,
          bio: profileData.bio,
          avatar_url: profileData.avatar_url,
        },
      });
      if (error) throw error;

      const currentUser = get().user;
      const updatedUser: User = { ...currentUser!, ...profileData };
      if (typeof window !== 'undefined') {
        localStorage.setItem('fxzone_user', JSON.stringify(updatedUser));
      }
      set({ user: updatedUser, isLoading: false });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to update profile.', isLoading: false });
      throw err;
    }
  },

  initialize: async () => {
    if (typeof window === 'undefined') return;

    set({ isLoading: true });
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        if (typeof window !== 'undefined') localStorage.removeItem('fxzone_user');
        set({ user: null, token: null, isAuthenticated: false, isLoading: false, isInitialized: true });
        return;
      }

      const user = buildUserFromSession(session);
      const token = session.access_token;
      localStorage.setItem('fxzone_user', JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false, isInitialized: true });
    } catch {
      if (typeof window !== 'undefined') localStorage.removeItem('fxzone_user');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false, isInitialized: true });
    }
  },
}));

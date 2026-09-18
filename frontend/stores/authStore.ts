/**
 * FxZone Auth Store — Supabase Auth (v2)
 *
 * Reliability guarantees:
 *  - Never logs user out due to a transient network error.
 *  - Retries getSession() up to 3 times with back-off before giving up.
 *  - Initialization is idempotent and guarded against concurrent calls.
 *  - Supabase onAuthStateChange drives the source-of-truth state update.
 *  - localStorage is used only as a fast hydration cache — never as the
 *    authoritative session source.
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

export interface FxUser {
  id: string;
  email: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  role: string;
}

interface AuthState {
  user: FxUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateProfile: (data: Partial<FxUser>) => Promise<void>;
  initialize: () => Promise<void>;
  _setFromSession: (session: Session | null) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildUserFromSession(session: Session): FxUser {
  const sup = session.user;
  const meta = sup.user_metadata || {};
  const email = sup.email || '';
  return {
    id: sup.id,
    email,
    username:
      meta.username ||
      meta.name?.replace(/\s+/g, '_').toLowerCase() ||
      email.split('@')[0] ||
      'user',
    display_name: meta.display_name || meta.full_name || meta.name || '',
    avatar_url:
      meta.avatar_url ||
      meta.picture ||
      `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(email)}`,
    bio: meta.bio || '',
    role: meta.role || 'trader',
  };
}

function cacheUser(user: FxUser | null) {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem('fxzone_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('fxzone_user');
  }
}

function getCachedUser(): FxUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('fxzone_user');
    return raw ? (JSON.parse(raw) as FxUser) : null;
  } catch {
    return null;
  }
}

/** Retry a promise-returning fn up to `attempts` times with linear back-off. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 800): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }
  throw lastErr;
}

// ─── Initial state (fast hydration from cache) ───────────────────────────────

function getInitialState() {
  const cached = getCachedUser();
  return {
    user: cached,
    token: null as string | null,
    // Optimistically authenticated if we have cached user — initialize() validates
    isAuthenticated: !!cached,
    // Show loading spinner while we verify the real session in the background
    isLoading: !!cached,
    // If no cache exists, no need to wait — we know user is not logged in
    isInitialized: !cached,
    error: null as string | null,
  };
}

// Guard against initialize() being called concurrently
let _initPromise: Promise<void> | null = null;

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set, get) => ({
  ...getInitialState(),

  // Called by Supabase onAuthStateChange — the true source of truth
  _setFromSession: (session: Session | null) => {
    if (session) {
      const user = buildUserFromSession(session);
      cacheUser(user);
      set({
        user,
        token: session.access_token,
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
        error: null,
      });
    } else {
      // Only clear user if we were previously authenticated to avoid flicker
      // on the initial SSR pass where session is not yet available.
      if (get().isInitialized) {
        cacheUser(null);
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          isInitialized: true,
          error: null,
        });
      }
    }
  },

  // ── initialize ─────────────────────────────────────────────────────────────
  initialize: async () => {
    if (typeof window === 'undefined') return;
    // Prevent concurrent initializations
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
      set({ isLoading: true });
      try {
        // Retry up to 3 times to handle transient network blips
        const { data, error } = await withRetry(
          () => supabase.auth.getSession(),
          3,
          600
        );

        if (error) {
          // Network/Supabase error — do NOT log user out, keep optimistic state
          console.warn('[Auth] getSession error (kept existing session):', error.message);
          set({ isLoading: false, isInitialized: true });
          return;
        }

        if (data.session) {
          const user = buildUserFromSession(data.session);
          cacheUser(user);
          set({
            user,
            token: data.session.access_token,
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true,
            error: null,
          });
        } else {
          // Confirmed no active session
          cacheUser(null);
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            isInitialized: true,
            error: null,
          });
        }
      } catch (err: any) {
        // Unhandled exception — do NOT kick user out; just mark initialized
        console.warn('[Auth] initialize() exception (kept existing session):', err?.message);
        set({ isLoading: false, isInitialized: true });
      } finally {
        _initPromise = null;
      }
    })();

    return _initPromise;
  },

  // ── login ──────────────────────────────────────────────────────────────────
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error('No session returned — check your Supabase auth settings.');

      const user = buildUserFromSession(data.session);
      cacheUser(user);
      set({
        user,
        token: data.session.access_token,
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
        error: null,
      });
      if (typeof window !== 'undefined') window.location.href = '/dashboard';
    } catch (err: any) {
      const msg =
        err?.message === 'Invalid login credentials'
          ? 'Incorrect email or password. Please try again.'
          : err?.message || 'Sign-in failed. Please try again.';
      set({ error: msg, isLoading: false, isInitialized: true });
      const e: any = new Error(msg);
      e.detail = msg;
      throw e;
    }
  },

  // ── Google OAuth ───────────────────────────────────────────────────────────
  loginWithGoogle: async () => {
    set({ isLoading: true, error: null });
    try {
      const redirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : '/dashboard';
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) throw error;
      // Page will navigate away via OAuth redirect; no state cleanup needed
    } catch (err: any) {
      const msg = err?.message || 'Google sign-in failed. Please try email login.';
      set({ error: msg, isLoading: false, isInitialized: true });
      throw err;
    }
  },

  // ── register ───────────────────────────────────────────────────────────────
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

      // Email confirmation required — no session yet
      if (!data.session) {
        set({ isLoading: false, isInitialized: true, error: null });
        return; // Let the calling page show the "Check your email" UI
      }

      const user = buildUserFromSession(data.session);
      cacheUser(user);
      set({
        user,
        token: data.session.access_token,
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
        error: null,
      });
      if (typeof window !== 'undefined') window.location.href = '/dashboard';
    } catch (err: any) {
      const msg = err?.message || 'Registration failed.';
      set({ error: msg, isLoading: false, isInitialized: true });
      const e: any = new Error(msg);
      e.detail = msg;
      throw e;
    }
  },

  // ── logout ─────────────────────────────────────────────────────────────────
  // ── logout ─────────────────────────────────────────────────────────────────
  logout: async () => {
    cacheUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('fxzone_user');
      localStorage.removeItem('fxzone_access_token');
      localStorage.removeItem('fxzone_refresh_token');
      localStorage.removeItem('fxzone_saved_posts');
      localStorage.removeItem('fxzone_user_watchlist_items');
      sessionStorage.clear();
    }

    // Reset all domain stores to prevent cross-user data leakage
    try {
      const { useMarketStore } = await import('@/stores/marketStore');
      useMarketStore.getState().clearWatchlists();
    } catch {}

    try {
      const { useChatStore } = await import('@/stores/chatStore');
      useChatStore.setState({ conversations: [], activeConversationId: null, messages: {}, typingUsers: {} });
    } catch {}

    try {
      const { useSocialStore } = await import('@/stores/socialStore');
      useSocialStore.setState({ posts: [], stories: [], isLoading: false, error: null });
    } catch {}

    try {
      const { useNotificationStore } = await import('@/stores/notificationStore');
      useNotificationStore.setState({ notifications: [], unreadCount: 0 });
    } catch {}

    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: true,
      error: null,
    });

    await supabase.auth.signOut().catch(() => {});
    if (typeof window !== 'undefined') window.location.href = '/login';
  },

  // ── deleteAccount ──────────────────────────────────────────────────────────
  deleteAccount: async () => {
    try {
      const { api } = await import('@/lib/api');
      await api.delete('/api/auth/me').catch(() => {});
    } catch (e) {
      console.warn('Backend account deletion API warning:', e);
    }

    cacheUser(null);
    if (typeof window !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
    }

    // Reset domain stores
    try {
      const { useMarketStore } = await import('@/stores/marketStore');
      useMarketStore.getState().clearWatchlists();
    } catch {}

    try {
      const { useChatStore } = await import('@/stores/chatStore');
      useChatStore.setState({ conversations: [], activeConversationId: null, messages: {}, typingUsers: {} });
    } catch {}

    try {
      const { useSocialStore } = await import('@/stores/socialStore');
      useSocialStore.setState({ posts: [], stories: [], isLoading: false, error: null });
    } catch {}

    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: true,
      error: null,
    });

    await supabase.auth.signOut().catch(() => {});
    if (typeof window !== 'undefined') window.location.href = '/login';
  },

  // ── updateProfile ──────────────────────────────────────────────────────────
  updateProfile: async (profileData) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          username: profileData.username,
          display_name: profileData.display_name,
          bio: profileData.bio,
          avatar_url: profileData.avatar_url,
        },
      });
      if (error) throw error;

      const currentUser = get().user;
      if (!currentUser) throw new Error('No active user');
      const updatedUser: FxUser = { ...currentUser, ...profileData };
      cacheUser(updatedUser);
      set({ user: updatedUser, isLoading: false });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to update profile.', isLoading: false });
      throw err;
    }
  },
}));

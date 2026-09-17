import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';

export interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  addNotification: (notification: NotificationItem) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  fetchNotifications: async () => {
    // Only fetch if there is an active Supabase session
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        set({ notifications: [], unreadCount: 0 });
        return;
      }
    } catch {
      return; // Can't determine session — skip silently
    }

    try {
      const data = await api.get('/api/notifications');
      if (Array.isArray(data)) {
        const unread = data.filter((n: NotificationItem) => !n.is_read).length;
        set({ notifications: data, unreadCount: unread });
      }
    } catch (err: any) {
      // Silently ignore 401/403/network errors — backend may be unavailable
      const status = err?.status ?? 0;
      if (status !== 401 && status !== 403 && status !== 0) {
        console.warn('[Notifications] fetch failed:', err?.message || err?.detail || err);
      }
    }
  },

  markAsRead: async (notificationId) => {
    try {
      await api.put(`/api/notifications/${notificationId}/read`);
      set((state) => {
        const list = state.notifications.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        );
        const unread = list.filter((n) => !n.is_read).length;
        return { notifications: list, unreadCount: unread };
      });
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  },

  markAllRead: async () => {
    try {
      await api.put('/api/notifications/read-all');
      set((state) => {
        const list = state.notifications.map((n) => ({ ...n, is_read: true }));
        return { notifications: list, unreadCount: 0 };
      });
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  },

  addNotification: (notification) => {
    set((state) => {
      // Avoid duplicate checks
      if (state.notifications.some((n) => n.id === notification.id)) {
        return {};
      }
      const list = [notification, ...state.notifications];
      const unread = list.filter((n) => !n.is_read).length;
      return { notifications: list, unreadCount: unread };
    });
  },
}));

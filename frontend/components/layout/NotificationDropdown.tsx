'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useNotificationStore, NotificationItem } from '@/stores/notificationStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Bell, Check, Trash, AlertCircle, Info, TrendingUp, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { timeAgo } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllRead, addNotification, fetchNotifications } = useNotificationStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Subscribe to real-time notification WS stream
  useWebSocket('/ws/notifications', {
    notification: (data: any) => {
      if (data && data.notification) {
        addNotification(data.notification);
      }
    },
  });

  useEffect(() => {
    fetchNotifications();
    const intervalId = setInterval(() => {
      fetchNotifications();
    }, 30000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'market':
        return <TrendingUp size={14} className="text-emerald-400" />;
      case 'social':
        return <MessageSquare size={14} className="text-purple-400" />;
      case 'system':
        return <AlertCircle size={14} className="text-amber-400" />;
      default:
        return <Info size={14} className="text-blue-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors focus:outline-none"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 5 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 rounded-xl border border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-96"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60 bg-zinc-900/40">
              <span className="text-xs font-semibold text-white">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead()}
                  className="flex items-center gap-1 text-[10px] font-medium text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Check size={10} /> Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-900">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Bell size={24} className="text-zinc-600 mb-2" />
                  <p className="text-xs text-zinc-400">All caught up!</p>
                  <span className="text-[10px] text-zinc-500 mt-0.5">No new alerts.</span>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.is_read && markAsRead(n.id)}
                    className={cn(
                      'p-4 flex gap-3 transition-colors cursor-pointer select-none',
                      n.is_read ? 'bg-transparent hover:bg-white/[0.01]' : 'bg-blue-600/[0.03] hover:bg-blue-600/[0.05]'
                    )}
                  >
                    <div className="h-6 w-6 rounded-lg bg-zinc-900/80 border border-zinc-850 flex items-center justify-center shrink-0">
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <p className={cn('text-xs font-semibold truncate', n.is_read ? 'text-zinc-300' : 'text-white')}>
                          {n.title}
                        </p>
                        <span className="text-[9px] text-zinc-500 shrink-0 mt-0.5">{timeAgo(new Date(n.created_at))}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">{n.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Globe,
  Video,
  MessageSquare,
  LogOut,
  Compass,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/stores/chatStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { getUnreadBadgeLabel } from '@/lib/postAssetTags';
import { getChatUnreadBadgeCount } from '@/lib/chatUnread';

export function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const conversations = useChatStore((state) => state.conversations);
  const notifications = useNotificationStore((state) => state.notifications);
  const totalChatUnreadCount = getChatUnreadBadgeCount(conversations, notifications);

  const menuItems = [
    {
      label: 'Dashboard',
      icon: <LayoutDashboard size={18} />,
      path: '/dashboard',
    },
    {
      label: 'Discover',
      icon: <Compass size={18} />,
      path: '/discover',
    },
    {
      label: 'Social Feed',
      icon: <Globe size={18} />,
      path: '/feed',
    },
    {
      label: 'Live Sessions',
      icon: <Video size={18} />,
      path: '/sessions',
    },
    {
      label: 'Messages',
      icon: <MessageSquare size={18} />,
      path: '/chat',
    },
  ];

  return (
    <>
      {/* Desktop / Tablet Sidebar */}
      <aside
        className="relative hidden w-56 shrink-0 select-none flex-col justify-between border-r border-zinc-850 bg-zinc-950/60 backdrop-blur-md md:flex"
        aria-label="Primary navigation"
      >
        {/* Sidebar Items */}
        <div className="flex flex-col gap-6 px-3 py-6">
          {/* Navigation Group */}
          <div className="flex flex-col gap-1.5">
            {menuItems.map((item) => {
              const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  aria-label={item.label}
                  title={item.label}
                  className={cn(
                    'group relative flex min-h-11 w-full items-center justify-start gap-3 rounded-lg border px-3 text-xs font-semibold transition-all duration-200 focus:outline-none',
                    isActive
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-500/25 shadow-[0_0_10px_rgba(59,130,246,0.08)]'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
                  )}
                >
                  <span className={cn('relative text-current transition-colors', isActive ? 'text-blue-400' : 'text-zinc-400 group-hover:text-white')}>
                    {item.icon}
                    {item.path === '/chat' && getUnreadBadgeLabel(totalChatUnreadCount) && (
                      <span aria-label={`${getUnreadBadgeLabel(totalChatUnreadCount)} unread messages`} className="absolute -right-2 -top-2 min-w-4 rounded-full border border-[var(--fx-bg-canvas)] bg-[var(--fx-accent)] px-1 text-center text-[9px] font-bold leading-4 text-[var(--fx-bg-canvas)]">
                        {getUnreadBadgeLabel(totalChatUnreadCount)}
                      </span>
                    )}
                  </span>
                  <span className="truncate text-sm">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col gap-4 p-3 border-t border-zinc-850/60 bg-zinc-950/30">
          {/* Action Buttons */}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => logout()}
              aria-label="Sign out"
              title="Sign out"
              className="group relative flex min-h-10 w-full items-center justify-start gap-3 rounded-lg px-3 text-xs font-semibold text-zinc-400 transition-all hover:bg-red-500/5 hover:text-red-400"
            >
              <LogOut size={18} />
              <span className="text-sm">Sign out</span>
            </button>
          </div>
        </div>

      </aside>

      {/* Mobile Bottom Navigation Bar (< 768px) */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 z-40 h-[var(--mobile-nav-height)] bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-850/90 px-1.5 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))] justify-around items-center shadow-2xl">
        {menuItems.map((item) => {
          const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
          return (
            <Link
              key={item.path}
              href={item.path}
              aria-label={item.label}
              title={item.label}
              className={cn(
                'flex h-full min-h-11 min-w-0 flex-1 items-center justify-center rounded-lg font-semibold transition-all',
                isActive
                  ? 'text-blue-400 font-bold'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <span className={cn('relative p-2 rounded-lg transition-colors [&>svg]:h-6 [&>svg]:w-6', isActive && 'bg-blue-600/15 text-blue-400')}>
                {item.icon}
                {item.path === '/chat' && getUnreadBadgeLabel(totalChatUnreadCount) && (
                  <span aria-label={`${getUnreadBadgeLabel(totalChatUnreadCount)} unread messages`} className="absolute right-0 top-0 min-w-4 rounded-full border border-[var(--fx-bg-canvas)] bg-[var(--fx-accent)] px-1 text-center text-[9px] font-bold leading-4 text-[var(--fx-bg-canvas)]">
                    {getUnreadBadgeLabel(totalChatUnreadCount)}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

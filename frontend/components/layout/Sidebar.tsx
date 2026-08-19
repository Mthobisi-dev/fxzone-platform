'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  BarChart3,
  Globe,
  Video,
  MessageSquare,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sliders,
  Compass,
  Instagram,
  Linkedin,
  Github,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '../ui/Avatar';

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    {
      label: 'Dashboard',
      icon: <LayoutDashboard size={18} />,
      path: '/dashboard',
    },
    {
      label: 'Markets',
      icon: <BarChart3 size={18} />,
      path: '/market',
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
        className={cn(
          'hidden md:flex border-r border-zinc-850 bg-zinc-950/60 backdrop-blur-md flex-col justify-between shrink-0 select-none transition-all duration-300 relative',
          isCollapsed ? 'w-16' : 'w-56'
        )}
      >
        {/* Sidebar Items */}
        <div className="flex flex-col gap-6 py-6 px-3">
          {/* Navigation Group */}
          <div className="flex flex-col gap-1.5">
            {menuItems.map((item) => {
              const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
              return (
                <button
                  key={item.path}
                  onClick={() => (window.location.href = item.path)}
                  className={cn(
                    'flex items-center gap-3 w-full py-2.5 px-3 rounded-lg text-xs font-semibold transition-all duration-200 focus:outline-none group relative',
                    isActive
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-500/25 shadow-[0_0_10px_rgba(59,130,246,0.08)]'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
                  )}
                >
                  <span className={cn('text-current transition-colors', isActive ? 'text-blue-400' : 'text-zinc-400 group-hover:text-white')}>
                    {item.icon}
                  </span>
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                  
                  {/* Tooltip on Collapsed */}
                  {isCollapsed && (
                    <div className="absolute left-16 bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-white px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-50">
                      {item.label}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col gap-4 p-3 border-t border-zinc-850/60 bg-zinc-950/30">
          {/* User Card */}
          {user && !isCollapsed && (
            <div className="flex items-center gap-2.5 py-1 px-1 rounded-lg">
              <Avatar name={user.display_name || user.username} src={user.avatar_url} size="sm" />
              <div className="flex flex-col text-left min-w-0">
                <span className="text-xs font-semibold text-zinc-300 truncate">
                  {user.display_name || user.username}
                </span>
                <span className="text-[9px] text-zinc-500 truncate uppercase tracking-wider">{user.role}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-1">
            {user && (
              <button
                onClick={() => (window.location.href = `/profile/${user.id}`)}
                className={cn(
                  'flex items-center gap-3 w-full py-2 px-3 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-all group relative',
                  pathname === `/profile/${user.id}` && 'bg-blue-600/10 text-blue-400 border border-blue-500/25'
                )}
              >
                <UserIcon size={18} />
                {!isCollapsed && <span>Profile</span>}
                {isCollapsed && (
                  <div className="absolute left-16 bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-white px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-50">
                    Profile
                  </div>
                )}
              </button>
            )}

            {/* Contact Links */}
            {!isCollapsed && (
              <div className="flex items-center justify-center gap-3 py-2">
                <a
                  href="https://www.instagram.com/it.is_jack?igsh=MXV1dW1uM3o5NjI1Zg=="
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Instagram"
                  className="text-zinc-500 hover:text-pink-400 transition-colors"
                >
                  <Instagram size={14} />
                </a>
                <a
                  href="https://www.linkedin.com/in/mthobisi-mzimela-136835354?utm_source=share_via&utm_content=profile&utm_medium=member_android"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="LinkedIn"
                  className="text-zinc-500 hover:text-blue-400 transition-colors"
                >
                  <Linkedin size={14} />
                </a>
                <a
                  href="https://github.com/Mthobisi-dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="GitHub"
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <Github size={14} />
                </a>
              </div>
            )}

            <button
              onClick={() => logout()}
              className="flex items-center gap-3 w-full py-2 px-3 rounded-lg text-xs font-semibold text-zinc-400 hover:text-red-400 hover:bg-red-500/5 transition-all group relative"
            >
              <LogOut size={18} />
              {!isCollapsed && <span>Sign Out</span>}
              {isCollapsed && (
                <div className="absolute left-16 bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-white px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-50">
                  Sign Out
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Collapse/Expand toggle button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute top-1/2 -right-3 h-6 w-6 rounded-full border border-zinc-800 bg-zinc-950 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all z-50 shadow-md cursor-pointer"
        >
          {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* Mobile Bottom Navigation Bar (< 768px) */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-850/90 px-1.5 py-1 justify-around items-center shadow-2xl safe-area-bottom">
        {menuItems.map((item) => {
          const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
          return (
            <button
              key={item.path}
              onClick={() => (window.location.href = item.path)}
              className={cn(
                'flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[9px] font-semibold transition-all',
                isActive
                  ? 'text-blue-400 font-bold'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <span className={cn('p-1 rounded-md transition-colors', isActive && 'bg-blue-600/15 text-blue-400')}>
                {item.icon}
              </span>
              <span className="truncate max-w-[55px] text-[8px] mt-0.5">{item.label}</span>
            </button>
          );
        })}
        {user && (
          <button
            onClick={() => (window.location.href = `/profile/${user.id}`)}
            className={cn(
              'flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[9px] font-semibold transition-all',
              pathname.startsWith('/profile')
                ? 'text-blue-400 font-bold'
                : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            <span className={cn('p-1 rounded-md transition-colors', pathname.startsWith('/profile') && 'bg-blue-600/15 text-blue-400')}>
              <UserIcon size={18} />
            </span>
            <span className="truncate max-w-[55px] text-[8px] mt-0.5">Profile</span>
          </button>
        )}
      </nav>
    </>
  );
}

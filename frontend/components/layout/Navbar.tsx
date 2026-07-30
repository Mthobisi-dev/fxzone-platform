'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { NotificationDropdown } from './NotificationDropdown';
import { Avatar } from '../ui/Avatar';
import { Dropdown } from '../ui/Dropdown';
import { ThemeSwitcher } from './ThemeSwitcher';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  Search,
  MessageSquareCode,
  LogOut,
  User as UserIcon,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../ui/Modal';

interface NavbarProps {
  onToggleAI?: () => void;
  isAIOpen?: boolean;
}

export function Navbar({ onToggleAI, isAIOpen = false }: NavbarProps) {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const [isThemeOpen, setIsThemeOpen] = useState(false);

  const userMenuItems = [
    {
      label: 'My Profile',
      icon: <UserIcon size={14} />,
      onClick: () => {
        if (user) {
          window.location.href = `/profile/${user.id}`;
        }
      },
    },
    {
      label: 'UI Customization',
      icon: <Sliders size={14} />,
      onClick: () => setIsThemeOpen(true),
    },
    {
      label: 'Sign Out',
      icon: <LogOut size={14} />,
      danger: true,
      onClick: () => logout(),
    },
  ];

  return (
    <>
      <nav className="h-14 border-b border-zinc-850 bg-zinc-950/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0 select-none z-40 relative">
        {/* Left Side: Brand Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => (window.location.href = '/')}>
          <div className="h-8 w-8 rounded-lg bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.45)] flex items-center justify-center">
            <TrendingUp size={18} className="text-white" />
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-wider bg-gradient-to-r from-white via-zinc-200 to-blue-500 bg-clip-text text-transparent">
              FXZONE
            </span>
            <span className="text-[8px] block font-bold text-zinc-500 tracking-widest mt-[-2px] uppercase">
              Trading Intelligence
            </span>
          </div>
        </div>

        {/* Center: Search Box */}
        <div className="hidden md:flex items-center w-80 relative">
          <Search size={14} className="text-zinc-500 absolute left-3.5" />
          <input
            type="text"
            placeholder="Search assets, traders, articles..."
            className="w-full bg-zinc-900/60 border border-zinc-850 hover:border-zinc-800 text-xs rounded-lg pl-10 pr-4 py-1.5 text-zinc-350 focus:outline-none focus:border-zinc-700/60 focus:ring-1 focus:ring-blue-500/10 placeholder-zinc-500 transition-all"
          />
        </div>

        {/* Right Side: Navigation Actions */}
        <div className="flex items-center gap-3">
          {/* AI Toggle Button */}
          {onToggleAI && (
            <button
              onClick={onToggleAI}
              className={cn(
                'relative p-2 rounded-lg hover:bg-white/5 transition-all focus:outline-none flex items-center gap-1.5 border text-xs font-semibold',
                isAIOpen
                  ? 'bg-blue-600/15 border-blue-500/30 text-blue-400'
                  : 'border-zinc-850 text-zinc-400 hover:text-white'
              )}
            >
              <MessageSquareCode size={16} />
              <span className="hidden sm:inline">AI Analyst</span>
              {isAIOpen && (
                <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
                </span>
              )}
            </button>
          )}

          <div className="h-5 w-[1px] bg-zinc-850" />

          {/* Real-time Notifications */}
          <NotificationDropdown />

          {/* User Profile avatar dropdown */}
          {user && (
            <Dropdown
              trigger={
                <div className="flex items-center gap-2.5 pl-1.5">
                  <Avatar name={user.display_name || user.username} src={user.avatar_url} size="sm" isOnline />
                  <div className="hidden lg:flex flex-col text-left">
                    <span className="text-xs font-semibold text-zinc-200">{user.display_name || user.username}</span>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">{user.role}</span>
                  </div>
                </div>
              }
              items={userMenuItems}
              align="right"
            />
          )}
        </div>
      </nav>

      {/* UI Settings Modal */}
      <Modal isOpen={isThemeOpen} onClose={() => setIsThemeOpen(false)} title="Dashboard Settings">
        <div className="py-2 flex justify-center">
          <ThemeSwitcher />
        </div>
      </Modal>
    </>
  );
}

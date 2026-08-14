'use client';

import React, { useState } from 'react';
import { Avatar } from '../ui/Avatar';
import { Search, Plus, MessageSquare, Users, UserPlus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Conversation {
  id: string;
  name?: string | null;
  isGroup: boolean;
  unreadCount: number;
  lastMessage?: {
    content: string;
    createdAt: string;
  } | null;
  members: {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    isOnline?: boolean;
  }[];
}

export interface SuggestedUser {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  role?: string;
  isFollowing?: boolean;
  isFollower?: boolean;
}

interface ChatSidebarProps {
  conversations: Conversation[];
  suggestedUsers?: SuggestedUser[];
  loadingSuggested?: boolean;
  activeId?: string | null;
  onSelectConversation: (id: string) => void;
  onStartChatWithUser?: (user: SuggestedUser) => void;
  startingChatUserId?: string | null;
  onNewChat: () => void;
  currentUserId: string;
}

export function ChatSidebar({
  conversations,
  suggestedUsers = [],
  loadingSuggested = false,
  activeId,
  onSelectConversation,
  onStartChatWithUser,
  startingChatUserId,
  onNewChat,
  currentUserId,
}: ChatSidebarProps) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'chats' | 'people'>('chats');

  const getConversationDetails = (conv: Conversation) => {
    if (!conv.isGroup) {
      const peer = conv.members.find((m) => String(m.userId || (m as any).id) !== String(currentUserId));
      return {
        name: peer?.displayName || peer?.username || 'Direct Message',
        avatarUrl: peer?.avatarUrl,
        isOnline: !!peer?.isOnline,
        icon: <MessageSquare size={12} className="text-zinc-500" />,
      };
    }
    return {
      name: conv.name || 'Group Chat',
      avatarUrl: undefined,
      isOnline: false,
      icon: <Users size={12} className="text-blue-400" />,
    };
  };

  // Filter conversations by search and hide bot
  const filteredConversations = conversations.filter((conv) => {
    const details = getConversationDetails(conv);
    const matchesSearch = details.name.toLowerCase().includes(search.toLowerCase());
    const isBot = details.name.toLowerCase().includes('fxzone_bot') || details.name.toLowerCase().includes('fxzone bot');
    return matchesSearch && !isBot;
  });

  const filteredPeople = suggestedUsers.filter((u) => {
    if (String(u.id) === String(currentUserId)) return false;
    if (u.username === 'fxzone_bot') return false;
    const term = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(term) ||
      (u.displayName && u.displayName.toLowerCase().includes(term))
    );
  });

  return (
    <div className="w-80 border-r border-zinc-850 h-full flex flex-col bg-zinc-950/20 shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-zinc-850 flex items-center justify-between select-none">
        <h3 className="text-sm font-bold text-white tracking-wide">Messages</h3>
        <button
          onClick={onNewChat}
          className="p-1.5 bg-blue-600/10 border border-blue-500/30 text-blue-400 hover:bg-blue-600/20 rounded-lg transition-colors focus:outline-none"
          title="New group chat"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Tabs: Chats / People */}
      <div className="flex border-b border-zinc-850 select-none">
        <button
          onClick={() => setActiveTab('chats')}
          className={cn(
            'flex-1 py-2 text-[11px] font-bold tracking-wide transition-colors flex items-center justify-center gap-1.5',
            activeTab === 'chats'
              ? 'text-blue-400 border-b-2 border-blue-500'
              : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          <MessageSquare size={12} />
          Chats
          {conversations.some((c) => c.unreadCount > 0) && (
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('people')}
          className={cn(
            'flex-1 py-2 text-[11px] font-bold tracking-wide transition-colors flex items-center justify-center gap-1.5',
            activeTab === 'people'
              ? 'text-blue-400 border-b-2 border-blue-500'
              : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          <Users size={12} />
          People
          {filteredPeople.length > 0 && (
            <span className="text-[8px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-semibold">
              {filteredPeople.length}
            </span>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === 'chats' ? 'Search conversations...' : 'Search people...'}
            className="w-full h-7 pl-8 pr-3 bg-zinc-900/60 text-[11px] border border-zinc-850 rounded-lg text-white placeholder-zinc-550 focus:outline-none focus:border-zinc-750"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'chats' ? (
          /* ─── Conversations List ─── */
          <div className="divide-y divide-zinc-850/40">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center select-none">
                <div className="h-10 w-10 mx-auto rounded-xl bg-zinc-900 border border-zinc-850 flex items-center justify-center text-zinc-550 mb-2">
                  <MessageSquare size={16} />
                </div>
                <p className="text-[10px] text-zinc-550">No conversations yet.</p>
                <button
                  onClick={() => setActiveTab('people')}
                  className="text-[10px] text-blue-400 hover:text-blue-300 mt-1.5 font-semibold"
                >
                  Browse People →
                </button>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const details = getConversationDetails(conv);
                const isActive = activeId === conv.id;
                
                return (
                  <div
                    key={conv.id}
                    onClick={() => onSelectConversation(conv.id)}
                    className={cn(
                      'flex items-center gap-3 p-3 cursor-pointer transition-colors',
                      isActive ? 'bg-zinc-900/70' : 'hover:bg-zinc-900/30'
                    )}
                  >
                    <div className="relative shrink-0 select-none">
                      <Avatar
                        src={details.avatarUrl}
                        alt={details.name}
                        size="sm"
                        className="h-9 w-9"
                      />
                      {details.isOnline && (
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-emerald-500 border-2 border-zinc-950 rounded-full" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center gap-2 select-none">
                        <span className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                          {details.name}
                          {details.icon}
                        </span>
                        {conv.lastMessage && (
                          <span className="text-[8px] text-zinc-500 shrink-0">
                            {new Date(conv.lastMessage.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {conv.lastMessage ? conv.lastMessage.content : 'No messages yet'}
                      </p>
                    </div>

                    {conv.unreadCount > 0 && (
                      <span className="h-4 min-w-4 px-1 rounded-full bg-blue-600 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* ─── People List ─── */
          <div className="p-1">
            {loadingSuggested ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-500" size={18} />
              </div>
            ) : filteredPeople.length === 0 ? (
              <div className="p-8 text-center select-none">
                <div className="h-10 w-10 mx-auto rounded-xl bg-zinc-900 border border-zinc-850 flex items-center justify-center text-zinc-550 mb-2">
                  <Users size={16} />
                </div>
                <p className="text-[10px] text-zinc-550">
                  {search
                    ? 'No people matching your search.'
                    : 'Follow other traders on Discover to see them here.'}
                </p>
              </div>
            ) : (
              filteredPeople.map((u) => (
                <div
                  key={u.id}
                  onClick={() => onStartChatWithUser?.(u)}
                  className={cn(
                    'flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all group',
                    startingChatUserId === u.id
                      ? 'bg-blue-600/10 border border-blue-500/20'
                      : 'hover:bg-zinc-900/60 border border-transparent hover:border-zinc-850'
                  )}
                >
                  <Avatar
                    src={u.avatarUrl || (u as any).avatar_url}
                    alt={u.displayName || (u as any).display_name || u.username}
                    size="sm"
                    className="h-9 w-9 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-bold text-white block truncate leading-tight">
                      {u.displayName || (u as any).display_name || u.username}
                    </span>
                    <span className="text-[9px] text-zinc-550 block truncate">
                      @{u.username}
                      {u.role && (
                        <span className="ml-1 text-zinc-600">• {u.role}</span>
                      )}
                    </span>
                  </div>
                  
                  {startingChatUserId === u.id ? (
                    <Loader2 size={13} className="animate-spin text-blue-400 shrink-0" />
                  ) : (
                    <span className="text-[8px] bg-blue-600/10 text-blue-400 group-hover:bg-blue-600 group-hover:text-white border border-blue-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider transition-all select-none shrink-0">
                      Message
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

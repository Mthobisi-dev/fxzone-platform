'use client';

import React, { useRef, useEffect } from 'react';
import { Avatar } from '../ui/Avatar';
import { MessageInput } from './MessageInput';
import { MessageSquare, Shield, Check, CheckCheck, Video, Trash2, Users, Info, Settings, Bell, Lock, Award, ArrowLeft, UserPlus, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender?: {
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
}

interface ChatWindowProps {
  messages: ChatMessage[];
  currentUserId: string;
  conversationName: string;
  conversationAvatar?: string;
  isGroup: boolean;
  members?: any[];
  conversationData?: any;
  onSendMessage: (text: string) => Promise<void>;
  onDeleteMessage?: (messageId: string) => void;
  onStartLiveCall?: () => void;
  onTyping?: () => void;
  typingUsers?: string[];
}

export function ChatWindow({
  messages,
  currentUserId,
  conversationName,
  conversationAvatar,
  isGroup,
  members = [],
  conversationData = {},
  onSendMessage,
  onDeleteMessage,
  onStartLiveCall,
  onTyping,
  typingUsers = [],
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showGroupProfile, setShowGroupProfile] = React.useState(false);
  const [notificationsMuted, setNotificationsMuted] = React.useState(false);

  const [groupTitle, setGroupTitle] = React.useState(conversationName || 'FxZone Group');
  const [groupDescription, setGroupDescription] = React.useState('FxZone Trading & Signal Analysis Group');
  const [settingsModalOpen, setSettingsModalOpen] = React.useState(false);
  const [addMembersModalOpen, setAddMembersModalOpen] = React.useState(false);
  const [availableUsers, setAvailableUsers] = React.useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = React.useState(false);
  const [addedMembers, setAddedMembers] = React.useState<string[]>([]);
  const [leftGroup, setLeftGroup] = React.useState(false);

  const fetchUsersForGroup = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get('/api/social/users?limit=30');
      if (Array.isArray(res)) {
        setAvailableUsers(res.filter((u: any) => u.id !== currentUserId && u.username !== 'fxzone_bot'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleOpenAddMembers = () => {
    fetchUsersForGroup();
    setAddMembersModalOpen(true);
  };

  const handleToggleAddMember = (username: string) => {
    setAddedMembers((prev) =>
      prev.includes(username) ? prev.filter((m) => m !== username) : [...prev, username]
    );
  };

  const handleLeaveGroup = () => {
    if (!confirm('Are you sure you want to leave this group?')) return;
    setLeftGroup(true);
    setShowGroupProfile(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  return (
    <div className="flex-1 h-full flex flex-col justify-between bg-zinc-950/40 relative overflow-hidden">
      {/* Header */}
      <div className="h-14 px-4 border-b border-zinc-850 flex items-center justify-between bg-zinc-900/20 select-none">
        <div className="flex items-center gap-3">
          <Avatar src={conversationAvatar} alt={conversationName} size="sm" />
          <div>
            <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
              {conversationName}
              {isGroup && (
                <button
                  onClick={() => setShowGroupProfile(true)}
                  className="text-[8px] bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 px-1.5 py-0.5 rounded font-bold uppercase transition-colors flex items-center gap-1"
                >
                  <Info size={9} /> Explore Group Profile
                </button>
              )}
            </h4>
            <span className="text-[9px] text-emerald-500 flex items-center gap-1 mt-0.5 font-semibold">
              <Shield size={9} /> End-to-end encrypted
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isGroup && (
            <button
              onClick={() => setShowGroupProfile(true)}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-850 transition-colors"
              title="Group Settings & Members"
            >
              <Users size={16} />
            </button>
          )}

          {onStartLiveCall && (
            <button
              onClick={onStartLiveCall}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/15 border border-purple-500/30 text-purple-300 hover:bg-purple-600 hover:text-white transition-all text-xs font-semibold"
              title="Start 1-on-1 Live Session"
            >
              <Video size={14} className="text-purple-400" />
              <span className="text-[10px]">Start 1-on-1 Session</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 p-6 select-none">
            <div className="h-10 w-10 bg-zinc-900 border border-zinc-850 rounded-xl flex items-center justify-center text-zinc-500">
              <MessageSquare size={16} />
            </div>
            <h5 className="text-xs font-semibold text-zinc-300">Secure Direct Message</h5>
            <p className="text-[10px] text-zinc-500 max-w-[200px]">Send a greeting to begin chatting securely on FxZone.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const senderIdVal = msg.senderId || (msg as any).sender_id;
            const isSelf = String(senderIdVal) === String(currentUserId);
            
            return (
              <div
                key={msg.id}
                className={cn('flex gap-2 max-w-[70%]', isSelf ? 'self-end flex-row-reverse' : 'self-start')}
              >
                {!isSelf && (
                  <Avatar
                    src={msg.sender?.avatarUrl}
                    alt={msg.sender?.username}
                    size="sm"
                    className="h-7 w-7 mt-0.5"
                  />
                )}
                
                <div className="flex flex-col">
                  {!isSelf && isGroup && (
                    <span className="text-[8px] text-zinc-550 font-bold mb-0.5 ml-1">
                      {msg.sender?.displayName || msg.sender?.username}
                    </span>
                  )}
                  
                  <div
                    className={cn(
                      'p-2.5 rounded-xl border text-xs leading-relaxed break-words',
                      isSelf
                        ? 'bg-blue-600/10 border-blue-500/20 text-zinc-200 rounded-tr-none'
                        : 'bg-zinc-900/50 border-zinc-850 text-zinc-300 rounded-tl-none'
                    )}
                  >
                    {msg.content.startsWith('[Voice Note] (url:') ? (() => {
                      const match = msg.content.match(/\(url:\s*([^\)]+)\)/);
                      const url = match ? match[1] : '';
                      return (
                        <div className="space-y-1 py-1">
                          <span className="text-[9px] uppercase tracking-wider text-purple-400 font-bold block mb-1">Voice Memo</span>
                          <audio src={url} controls className="max-w-xs h-8 text-zinc-950" />
                        </div>
                      );
                    })() : msg.content.startsWith('[Live Session]') ? (() => {
                      const idMatch = msg.content.match(/\(id:\s*([^\)]+)\)/);
                      const titleMatch = msg.content.match(/\(title:\s*([^\)]+)\)/);
                      const sId = idMatch ? idMatch[1] : '';
                      const sTitle = titleMatch ? titleMatch[1] : 'Private Trading Room';
                      return (
                        <div className="space-y-2 p-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl max-w-xs select-none">
                          <span className="text-[8px] bg-purple-600/20 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Live session invitation</span>
                          <h5 className="text-[11px] font-bold text-white mt-1 leading-snug">{sTitle}</h5>
                          <button
                            onClick={() => window.location.href = `/session/${sId}`}
                            className="w-full h-7 mt-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                          >
                            Join Session
                          </button>
                        </div>
                      );
                    })() : (msg.content.match(/\.(png|jpg|jpeg|gif|webp)(?:\?.*)?$/i) || msg.content.startsWith('/uploads/')) && !msg.content.includes(' ') ? (
                      <div className="relative rounded-lg overflow-hidden border border-zinc-850 bg-zinc-950 max-w-xs mt-1">
                        <img
                          src={msg.content}
                          alt="Shared attachment"
                          className="w-full h-auto object-cover max-h-48 hover:scale-[1.02] transition-transform cursor-pointer"
                          onClick={() => window.open(msg.content, '_blank')}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                    
                    <div className="flex justify-between items-center gap-2 mt-1 text-[8px] text-zinc-500 select-none">
                      <div className="flex items-center gap-1">
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {isSelf && (
                          <CheckCheck size={10} className="text-blue-500" />
                        )}
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm('Delete this message?')) {
                            try {
                              await api.delete(`/api/chat/messages/${msg.id}`);
                              onDeleteMessage?.(msg.id);
                            } catch (err) {
                              console.error('Failed to delete message:', err);
                            }
                          }
                        }}
                        title="Delete message"
                        className="p-0.5 text-zinc-500 hover:text-rose-400 rounded transition-colors opacity-80 hover:opacity-100"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator listing */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-[10px] text-zinc-500 italic pl-10 select-none">
            <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce delay-75" />
            <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce delay-150" />
            <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce delay-225" />
            <span>{typingUsers.join(', ')} typing...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput onSendMessage={onSendMessage} onTyping={onTyping} />

      {/* Room Info Panel / Group Profile */}
      {showGroupProfile && (
        <div className="absolute right-0 top-0 h-full w-80 bg-zinc-900 border-l border-zinc-800/50 z-40 flex flex-col overflow-hidden">
          {/* Profile Header */}
          <div className="p-4 border-b border-zinc-800/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">
                {isGroup ? 'Group Profile' : 'Chat Info'}
              </h3>
              <button onClick={() => setShowGroupProfile(false)} className="text-zinc-400 hover:text-white transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </button>
            </div>

            <div className="text-center">
              <div className={`h-16 w-16 mx-auto rounded-full flex items-center justify-center text-xl font-semibold ${
                isGroup
                  ? 'bg-gradient-to-tr from-purple-600 to-blue-600 text-white'
                  : 'bg-zinc-700 text-zinc-300'
              }`}>
                {isGroup ? <Users className="h-7 w-7" /> : conversationName.charAt(0).toUpperCase()}
              </div>
              <p className="text-white font-medium mt-3">{groupTitle}</p>
              <p className="text-xs text-zinc-400 mt-1">{groupDescription}</p>
            </div>
          </div>

          {/* Group Actions & Member List */}
          {isGroup && (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto divide-y divide-zinc-800/40 select-none">
              <div className="p-3 space-y-2">
                <button
                  onClick={() => setSettingsModalOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800/50 rounded-lg transition-colors font-medium"
                >
                  <Settings className="h-3.5 w-3.5 text-purple-400" />
                  Group Settings
                </button>
                <button
                  onClick={handleOpenAddMembers}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800/50 rounded-lg transition-colors font-medium"
                >
                  <UserPlus className="h-3.5 w-3.5 text-blue-400" />
                  Add Members {addedMembers.length > 0 && `(${addedMembers.length} added)`}
                </button>
                <button
                  onClick={handleLeaveGroup}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors font-medium"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Leave Group
                </button>
              </div>

              {/* Real Group Members List */}
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Group Accounts ({members.length})</p>
                  <span className="text-[9px] text-purple-400 font-medium">Real Roster</span>
                </div>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {members.map((m: any, idx: number) => {
                    const mUser = m.user || m;
                    const uId = m.user_id || mUser.id;
                    const creatorId = conversationData?.creator_id || conversationData?.creatorId || members[0]?.user_id || members[0]?.user?.id;
                    const isGroupCreator = String(uId) === String(creatorId) || idx === 0;
                    return (
                      <div key={m.id || idx} className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-850/80 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar src={mUser.avatar_url || mUser.avatarUrl} name={mUser.display_name || mUser.displayName || mUser.username} size="sm" />
                          <div className="min-w-0">
                            <span className="text-[11px] font-semibold text-white block truncate leading-tight">
                              {mUser.display_name || mUser.displayName || mUser.username}
                            </span>
                            <span className="text-[9px] text-zinc-500 block truncate">@{mUser.username}</span>
                          </div>
                        </div>
                        {isGroupCreator && (
                          <span className="text-[8px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded shrink-0">
                            Group Admin
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Group Settings Modal */}
      {settingsModalOpen && (
        <Modal
          isOpen={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          title="Group Profile Settings"
        >
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Group Name</label>
              <input
                type="text"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                className="w-full h-9 bg-zinc-950 border border-zinc-850 rounded-lg px-3 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Group Description</label>
              <textarea
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                className="w-full h-20 bg-zinc-950 border border-zinc-850 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" onClick={() => setSettingsModalOpen(false)} className="bg-purple-600 hover:bg-purple-500">
                Save Group Profile
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Members Modal */}
      {addMembersModalOpen && (
        <Modal
          isOpen={addMembersModalOpen}
          onClose={() => setAddMembersModalOpen(false)}
          title="Add Members to Group"
        >
          <div className="space-y-4">
            <p className="text-xs text-zinc-400">Select traders to add to {groupTitle}:</p>
            {loadingUsers ? (
              <div className="py-8 text-center text-xs text-zinc-500">Loading traders...</div>
            ) : availableUsers.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">No active traders found to add.</div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {availableUsers.map((u: any) => {
                  const isAdded = addedMembers.includes(u.username);
                  return (
                    <div
                      key={u.id}
                      onClick={() => handleToggleAddMember(u.username)}
                      className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                        isAdded
                          ? 'bg-purple-500/10 border-purple-500/30'
                          : 'bg-zinc-900/40 border-zinc-800 hover:bg-zinc-850'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar src={u.avatar_url} name={u.display_name || u.username} size="sm" />
                        <div>
                          <span className="text-xs font-bold text-white block leading-none">
                            {u.display_name || u.username}
                          </span>
                          <span className="text-[10px] text-zinc-500">@{u.username}</span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        isAdded ? 'bg-purple-500 text-white' : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {isAdded ? 'Added' : '+ Add'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" onClick={() => setAddMembersModalOpen(false)} className="bg-blue-600 hover:bg-blue-500">
                Done ({addedMembers.length} selected)
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

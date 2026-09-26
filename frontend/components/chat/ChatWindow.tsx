'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Avatar } from '../ui/Avatar';
import { MessageInput } from './MessageInput';
import {
  MessageSquare,
  Shield,
  Video,
  Users,
  Info,
  ArrowLeft,
  BarChart2,
  Columns,
  TrendingUp,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TradingViewChatPanel } from '../trading/TradingViewChatPanel';

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType?: 'text' | 'image' | 'video' | 'audio' | string;
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
  onSendMessage: (text: string, messageType?: 'text' | 'image' | 'video' | 'audio') => Promise<void>;
  onDeleteMessage?: (messageId: string) => void;
  onStartLiveCall?: () => void;
  onTyping?: () => void;
  typingUsers?: string[];
  onBack?: () => void;
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
  onBack,
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showGroupProfile, setShowGroupProfile] = useState(false);
  
  // View mode state for laptop / mobile ('chat' | 'split' | 'chart')
  const [viewMode, setViewMode] = useState<'chat' | 'split' | 'chart'>('chat');

  const [groupTitle, setGroupTitle] = useState(conversationName || 'FxZone Group');
  const [groupDescription, setGroupDescription] = useState('FxZone Trading & Signal Analysis Group');
  const [addMembersModalOpen, setAddMembersModalOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [addedMembers, setAddedMembers] = useState<string[]>([]);

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

  const handleToggleAddMember = (username: string) => {
    setAddedMembers((prev) =>
      prev.includes(username) ? prev.filter((m) => m !== username) : [...prev, username]
    );
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  // Handle Snapshot / Signal sent from TradingViewChatPanel
  const handleShareChartSnapshot = async (snapshotText: string) => {
    await onSendMessage(snapshotText);
  };

  const handleShareSignal = async (signalText: string) => {
    await onSendMessage(signalText);
  };

  return (
    <div className="flex-1 h-full flex flex-col justify-between bg-[#070b13] fxzone-chat-surface relative overflow-hidden">
      {/* ─── CHAT & TRADINGVIEW HEADER ─── */}
      <div className="h-14 px-3 sm:px-4 border-b border-zinc-850 flex items-center justify-between bg-[#0a0f1d] fxzone-chat-header select-none shrink-0 z-20">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-1.5 -ml-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors shrink-0"
              title="Back to Conversations"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <Avatar src={conversationAvatar} alt={conversationName} size="sm" />
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-white flex items-center gap-1.5 truncate">
              <span className="truncate">{conversationName}</span>
              {isGroup && (
                <button
                  onClick={() => setShowGroupProfile(true)}
                  className="text-[8px] bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 px-1.5 py-0.5 rounded font-bold uppercase transition-colors flex items-center gap-1 shrink-0"
                >
                  <Info size={9} /> Group Info
                </button>
              )}
            </h4>
            <span className="text-[9px] text-emerald-400 flex items-center gap-1 mt-0.5 font-semibold">
              <Shield size={9} /> Trading Encryption Active
            </span>
          </div>
        </div>

        {/* Middle Control: View Mode Switcher (Chat vs Split View vs TradingView Chart) */}
        <div className="flex bg-zinc-900/90 border border-zinc-800 rounded-xl p-0.5 gap-0.5">
          <button
            onClick={() => setViewMode('chat')}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all",
              viewMode === 'chat'
                ? "bg-blue-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            )}
            title="Chat Focus View"
          >
            <MessageSquare size={13} />
            <span className="hidden sm:inline">Chat</span>
          </button>

          <button
            onClick={() => setViewMode('split')}
            className={cn(
              "hidden md:flex px-2.5 py-1 rounded-lg text-[10px] font-bold items-center gap-1 transition-all",
              viewMode === 'split'
                ? "bg-blue-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            )}
            title="TradingView Split View (Chart + Chat)"
          >
            <Columns size={13} />
            <span>Split View</span>
          </button>

          <button
            onClick={() => setViewMode('chart')}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all",
              viewMode === 'chart'
                ? "bg-blue-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            )}
            title="TradingView Chart Workspace"
          >
            <BarChart2 size={13} />
            <span className="hidden sm:inline">TradingView</span>
          </button>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2">
          {isGroup && (
            <button
              onClick={() => setShowGroupProfile(true)}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-850 transition-colors"
              title="Group Members"
            >
              <Users size={16} />
            </button>
          )}

          {onStartLiveCall && (
            <button
              onClick={onStartLiveCall}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/15 border border-purple-500/30 text-purple-300 hover:bg-purple-600 hover:text-white transition-all text-xs font-semibold"
              title="Start 1-on-1 Trading Room"
            >
              <Video size={14} className="text-purple-400" />
              <span className="text-[10px] hidden sm:inline">1-on-1 Live</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── MAIN BODY WORKSPACE (SUPPORTING CHAT, CHART, & SPLIT VIEW) ─── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* TradingView Chart Panel (Visible in 'chart' mode OR 'split' mode on laptop/desktop) */}
        <div
          className={cn(
            "h-full p-2 transition-all duration-300 flex flex-col",
            viewMode === 'chart'
              ? "w-full"
              : viewMode === 'split'
              ? "hidden md:flex md:w-1/2 lg:w-3/5"
              : "hidden"
          )}
        >
          <TradingViewChatPanel
            onShareSnapshot={handleShareChartSnapshot}
            onShareSignal={handleShareSignal}
            className="h-full"
          />
        </div>

        {/* Chat Messages Feed & Input (Visible in 'chat' mode OR 'split' mode) */}
        <div
          className={cn(
            "h-full flex flex-col justify-between flex-1 transition-all duration-300",
            viewMode === 'chart' ? "hidden" : "flex w-full"
          )}
        >
          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 p-6 select-none">
                <div className="h-10 w-10 bg-zinc-900 border border-zinc-850 rounded-xl flex items-center justify-center text-zinc-500">
                  <MessageSquare size={16} />
                </div>
                <h5 className="text-xs font-semibold text-zinc-300">Secure Direct Message Channel</h5>
                <p className="text-[10px] text-zinc-500 max-w-[220px]">
                  Send market analysis, TradingView chart snapshots, or signals to begin trading together.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const senderIdVal = msg.senderId || (msg as any).sender_id;
                const isSelf = String(senderIdVal) === String(currentUserId);
                const legacyVoiceUrl = msg.content.match(/^\[Voice Note\]\s*\(url:\s*(https?:\/\/[^\s)]+)\)$/i)?.[1];

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex gap-2 max-w-[88%] sm:max-w-[75%]',
                      isSelf ? 'self-end flex-row-reverse' : 'self-start'
                    )}
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
                          'p-2.5 rounded-2xl border text-xs leading-relaxed break-words shadow-lg',
                          isSelf
                            ? 'bg-blue-600/10 border-blue-500/20 text-zinc-200 rounded-tr-none'
                            : 'bg-[#0f1523] fxzone-chat-message border-zinc-850 text-zinc-300 rounded-tl-none'
                        )}
                      >
                        {/* 1. Custom Renderer: TradingView Chart Snapshot Card */}
                        {msg.content.startsWith('[TradingView Chart]') ? (
                          <div className="space-y-2 p-2 bg-[#090d16] border border-blue-500/30 rounded-xl max-w-sm select-none">
                            <div className="flex items-center justify-between">
                              <span className="text-[8px] bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider flex items-center gap-1">
                                <BarChart2 size={10} /> TradingView Snapshot
                              </span>
                              <span className="text-[9px] text-zinc-400 font-bold">
                                {msg.content.match(/Symbol:\s*([^\s|]+)/)?.[1] || 'EURUSD'}
                              </span>
                            </div>

                            <div className="p-2 bg-black/40 rounded-lg border border-zinc-850 flex items-center justify-between">
                              <div>
                                <span className="text-[9px] text-zinc-500 uppercase block">Timeframe</span>
                                <span className="text-[11px] font-extrabold text-white">
                                  {msg.content.match(/Timeframe:\s*([^\s|]+)/)?.[1] || '1H'}
                                </span>
                              </div>

                              <div className="text-right">
                                <span className="text-[9px] text-zinc-500 uppercase block">Snapshot Price</span>
                                <span className="text-[11px] font-extrabold text-emerald-400">
                                  {msg.content.match(/Price:\s*([^\s|]+)/)?.[1] || '1.0850'}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => setViewMode('chart')}
                              className="w-full h-7 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all"
                            >
                              <ExternalLink size={12} /> Inspect Live TradingView Chart
                            </button>
                          </div>
                        ) : msg.content.startsWith('[Signal Card]') ? (
                          /* 2. Custom Renderer: Buy/Sell Signal Card */
                          (() => {
                            const side = msg.content.match(/Side:\s*([^\s|]+)/)?.[1] || 'BUY';
                            const isBuy = side.toUpperCase() === 'BUY';
                            const asset = msg.content.match(/Asset:\s*([^\s|]+)/)?.[1] || 'EURUSD';
                            const entry = msg.content.match(/Entry:\s*([^\s|]+)/)?.[1] || '1.0850';
                            const tp = msg.content.match(/TP:\s*([^\s|]+)/)?.[1] || '1.0920';
                            const sl = msg.content.match(/SL:\s*([^\s|]+)/)?.[1] || '1.0800';

                            return (
                              <div
                                className={cn(
                                  "space-y-2 p-2.5 rounded-xl border max-w-sm select-none",
                                  isBuy ? "bg-emerald-950/30 border-emerald-500/40" : "bg-red-950/30 border-red-500/40"
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <span
                                    className={cn(
                                      "text-[9px] px-2 py-0.5 rounded-md font-extrabold uppercase tracking-wider flex items-center gap-1 text-white shadow-md",
                                      isBuy ? "bg-emerald-600" : "bg-red-600"
                                    )}
                                  >
                                    {isBuy ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                    {side} SIGNAL • {asset}
                                  </span>
                                  <span className="text-[9px] text-zinc-400 font-semibold">Active Strategy</span>
                                </div>

                                <div className="grid grid-cols-3 gap-1 bg-black/50 p-2 rounded-lg border border-zinc-850 text-center">
                                  <div>
                                    <span className="text-[8px] text-zinc-500 uppercase block">Entry</span>
                                    <span className="text-[10px] font-bold text-white">{entry}</span>
                                  </div>
                                  <div>
                                    <span className="text-[8px] text-emerald-400 uppercase block">Target TP</span>
                                    <span className="text-[10px] font-bold text-emerald-300">{tp}</span>
                                  </div>
                                  <div>
                                    <span className="text-[8px] text-red-400 uppercase block">Stop SL</span>
                                    <span className="text-[10px] font-bold text-red-300">{sl}</span>
                                  </div>
                                </div>

                                <button
                                  onClick={() => setViewMode('chart')}
                                  className="w-full h-7 bg-zinc-900 hover:bg-zinc-850 text-zinc-200 border border-zinc-800 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all"
                                >
                                  <BarChart2 size={12} className="text-blue-400" /> Track Signal on Chart
                                </button>
                              </div>
                            );
                          })()
                        ) : msg.content.startsWith('[Live Session]') ? (
                          /* 3. Custom Renderer: Live Session Invite */
                          (() => {
                            const idMatch = msg.content.match(/\(id:\s*([^\)]+)\)/);
                            const titleMatch = msg.content.match(/\(title:\s*([^\)]+)\)/);
                            const sId = idMatch ? idMatch[1] : '';
                            const sTitle = titleMatch ? titleMatch[1] : 'Private Trading Room';
                            return (
                              <div className="space-y-2 p-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl max-w-xs select-none">
                                <span className="text-[8px] bg-purple-600/20 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                                  Live session invitation
                                </span>
                                <h5 className="text-[11px] font-bold text-white mt-1 leading-snug">{sTitle}</h5>
                                <button
                                  onClick={() => (window.location.href = `/session/${sId}`)}
                                  className="w-full h-7 mt-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                                >
                                  Join Session
                                </button>
                              </div>
                            );
                          })()
                        ) : msg.messageType === 'image' ? (
                          <img
                            src={msg.content}
                            alt="Shared image"
                            className="max-h-72 max-w-full rounded-lg object-contain"
                            loading="lazy"
                          />
                        ) : msg.messageType === 'video' ? (
                          <video
                            src={msg.content}
                            controls
                            playsInline
                            preload="metadata"
                            className="max-h-72 max-w-full rounded-lg"
                          />
                        ) : msg.messageType === 'audio' || legacyVoiceUrl ? (
                          <audio src={legacyVoiceUrl || msg.content} controls preload="metadata" className="max-w-full" />
                        ) : (
                          <p>{msg.content}</p>
                        )}

                        <div className="flex justify-between items-center gap-2 mt-1 text-[8px] text-zinc-500 select-none">
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <MessageInput onSendMessage={onSendMessage} onTyping={onTyping} />
        </div>
      </div>

      {/* ─── GROUP PROFILE MODAL ─── */}
      {showGroupProfile && (
        <Modal
          isOpen={showGroupProfile}
          onClose={() => setShowGroupProfile(false)}
          title={`Group Profile: ${conversationName}`}
        >
          <div className="space-y-4">
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between">
              <div>
                <h5 className="text-xs font-bold text-white">{conversationName}</h5>
                <p className="text-[10px] text-zinc-400">{members.length} active traders</p>
              </div>
              <Button size="sm" onClick={() => setAddMembersModalOpen(true)} className="bg-purple-600 hover:bg-purple-500 text-white text-[10px]">
                + Add Member
              </Button>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1">
              {members.map((m: any) => (
                <div key={m.userId || m.id} className="p-2 bg-zinc-950 rounded-lg flex items-center gap-2 border border-zinc-850">
                  <Avatar src={m.avatarUrl} name={m.displayName || m.username} size="sm" className="h-6 w-6" />
                  <span className="text-xs text-zinc-200 font-medium">{m.displayName || m.username}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowGroupProfile(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── ADD MEMBERS MODAL ─── */}
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

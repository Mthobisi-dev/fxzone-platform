'use client';

import React, { useRef, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
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
  Sparkles,
  Trash2,
  MoreHorizontal,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useMarketStore } from '@/stores/marketStore';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TradingViewChatPanel } from '../trading/TradingViewChatPanel';
import { playExclusive, releaseMedia } from '@/lib/mediaPlayback';
import { parseSerializedShareSignal } from '@/lib/shareSignal';

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType?: 'text' | 'image' | 'video' | 'audio' | string;
  createdAt: string;
  status?: 'pending' | 'sent' | 'failed';
  sender?: {
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
}

interface ChatWindowProps {
  conversationId: string;
  messages: ChatMessage[];
  currentUserId: string;
  conversationName: string;
  conversationAvatar?: string;
  isGroup: boolean;
  members?: any[];
  conversationData?: any;
  onSendMessage: (text: string, messageType?: 'text' | 'image' | 'video' | 'audio') => Promise<void>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  onRetryMessage?: (message: ChatMessage) => Promise<void>;
  onStartLiveCall?: () => void;
  onTyping?: () => void;
  typingUsers?: string[];
  onBack?: () => void;
  onLoadOlderMessages?: () => Promise<void>;
  hasOlderMessages?: boolean;
  isLoadingOlder?: boolean;
  highlightMessageId?: string | null;
  onGroupChanged?: () => Promise<void>;
}

export function ChatWindow({
  conversationId,
  messages,
  currentUserId,
  conversationName,
  conversationAvatar,
  isGroup,
  members = [],
  conversationData = {},
  onSendMessage,
  onDeleteMessage,
  onRetryMessage,
  onStartLiveCall,
  onTyping,
  typingUsers = [],
  onBack,
  onLoadOlderMessages,
  hasOlderMessages = false,
  isLoadingOlder = false,
  highlightMessageId = null,
  onGroupChanged,
}: ChatWindowProps) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const loadingOlderRef = useRef(false);
  const nearBottomRef = useRef(true);
  const [showGroupProfile, setShowGroupProfile] = useState(false);
  
  // View mode state for laptop / mobile ('chat' | 'split' | 'chart')
  const [viewMode, setViewMode] = useState<'chat' | 'split' | 'chart'>('chat');

  const [groupTitle, setGroupTitle] = useState(conversationName || 'FxZone Group');
  const [groupDescription, setGroupDescription] = useState(String(conversationData?.description || ''));
  const [addMembersModalOpen, setAddMembersModalOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [addedMembers, setAddedMembers] = useState<string[]>([]);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null);
  const creatorId = conversationData?.creator_id ?? conversationData?.creatorId;
  const isGroupAdmin = Boolean(isGroup && creatorId && String(creatorId) === String(currentUserId));

  const handleDeleteMessage = async (messageId: string) => {
    if (!onDeleteMessage || deletingMessageId) return;
    if (!window.confirm('Delete this message for everyone in the conversation?')) return;
    setDeletingMessageId(messageId);
    try {
      await onDeleteMessage(messageId);
    } catch (error) {
      console.error('Unable to delete chat message:', error);
      window.alert('The message could not be deleted. Please try again.');
    } finally {
      setDeletingMessageId(null);
    }
  };

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

  useEffect(() => setGroupTitle(conversationName || 'FxZone Group'), [conversationName]);
  useEffect(() => setGroupDescription(String(conversationData?.description || '')), [conversationData?.description]);

  const saveGroupSettings = async () => {
    if (!isGroupAdmin || !groupTitle.trim()) return;
    try {
      await api.patch(`/api/chat/conversations/${conversationId}`, { name: groupTitle.trim(), description: groupDescription.trim() });
      await onGroupChanged?.();
      setShowGroupProfile(false);
    } catch (error) {
      console.error('Unable to update group settings:', error);
      window.alert('The group settings could not be saved.');
    }
  };

  const applyAddedMembers = async () => {
    if (!isGroupAdmin || !addedMembers.length) return;
    try {
      await api.post(`/api/chat/conversations/${conversationId}/members`, { user_ids: addedMembers });
      await onGroupChanged?.();
      setAddedMembers([]);
      setAddMembersModalOpen(false);
    } catch (error) {
      console.error('Unable to add group members:', error);
      window.alert('Members could not be added.');
    }
  };

  const removeGroupMember = async (memberId: string) => {
    if (!isGroupAdmin || String(memberId) === String(currentUserId)) return;
    try {
      await api.delete(`/api/chat/conversations/${conversationId}/members?user_id=${encodeURIComponent(memberId)}`);
      await onGroupChanged?.();
    } catch (error) {
      console.error('Unable to remove group member:', error);
      window.alert('The member could not be removed.');
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('auto');
  }, [conversationId]);

  useEffect(() => {
    if (nearBottomRef.current) scrollToBottom();
  }, [messages.length, typingUsers.length]);

  useEffect(() => {
    if (!highlightMessageId) return;
    document.getElementById(`chat-message-${highlightMessageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightMessageId, messages.length]);

  const handleMessagesScroll = async (event: React.UIEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    nearBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 96;
    if (node.scrollTop > 48 || !onLoadOlderMessages || !hasOlderMessages || loadingOlderRef.current) return;
    loadingOlderRef.current = true;
    try {
      const previousHeight = node.scrollHeight;
      const previousTop = node.scrollTop;
      await onLoadOlderMessages();
      requestAnimationFrame(() => { node.scrollTop = node.scrollHeight - previousHeight + previousTop; });
    } finally {
      loadingOlderRef.current = false;
    }
  };

  // Handle Snapshot / Signal sent from TradingViewChatPanel
  const handleShareChartSnapshot = async (snapshotText: string) => {
    await onSendMessage(snapshotText);
  };

  const handleShareSignal = async (signalText: string) => {
    await onSendMessage(signalText);
  };

  return (
    <div className="fxzone-chat-surface relative flex h-full min-h-0 flex-1 flex-col justify-between overflow-hidden bg-[var(--fx-bg-canvas)]">
      {/* ─── CHAT & TRADINGVIEW HEADER ─── */}
      <div className="fxzone-chat-mobile-header fxzone-chat-header z-20 flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-x-1.5 gap-y-1.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 select-none sm:h-14 sm:flex-nowrap sm:gap-x-3 sm:px-4 sm:py-0">
        <div className="flex flex-1 items-center gap-2 sm:gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="-ml-1 grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg text-[var(--fx-text-muted)] transition-colors hover:bg-[var(--fx-bg-elevated)] hover:text-[var(--fx-text-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fx-accent)] md:hidden"
              title="Back to Conversations"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <Avatar src={conversationAvatar} alt={conversationName} size="sm" className="h-8 w-8 aspect-square" />
          <div className="min-w-0">
            <h4 className="flex truncate text-[11px] font-semibold text-[var(--color-text)] items-center gap-1.5 sm:text-xs">
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
        <div className="order-3 flex w-full justify-center gap-0.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-0.5 sm:order-none sm:w-auto">
          <button
            onClick={() => setViewMode('chat')}
            className={cn(
              "flex min-h-11 items-center gap-1 rounded-lg px-2.5 text-[10px] font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fx-accent)]",
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
              "flex min-h-11 items-center gap-1 rounded-lg px-2.5 text-[10px] font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fx-accent)]",
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
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {isGroup && (
            <button
              onClick={() => setShowGroupProfile(true)}
              className="grid min-h-11 min-w-11 place-items-center rounded-lg text-[var(--fx-text-muted)] transition-colors hover:bg-[var(--fx-bg-elevated)] hover:text-[var(--fx-text-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fx-accent)]"
              title="Group Members"
            >
              <Users size={16} />
            </button>
          )}

          {onStartLiveCall && (
            <button
              onClick={onStartLiveCall}
              className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-600/15 px-2 py-1.5 text-xs font-semibold text-purple-400 transition-all hover:bg-purple-600 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fx-accent)] sm:px-3"
              title="Start 1-on-1 Trading Room"
            >
              <Video size={14} className="text-purple-400" />
              <span className="text-[10px] hidden sm:inline">1-on-1 Live</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── MAIN BODY WORKSPACE (SUPPORTING CHAT, CHART, & SPLIT VIEW) ─── */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* TradingView Chart Panel (Visible in 'chart' mode OR 'split' mode on laptop/desktop) */}
        <div
          className={cn(
            "h-full min-h-0 p-1 sm:p-2 transition-all duration-300 flex flex-col",
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
          <div ref={messagesScrollRef} onScroll={handleMessagesScroll} className="flex-1 overflow-y-auto px-2.5 py-3 sm:p-4 flex flex-col gap-3 min-h-0 overscroll-contain">
            {isLoadingOlder && <div className="sticky top-0 z-10 self-center rounded-full bg-[var(--color-surface)] px-3 py-1 text-[10px] text-[var(--fx-text-muted)]">Loading older messages…</div>}
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
                const sharedSignal = parseSerializedShareSignal(msg.content);

                return (
                  <div
                    key={msg.id}
                    id={`chat-message-${msg.id}`}
                    className={cn(
                      'group flex gap-2 max-w-[88%] sm:max-w-[75%]',
                      isSelf ? 'self-end flex-row-reverse' : 'self-start',
                      highlightMessageId === msg.id && 'rounded-xl ring-2 ring-blue-400/70 ring-offset-2 ring-offset-[var(--fx-bg-canvas)]'
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
                            ? 'bg-blue-600/10 border-blue-500/20 text-[var(--fx-text-strong)] rounded-tr-none'
                            : 'bg-[var(--fx-bg-elevated)] fxzone-chat-message border-[var(--fx-border-subtle)] text-[var(--fx-text-strong)] rounded-tl-none'
                        )}
                      >
                        {/* 1. Custom Renderer: TradingView Chart Snapshot Card */}
                        {sharedSignal ? (
                          <div
                            className={cn(
                              'w-full max-w-sm space-y-2.5 rounded-xl border p-3',
                              sharedSignal.side === 'BUY'
                                ? 'border-emerald-500/40 bg-emerald-500/10'
                                : 'border-rose-500/40 bg-rose-500/10',
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className={cn(
                                  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-white',
                                  sharedSignal.side === 'BUY' ? 'bg-emerald-600' : 'bg-rose-600',
                                )}>
                                  {sharedSignal.side === 'BUY' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                  {sharedSignal.side} signal
                                </p>
                                <p className="mt-1 text-sm font-bold text-[var(--fx-text-strong)]">{sharedSignal.symbol}</p>
                              </div>
                              <span className="shrink-0 rounded-full border border-[var(--fx-border-subtle)] px-2 py-1 text-[9px] font-semibold text-[var(--fx-text-muted)]">
                                {sharedSignal.interval.toUpperCase()}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-[var(--fx-border-subtle)] bg-[var(--fx-bg-elevated)]/80 p-2 text-center">
                              <div>
                                <span className="block text-[8px] uppercase tracking-wide text-[var(--fx-text-muted)]">Entry</span>
                                <span className="fx-data mt-0.5 block text-[11px] font-bold text-[var(--fx-text-strong)]">{sharedSignal.entry}</span>
                              </div>
                              <div>
                                <span className="block text-[8px] uppercase tracking-wide text-emerald-500">Take profit</span>
                                <span className="fx-data mt-0.5 block text-[11px] font-bold text-emerald-500">{sharedSignal.takeProfit}</span>
                              </div>
                              <div>
                                <span className="block text-[8px] uppercase tracking-wide text-rose-500">Stop loss</span>
                                <span className="fx-data mt-0.5 block text-[11px] font-bold text-rose-500">{sharedSignal.stopLoss}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 py-0.5" aria-label="Signal levels">
                              <span className="h-px flex-1 bg-[var(--fx-border-subtle)]" />
                              <span className="text-[8px] font-semibold uppercase tracking-wide text-[var(--fx-text-muted)]">Signal levels</span>
                              <span className="h-px flex-1 bg-[var(--fx-border-subtle)]" />
                            </div>

                            {sharedSignal.rationale && (
                              <p className="text-[10px] leading-4 text-[var(--fx-text-muted)]">{sharedSignal.rationale}</p>
                            )}
                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--fx-border-subtle)] pt-2 text-[9px] text-[var(--fx-text-muted)]">
                              <span>{sharedSignal.provider}</span>
                              <time dateTime={sharedSignal.timestamp}>{new Date(sharedSignal.timestamp).toLocaleString()}</time>
                            </div>
                            <button
                              type="button"
                              onClick={() => { useMarketStore.getState().setSelectedAsset(sharedSignal.symbol); setViewMode('chart'); }}
                              className="flex h-8 w-full items-center justify-center gap-1 rounded-lg border border-blue-500/40 bg-blue-500/10 text-[10px] font-bold text-blue-500 transition-colors hover:bg-blue-500 hover:text-white"
                            >
                              <BarChart2 size={12} /> Inspect {sharedSignal.symbol} chart
                            </button>
                          </div>
                        ) : msg.content.startsWith('[TradingView Chart]') ? (
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
                                  {msg.content.match(/Price:\s*([^\s|]+)/)?.[1] || 'Unavailable'}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => { const symbol = msg.content.match(/Symbol:\s*([^\s|]+)/)?.[1]; if (symbol) useMarketStore.getState().setSelectedAsset(symbol); setViewMode('chart'); }}
                              className="w-full h-7 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all"
                            >
                              <ExternalLink size={12} /> Inspect Live TradingView Chart
                            </button>
                          </div>
                        ) : msg.content.startsWith('[Signal Card]') ? (
                          /* 2. Custom Renderer: Buy/Sell Signal Card */
                          (() => {
                            const side = msg.content.match(/Side:\s*([^\s|]+)/)?.[1]?.toUpperCase() || 'SIGNAL';
                            const isBuy = side.toUpperCase() === 'BUY';
                            const asset = msg.content.match(/Asset:\s*([^\s|]+)/)?.[1] || 'Unavailable';
                            const entry = msg.content.match(/Entry:\s*([^\s|]+)/)?.[1] || 'Unavailable';
                            const tp = msg.content.match(/TP:\s*([^\s|]+)/)?.[1] || 'Unavailable';
                            const sl = msg.content.match(/SL:\s*([^\s|]+)/)?.[1] || 'Unavailable';

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
                                  onClick={() => router.push(`/session/${encodeURIComponent(sId)}`)}
                                  className="w-full h-7 mt-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                                >
                                  Join Session
                                </button>
                              </div>
                            );
                          })()
                        ) : msg.messageType === 'image' ? (
                          <Image
                            src={msg.content}
                            alt="Shared image"
                            width={720}
                            height={720}
                            unoptimized
                            className="h-auto w-auto max-h-72 max-w-full rounded-lg object-contain"
                            loading="lazy"
                          />
                        ) : msg.messageType === 'video' ? (
                          <video
                            src={msg.content}
                            controls
                            playsInline
                            preload="metadata"
                            className="max-h-72 max-w-full rounded-lg"
                            onPlay={(event) => playExclusive(event.currentTarget)}
                            onEnded={(event) => releaseMedia(event.currentTarget)}
                          />
                        ) : msg.messageType === 'audio' || legacyVoiceUrl ? (
                          <audio src={legacyVoiceUrl || msg.content} controls preload="metadata" className="max-w-full" onPlay={(event) => playExclusive(event.currentTarget)} onEnded={(event) => releaseMedia(event.currentTarget)} />
                        ) : (
                          <p className="[overflow-wrap:anywhere]">{msg.content}</p>
                        )}

                        <div className="flex justify-between items-center gap-2 mt-1 text-[8px] text-zinc-500 select-none">
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {isSelf && msg.status === 'failed' && onRetryMessage && (
                            <button type="button" onClick={() => void onRetryMessage(msg)} className="text-red-400 hover:text-red-300 font-semibold">
                              Retry
                            </button>
                          )}
                          {isSelf && msg.status === 'pending' && <span className="text-blue-400">Sending…</span>}
                          {(isSelf && onDeleteMessage && !String(msg.id).startsWith('temp-')) && (
                            <div className="relative">
                              <button type="button" onClick={() => setOpenMessageMenuId((current) => current === msg.id ? null : msg.id)} aria-label="Message actions" title="Message actions" className="grid min-h-9 min-w-9 place-items-center rounded-lg text-[var(--fx-text-muted)] transition hover:bg-[var(--fx-bg-elevated)] hover:text-[var(--fx-text-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fx-accent)]">
                                <MoreHorizontal size={15} />
                              </button>
                              {openMessageMenuId === msg.id && (
                                <div className="absolute bottom-full right-0 z-30 mb-1 min-w-32 rounded-lg border border-[var(--fx-border-subtle)] bg-[var(--color-surface)] p-1 shadow-xl">
                                  {msg.messageType === 'text' && <button type="button" onClick={() => { void navigator.clipboard?.writeText(msg.content); setOpenMessageMenuId(null); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[10px] text-[var(--fx-text-strong)] hover:bg-[var(--fx-bg-elevated)]"><Copy size={12} /> Copy text</button>}
                                  <button type="button" onClick={() => { setOpenMessageMenuId(null); void handleDeleteMessage(msg.id); }} disabled={Boolean(deletingMessageId)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[10px] text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"><Trash2 size={12} /> Delete</button>
                                </div>
                              )}
                            </div>
                          )}
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
          <MessageInput conversationId={conversationId} onSendMessage={onSendMessage} onTyping={onTyping} />
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
              {isGroupAdmin && <Button size="sm" onClick={() => { setAddMembersModalOpen(true); void fetchUsersForGroup(); }} className="bg-purple-600 hover:bg-purple-500 text-white text-[10px]">
                + Add Member
              </Button>}
            </div>

            {isGroupAdmin && <div className="space-y-2"><input value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} maxLength={120} className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-white" aria-label="Group name" /><textarea value={groupDescription} onChange={(event) => setGroupDescription(event.target.value)} maxLength={500} rows={2} placeholder="Group description" className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-white" aria-label="Group description" /><div className="flex justify-end"><Button size="sm" onClick={() => void saveGroupSettings()}>Save</Button></div></div>}

            <div className="max-h-48 overflow-y-auto space-y-1">
              {members.map((m: any) => (
                <div key={m.userId || m.id} className="p-2 bg-zinc-950 rounded-lg flex items-center gap-2 border border-zinc-850">
                  <Avatar src={m.avatarUrl} name={m.displayName || m.username} size="sm" className="h-6 w-6" />
                  <span className="text-xs text-zinc-200 font-medium">{m.displayName || m.username}</span>
                  {isGroupAdmin && String(m.userId || m.id) !== String(currentUserId) && <button type="button" onClick={() => void removeGroupMember(String(m.userId || m.id))} className="ml-auto text-[10px] text-rose-400 hover:text-rose-300">Remove</button>}
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
                  const isAdded = addedMembers.includes(String(u.id));
                  return (
                    <div
                      key={u.id}
                      onClick={() => handleToggleAddMember(String(u.id))}
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
              <Button size="sm" onClick={() => void applyAddedMembers()} className="bg-blue-600 hover:bg-blue-500">
                Done ({addedMembers.length} selected)
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

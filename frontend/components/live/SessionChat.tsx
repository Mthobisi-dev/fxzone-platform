'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, ShieldCheck } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { cn } from '@/lib/utils';

export interface SessionChatMessage {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  content: string;
  createdAt: string;
}

interface SessionChatProps {
  messages: SessionChatMessage[];
  onSendMessage: (text: string) => void;
  currentUserId: string;
}

export function SessionChat({ messages, onSendMessage, currentUserId }: SessionChatProps) {
  const [text, setText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText('');
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="w-80 h-full border-l border-zinc-850 bg-zinc-950/30 flex flex-col justify-between shrink-0">
      {/* Header */}
      <div className="h-12 px-4 border-b border-zinc-850 flex items-center justify-between bg-zinc-900/10 select-none">
        <span className="text-xs font-bold text-white flex items-center gap-1.5">
          <MessageSquare size={13} className="text-blue-400" /> Session Chat
        </span>
        <span className="text-[9px] text-zinc-500 font-medium flex items-center gap-1">
          <ShieldCheck size={11} className="text-emerald-500" /> Secured
        </span>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-0">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center select-none">
            <p className="text-[10px] text-zinc-550 italic">Discussion is silent. Type a message below to start the conversation.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.userId === currentUserId;
            
            return (
              <div key={msg.id} className="flex gap-2 items-start text-[11px] leading-relaxed">
                <Avatar src={msg.avatarUrl} alt={msg.username} size="sm" className="h-6 w-6 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline gap-1 select-none">
                    <span className={cn('font-bold truncate max-w-[100px]', isSelf ? 'text-blue-400' : 'text-zinc-200')}>
                      {msg.displayName || msg.username}
                    </span>
                    <span className="text-[8px] text-zinc-650 shrink-0">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-zinc-300 break-words mt-0.5">{msg.content}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-zinc-850 bg-zinc-950 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask host a question..."
          className="flex-1 h-8 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-colors disabled:opacity-40"
        >
          <Send size={12} />
        </button>
      </form>
    </div>
  );
}

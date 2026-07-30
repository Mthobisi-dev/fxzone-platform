'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { X, Send, Bot, User, Sparkles, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIChatPanel({ isOpen, onClose }: AIChatPanelProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I am FxZone AI, powered by Google AI. I can analyze assets, summarize market sentiment, evaluate watchlist news, and run risk checks. What are you looking to analyze today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);
    setIsLoading(true);

    try {
      // Send chat request to backend
      const response = await api.post('/api/ai/chat', {
        message: userMessage,
        conversation_id: conversationId,
      });

      if (response && response.message) {
        if (response.conversation_id) {
          setConversationId(response.conversation_id);
        }
        
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: response.message,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (err: any) {
      console.error('AI Chat Error:', err);
      const errorDetail = err?.detail || err?.message || 'Unknown error';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ AI Error: ${errorDetail}\n\nPlease check that the backend is running and try again.`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ x: 400, opacity: 0.9 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0.9 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="w-96 border-l border-zinc-850 bg-gradient-to-b from-zinc-950 via-purple-950/20 to-zinc-950 backdrop-blur-2xl h-full flex flex-col justify-between shadow-2xl z-30 shrink-0 overscroll-contain"
    >
      {/* Header */}
      <div className="h-14 px-4 border-b border-zinc-850 flex items-center justify-between bg-zinc-950/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-md">
            <Bot size={16} className="animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              FxZone Google AI <Sparkles size={10} className="text-purple-400" />
            </h3>
            <span className="text-[9px] text-zinc-400 block font-medium">Google Gemini Trading Advisor</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors focus:outline-none"
        >
          <X size={16} />
        </button>
      </div>

      {/* Message Feed - Isolated Scroll */}
      <div className="flex-1 overflow-y-auto overscroll-contain max-h-[calc(100vh-140px)] p-4 flex flex-col gap-4 scrollbar-thin scrollbar-thumb-zinc-800">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={cn(
              'flex gap-2.5 max-w-[85%] rounded-xl p-3 border text-xs leading-relaxed shadow-md',
              msg.role === 'user'
                ? 'bg-blue-600/20 border-blue-500/30 text-zinc-200 self-end rounded-tr-none'
                : 'bg-zinc-900/80 border-zinc-800 text-zinc-300 self-start rounded-tl-none'
            )}
          >
            <div className="shrink-0 mt-0.5">
              {msg.role === 'user' ? (
                <User size={12} className="text-blue-400" />
              ) : (
                <Bot size={12} className="text-purple-400" />
              )}
            </div>
            <div className="flex-1 whitespace-pre-line">{msg.content}</div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5 max-w-[85%] rounded-xl p-3 border bg-zinc-900/80 border-zinc-800 text-zinc-300 self-start rounded-tl-none items-center shadow-md">
            <Bot size={12} className="text-purple-400 shrink-0" />
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce delay-75" />
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce delay-150" />
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce delay-225" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer / Input */}
      <div className="p-4 border-t border-zinc-850 bg-zinc-950 flex flex-col gap-2.5 select-none">
        {/* Risk Disclaimer */}
        <div className="p-2 border border-yellow-500/20 bg-yellow-500/5 rounded-lg flex gap-2 items-start text-[9px] text-yellow-500/90 leading-normal">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <p>
            Risk Disclaimer: Financial market trading carries high risk. AI-generated insights are for reference only, not direct investment advice.
          </p>
        </div>

        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI about BTC, stocks, or sentiment..."
            className="h-9 py-1 px-3 bg-zinc-900 text-xs border-zinc-800"
            disabled={isLoading}
          />
          <Button type="submit" size="sm" className="h-9 px-3 shrink-0" disabled={isLoading}>
            <Send size={14} />
          </Button>
        </form>
      </div>
    </motion.div>
  );
}

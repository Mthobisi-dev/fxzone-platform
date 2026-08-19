'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { X, Send, Bot, User, Sparkles, AlertTriangle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Renders AI message content with full markdown support */
function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Headings
        h1: ({ children }) => (
          <h1 className="text-sm font-black text-white mb-1 mt-2 border-b border-zinc-700 pb-1">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xs font-bold text-purple-300 mb-1 mt-2">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-xs font-semibold text-zinc-200 mb-1 mt-1.5">{children}</h3>
        ),
        // Paragraphs
        p: ({ children }) => (
          <p className="text-xs text-zinc-300 leading-relaxed mb-1.5 last:mb-0">{children}</p>
        ),
        // Bold & italic
        strong: ({ children }) => (
          <strong className="font-bold text-white">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-zinc-400">{children}</em>
        ),
        // Lists
        ul: ({ children }) => (
          <ul className="list-none space-y-0.5 mb-1.5 pl-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-0.5 mb-1.5 pl-1 text-xs text-zinc-300">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="flex gap-1.5 text-xs text-zinc-300 leading-relaxed">
            <span className="text-purple-400 shrink-0 mt-0.5">•</span>
            <span>{children}</span>
          </li>
        ),
        // Code blocks
        code: ({ inline, children }: any) =>
          inline ? (
            <code className="px-1 py-0.5 bg-zinc-800 rounded text-[10px] font-mono text-emerald-300">{children}</code>
          ) : (
            <code className="block bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-[10px] font-mono text-emerald-300 overflow-x-auto my-1.5">{children}</code>
          ),
        // Blockquote (used for disclaimer)
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-amber-500/50 pl-2 my-1 bg-amber-500/5 rounded-r py-1">
            <div className="text-[10px] text-amber-400/90 italic">{children}</div>
          </blockquote>
        ),
        // Horizontal rule
        hr: () => <hr className="border-zinc-800 my-2" />,
        // Tables
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="text-[10px] border border-zinc-800 rounded text-zinc-300 w-full">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-zinc-900">{children}</thead>,
        th: ({ children }) => <th className="px-2 py-1 border border-zinc-800 font-bold text-purple-300 text-left">{children}</th>,
        td: ({ children }) => <td className="px-2 py-1 border border-zinc-800">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

const QUICK_QUESTIONS = [
  'What is the price of Gold?',
  'Bitcoin analysis',
  'Forex overview',
  'Risk management tips',
];

export function AIChatPanel({ isOpen, onClose }: AIChatPanelProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "Hello! I'm **FxZone AI** 🤖 — your live market intelligence assistant.\n\nI have real-time access to:\n- 📈 **Crypto**: Bitcoin, Ethereum, Solana & more\n- 💱 **Forex**: EURUSD, GBPUSD, USDJPY & all major pairs\n- 🏦 **Stocks**: AAPL, NVDA, TSLA, MSFT & more\n- 🪙 **Commodities**: Gold (XAUUSD), Silver (XAGUSD)\n\nAsk me anything about current prices, trends, or analysis!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage = messageText.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);
    setIsLoading(true);

    try {
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
      const errorDetail = err?.detail || err?.message || 'Connection issue';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ **Connection Error**\n\n${errorDetail}\n\nPlease check your connection and try again.`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage(input);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ x: 400, opacity: 0.9 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0.9 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="w-full sm:w-96 fixed inset-0 sm:inset-y-0 sm:right-0 sm:left-auto border-l border-zinc-800 bg-gradient-to-b from-zinc-950 via-purple-950/10 to-zinc-950 backdrop-blur-2xl h-full flex flex-col shadow-2xl z-50 shrink-0 overscroll-contain"
    >
      {/* Header */}
      <div className="h-14 px-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/90 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-purple-600/30 to-blue-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-md shrink-0">
            <Bot size={16} className="animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              FxZone AI <Sparkles size={10} className="text-purple-400" />
            </h3>
            <span className="text-[9px] text-emerald-400 block font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block animate-pulse" />
              Live Market Intelligence
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setMessages([{
                role: 'assistant',
                content: "Chat cleared. Ask me about any market — Gold, Bitcoin, Forex, or Stocks!",
                timestamp: new Date(),
              }]);
              setConversationId(null);
            }}
            title="Clear chat"
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-lg transition-colors"
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors focus:outline-none"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-3 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-zinc-800">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={cn(
              'flex gap-2 max-w-[90%] rounded-xl p-3 border shadow-md',
              msg.role === 'user'
                ? 'bg-blue-600/15 border-blue-500/25 text-zinc-200 self-end rounded-tr-none ml-auto'
                : 'bg-zinc-900/70 border-zinc-800/80 text-zinc-300 self-start rounded-tl-none'
            )}
          >
            <div className="shrink-0 mt-1">
              {msg.role === 'user' ? (
                <User size={11} className="text-blue-400" />
              ) : (
                <Bot size={11} className="text-purple-400" />
              )}
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              {msg.role === 'assistant' ? (
                <MarkdownMessage content={msg.content} />
              ) : (
                <p className="text-xs leading-relaxed">{msg.content}</p>
              )}
              <span className="text-[8px] text-zinc-600 mt-1 block">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2 max-w-[90%] rounded-xl p-3 border bg-zinc-900/70 border-zinc-800 self-start rounded-tl-none items-center shadow-md">
            <Bot size={11} className="text-purple-400 shrink-0" />
            <div className="flex items-center gap-1 px-1">
              <span className="text-[10px] text-zinc-500 mr-1">Analyzing markets</span>
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Questions */}
      {messages.length <= 1 && !isLoading && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="text-[9px] px-2 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:text-purple-200 transition-colors font-medium"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Footer / Input */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-950/90 flex flex-col gap-2 select-none shrink-0">
        {/* Risk Disclaimer */}
        <div className="px-2 py-1.5 border border-amber-500/20 bg-amber-500/5 rounded-lg flex gap-1.5 items-start text-[9px] text-amber-500/80 leading-normal">
          <AlertTriangle size={10} className="shrink-0 mt-0.5" />
          <p>AI insights are for research only. Not financial advice. Trade responsibly.</p>
        </div>

        <form onSubmit={handleSend} className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about Gold, BTC, EURUSD..."
            className="flex-1 h-9 px-3 bg-zinc-900 text-xs border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 transition-colors"
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e as any);
              }
            }}
          />
          <Button type="submit" size="sm" className="h-9 px-3 shrink-0 bg-purple-600 hover:bg-purple-500" disabled={isLoading || !input.trim()}>
            <Send size={13} />
          </Button>
        </form>
      </div>
    </motion.div>
  );
}

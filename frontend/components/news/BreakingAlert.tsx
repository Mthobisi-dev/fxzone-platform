'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, X, ArrowRight, BellRing } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebSocket } from '@/hooks/useWebSocket';

interface BreakingNews {
  id: string;
  title: string;
  source: string;
  summary: string;
}

export function BreakingAlert() {
  const [activeAlert, setActiveAlert] = useState<BreakingNews | null>(null);

  // Subscribe to news stream via websocket
  useWebSocket('/ws/news', {
    breaking_news: (payload) => {
      const article = payload.data as BreakingNews;
      setActiveAlert(article);
    }
  });

  useEffect(() => {
    if (activeAlert) {
      const timer = setTimeout(() => {
        setActiveAlert(null);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [activeAlert]);

  if (!activeAlert) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 select-none"
      >
        <div className="bg-rose-950/90 border border-rose-500/50 backdrop-blur-md rounded-xl shadow-[0_0_25px_rgba(239,68,68,0.25)] p-4 flex gap-3 items-start relative overflow-hidden">
          {/* Animated Edge Accent */}
          <div className="absolute top-0 left-0 h-full w-1.5 bg-rose-500 animate-pulse" />
          
          <div className="h-8 w-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 mt-0.5 animate-bounce">
            <BellRing size={16} />
          </div>

          <div className="flex-1 pr-6">
            <span className="text-[9px] font-bold text-rose-400 uppercase tracking-widest block mb-0.5">
              Breaking News Alert
            </span>
            <h4 className="text-xs font-semibold text-white leading-snug mb-1">
              {activeAlert.title}
            </h4>
            <p className="text-[10px] text-rose-200/80 leading-normal line-clamp-2">
              {activeAlert.summary}
            </p>
          </div>

          <button
            onClick={() => setActiveAlert(null)}
            className="absolute top-3 right-3 p-1 text-rose-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors focus:outline-none"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

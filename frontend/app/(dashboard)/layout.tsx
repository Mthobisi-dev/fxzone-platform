'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';
import { PriceTickerBar } from '@/components/trading/PriceTickerBar';
import { AIChatPanel } from '@/components/ai/AIChatPanel';
import { AnimatePresence } from 'framer-motion';

const LOADING_TIMEOUT_MS = 6000;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, isAuthenticated } = useAuth(true);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) return;
    const id = setTimeout(() => {
      setTimedOut(true);
    }, LOADING_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [isLoading]);

  useEffect(() => {
    if (timedOut && !isAuthenticated && typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }, [timedOut, isAuthenticated]);

  const showLoadingOverlay = isLoading && !timedOut;

  return (
    <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden text-zinc-200 relative selection:bg-blue-600 selection:text-white">
      {/* Smooth Loading Shield to prevent flashing during session hydration */}
      {showLoadingOverlay && (
        <div className="absolute inset-0 z-50 bg-[#05070d] flex flex-col items-center justify-center gap-3 transition-opacity duration-300">
          <div className="h-8 w-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-zinc-400 tracking-wider">
            Syncing FxZone Terminal...
          </span>
        </div>
      )}

      {/* 1. Price Ticker Bar */}
      <PriceTickerBar />

      {/* 2. Top Navbar */}
      <Navbar onToggleAI={() => setIsAIOpen(!isAIOpen)} isAIOpen={isAIOpen} />

      {/* 3. Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Side: Sidebar */}
        <Sidebar />

        {/* Center: Main Dashboard Viewport */}
        <main className="flex-1 overflow-y-auto bg-zinc-950/40 relative pb-16 md:pb-0">
          {children}
        </main>

        {/* Right Side: AI Assistant Side Panel */}
        <AnimatePresence>
          {isAIOpen && (
            <AIChatPanel isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

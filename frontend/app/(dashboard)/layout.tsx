'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';
import { PriceTickerBar } from '@/components/trading/PriceTickerBar';
import { AIChatPanel } from '@/components/ai/AIChatPanel';
import { AnimatePresence } from 'framer-motion';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Protect routes - redirect to /login if not authenticated
  const { isLoading, isAuthenticated } = useAuth(true);
  const [isAIOpen, setIsAIOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-zinc-500 tracking-wider">Syncing FxZone Terminal...</span>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="h-screen bg-zinc-950/70 backdrop-blur-sm flex flex-col overflow-hidden text-zinc-200">
      {/* 1. Price Ticker Bar */}
      <PriceTickerBar />

      {/* 2. Top Navbar */}
      <Navbar onToggleAI={() => setIsAIOpen(!isAIOpen)} isAIOpen={isAIOpen} />

      {/* 3. Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Side: Sidebar */}
        <Sidebar />

        {/* Center: Main Dashboard Viewport */}
        <main className="flex-1 overflow-y-auto bg-zinc-950/30 relative">
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

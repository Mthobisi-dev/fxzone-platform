'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CandlestickChart } from '@/components/trading/CandlestickChart';
import { WatchlistPanel } from '@/components/trading/WatchlistPanel';
import { MarketOverview } from '@/components/trading/MarketOverview';
import { NewsFeed } from '@/components/news/NewsFeed';
import { AIInsightCard } from '@/components/ai/AIInsightCard';
import { useMarketStore } from '@/stores/marketStore';
import { Button } from '@/components/ui/Button';
import { ShieldAlert, ArrowRight, Sparkles, Activity } from 'lucide-react';

export default function PublicDemoPage() {
  const { assets, fetchAssets, fetchPrices, selectedAsset, setSelectedAsset } = useMarketStore();
  const [aiInsights, setAIInsights] = useState<any[]>([]);

  useEffect(() => {
    fetchAssets();
    fetchPrices();
    const interval = setInterval(fetchPrices, 15000);
    return () => clearInterval(interval);
  }, [fetchAssets, fetchPrices]);

  useEffect(() => {
    if (assets.length > 0 && !selectedAsset) {
      setSelectedAsset(assets[0]);
    }
  }, [assets, selectedAsset, setSelectedAsset]);

  // Default demo insights if API is offline
  const demoInsights = aiInsights.length > 0 ? aiInsights : [
    {
      symbol: selectedAsset?.symbol || 'BTCUSD',
      sentiment: 'BULLISH',
      confidence: 84,
      keyPoints: [
        'Consolidating above 50-day EMA support with steady volume.',
        'Macro market sentiment score +0.42.',
        'RSI neutral (58) indicating room for upside continuation.'
      ],
      timeframe: '4H',
      created_at: new Date().toISOString()
    }
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans select-none">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-900/60 via-blue-900/60 to-zinc-900 border-b border-purple-500/30 px-6 py-2.5 flex items-center justify-between text-xs backdrop-blur-md">
        <div className="flex items-center gap-2 text-purple-300">
          <ShieldAlert size={16} className="text-purple-400 shrink-0" />
          <span className="font-bold">DEMO MODE:</span>
          <span className="text-zinc-300 hidden sm:inline">Interactive read-only terminal preview. Real trading requires an account.</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button size="sm" variant="ghost" className="text-xs text-zinc-300 hover:text-white h-7">
              Sign In
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="text-xs bg-purple-600 hover:bg-purple-500 font-bold h-7 px-3">
              Create Account <ArrowRight size={12} className="ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Terminal View */}
      <div className="flex-1 p-4 md:p-6 max-w-[1600px] mx-auto w-full space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <img src="/fxzone-logo.jpg" alt="FxZone Logo" className="h-8 w-8 rounded-lg object-cover border border-zinc-700" />
              <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                FxZone Terminal <span className="text-xs font-semibold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">Public Demo</span>
              </h1>
            </div>
            <p className="text-xs text-zinc-400 mt-1">Real-time market feeds & Gemini AI technical analysis</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400">
              <Activity size={12} className="animate-pulse" /> Live Market Feeds
            </div>
          </div>
        </div>

        {/* Top Market Overview Bar */}
        <MarketOverview />

        {/* Grid Layout: Left Watchlist, Center Chart & AI, Right News */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Watchlist Panel */}
          <div className="lg:col-span-3">
            <WatchlistPanel />
          </div>

          {/* Center Column: Chart & AI Insight */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/80 p-4 backdrop-blur-md">
              <CandlestickChart symbol={selectedAsset?.symbol || 'EURUSD'} />
            </div>

            {/* AI Technical Analysis Insight */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400">
                <Sparkles size={14} /> Gemini AI Technical Analysis (Demo)
              </div>
              <div className="grid grid-cols-1 gap-4">
                {demoInsights.map((insight: any, i: number) => (
                  <AIInsightCard key={i} insight={insight} />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: News Stream */}
          <div className="lg:col-span-3">
            <NewsFeed />
          </div>
        </div>
      </div>
    </div>
  );
}

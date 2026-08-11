'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useMarketStore } from '@/stores/marketStore';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ShieldAlert, ArrowRight, Sparkles, Activity, TrendingUp, Brain, Zap } from 'lucide-react';

// Lazy-load heavy chart to avoid SSR issues
const CandlestickChart = dynamic(
  () => import('@/components/trading/CandlestickChart').then((m) => ({ default: m.CandlestickChart })),
  { ssr: false, loading: () => <div className="h-64 flex items-center justify-center text-zinc-500 text-xs">Loading chart...</div> }
);

const MarketOverview = dynamic(
  () => import('@/components/trading/MarketOverview').then((m) => ({ default: m.MarketOverview })),
  { ssr: false }
);

const NewsFeed = dynamic(
  () => import('@/components/news/NewsFeed').then((m) => ({ default: m.NewsFeed })),
  { ssr: false }
);

// Static demo AI insight — avoids any API call or type mismatch
const DEMO_INSIGHT = {
  symbol: 'EURUSD',
  name: 'Euro / US Dollar',
  sentiment: 'BULLISH',
  confidence: 84,
  keyPoints: [
    'Price consolidating above 50-day EMA with steady volume.',
    'Macro market sentiment score +0.42 (risk-on environment).',
    'RSI at 58 — neutral, room for upside continuation.',
    'EMA 200 alignment suggests medium-term bullish structure.',
  ],
  lastUpdated: new Date().toISOString(),
};

export default function PublicDemoPage() {
  const { assets, fetchAssets, fetchPrices, selectedAsset, setSelectedAsset } = useMarketStore();

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

  const symbol = selectedAsset?.symbol || 'EURUSD';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* ── Demo Banner ── */}
      <div className="bg-gradient-to-r from-purple-900/60 via-blue-900/60 to-zinc-900 border-b border-purple-500/30 px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs backdrop-blur-md">
        <div className="flex items-center gap-2 text-purple-300 min-w-0">
          <ShieldAlert size={15} className="text-purple-400 shrink-0" />
          <span className="font-bold shrink-0">DEMO MODE</span>
          <span className="text-zinc-400 hidden sm:inline truncate">— Read-only terminal preview. Real trading requires an account.</span>
        </div>
        <div className="flex items-center gap-2 ml-3 shrink-0">
          <Link href="/login">
            <Button size="sm" variant="ghost" className="text-xs text-zinc-300 hover:text-white h-7 px-2">
              Sign In
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="text-xs bg-purple-600 hover:bg-purple-500 font-bold h-7 px-3 flex items-center gap-1">
              Get Started <ArrowRight size={11} />
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 p-4 md:p-6 max-w-[1600px] mx-auto w-full space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <img src="/fxzone-logo.jpg" alt="FxZone" className="h-8 w-8 rounded-lg object-cover border border-zinc-700" />
              <div>
                <h1 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                  FxZone Terminal
                  <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                    Public Demo
                  </span>
                </h1>
                <p className="text-[11px] text-zinc-500 mt-0.5">Real-time market feeds · Gemini AI analysis</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold text-emerald-400">
              <Activity size={11} className="animate-pulse" /> Live Feeds
            </span>
          </div>
        </div>

        {/* Market Overview Ticker */}
        <MarketOverview />

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left — Chart */}
          <div className="lg:col-span-8 space-y-5">
            <Card className="p-4 bg-zinc-900/50 border-zinc-800/80 backdrop-blur-md rounded-2xl">
              <CandlestickChart />
            </Card>

            {/* AI Insight Card — inline, no component import to avoid type issues */}
            <Card className="p-5 bg-zinc-900/50 border-zinc-800/80 backdrop-blur-md rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-purple-600/20 border border-purple-500/30">
                  <Brain size={16} className="text-purple-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-2">
                    Gemini AI Signal
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      BULLISH
                    </span>
                  </p>
                  <p className="text-[10px] text-zinc-500">{DEMO_INSIGHT.name} · {symbol}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Sparkles size={14} className="text-purple-400" />
                  <span className="text-xs font-black text-purple-300">{DEMO_INSIGHT.confidence}%</span>
                  <span className="text-[10px] text-zinc-500">confidence</span>
                </div>
              </div>

              {/* Confidence bar */}
              <div className="h-1.5 bg-zinc-800 rounded-full mb-4 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                  style={{ width: `${DEMO_INSIGHT.confidence}%` }}
                />
              </div>

              {/* Key points */}
              <ul className="space-y-2">
                {DEMO_INSIGHT.keyPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-zinc-300">
                    <span className="mt-0.5 shrink-0 h-4 w-4 rounded bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-[9px] text-purple-400 font-bold">
                      {i + 1}
                    </span>
                    {point}
                  </li>
                ))}
              </ul>

              {/* Technical factors */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'EMA 50', value: 'Trend ↑', color: 'text-emerald-400' },
                  { label: 'RSI', value: '58 Neutral', color: 'text-yellow-400' },
                  { label: 'Macro', value: '+0.42 Risk-On', color: 'text-blue-400' },
                  { label: 'Risk', value: 'Moderate', color: 'text-amber-400' },
                ].map((f) => (
                  <div key={f.label} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-zinc-500 mb-0.5">{f.label}</p>
                    <p className={`text-[11px] font-bold ${f.color}`}>{f.value}</p>
                  </div>
                ))}
              </div>

              <p className="text-[9px] text-zinc-600 mt-3">
                ⚠ AI signals are for analytical purposes only. Not financial advice.
              </p>
            </Card>
          </div>

          {/* Right — News */}
          <div className="lg:col-span-4">
            <NewsFeed />
          </div>
        </div>

        {/* CTA strip */}
        <div className="p-5 rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-900/20 to-blue-900/10 text-center mt-2">
          <p className="text-xs text-zinc-300 mb-3">
            <Zap size={12} className="inline mr-1 text-purple-400" />
            You&apos;re viewing a <strong>read-only</strong> demo. Create an account to access the full terminal with portfolio tracking, live trading, and AI alerts.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/register">
              <Button className="text-xs bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 font-bold px-5 h-8">
                Create Free Account <ArrowRight size={12} className="ml-1" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" className="text-xs text-zinc-400 hover:text-white h-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

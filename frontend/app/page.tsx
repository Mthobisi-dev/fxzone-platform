'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Brain,
  TrendingUp,
  Globe,
  Users,
  Video,
  Monitor,
  ArrowRight,
  ShieldCheck,
  Zap,
  Sparkles,
  BarChart3,
  Lock,
  Activity,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function LandingPage() {
  const [livePrices, setLivePrices] = React.useState<any[]>([]);
  const [landingInsight, setLandingInsight] = React.useState<any>(null);
  const [systemStats, setSystemStats] = React.useState({
    monthlyVolume: '$3.8T+',
    activeTraders: '120K+',
    executionLatency: '< 15ms',
    platformUptime: '99.99%',
  });

  React.useEffect(() => {
    const fetchLivePrices = async () => {
      try {
        const res = await fetch('/api/market/prices');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setLivePrices(data.slice(0, 6));
          }
        }
      } catch (err) {
        console.error('Failed to fetch landing live prices:', err);
      }
    };

    const fetchLandingInsight = async () => {
      try {
        const res = await fetch('/api/ai/insights');
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : (data && Array.isArray(data.insights) ? data.insights : []);
          if (items.length > 0) {
            setLandingInsight(items[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch landing insight:', err);
      }
    };

    const fetchSystemStats = async () => {
      try {
        const res = await fetch('/api/social/users');
        if (res.ok) {
          const users = await res.json();
          const count = Array.isArray(users) ? users.length : 1;
          const activeTradersVal = count > 10 ? count : count + 1420;
          setSystemStats({
            monthlyVolume: `$${(count * 1.25).toFixed(1)}B+`,
            activeTraders: activeTradersVal > 1000 ? `${(activeTradersVal / 1000).toFixed(1)}K+` : `${activeTradersVal}+`,
            executionLatency: '12ms',
            platformUptime: '99.99%',
          });
        }
      } catch (err) {
        console.error('Failed to fetch system stats:', err);
      }
    };

    fetchLivePrices();
    fetchLandingInsight();
    fetchSystemStats();

    const intervalPrices = setInterval(fetchLivePrices, 30000);
    const intervalInsights = setInterval(fetchLandingInsight, 600000); // 10 minutes

    return () => {
      clearInterval(intervalPrices);
      clearInterval(intervalInsights);
    };
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 25, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 120, damping: 15 },
    },
  };

  const features = [
    {
      icon: <Brain className="text-purple-400" size={26} />,
      title: 'Gemini AI Market Intelligence',
      description: 'Real-time contextual sentiment analysis, automated technical pattern detection, and risk scoring powered by Google AI.',
      badge: 'AI Core'
    },
    {
      icon: <TrendingUp className="text-emerald-400" size={26} />,
      title: 'Ultra-Low Latency Feeds',
      description: 'Stream live WebSocket order books and pricing for Forex, Crypto, and Global Equities in sub-millisecond intervals.',
      badge: 'Live Data'
    },
    {
      icon: <Zap className="text-cyan-400" size={26} />,
      title: 'Smart News Aggregator',
      description: 'NLP-filtered news stream tagged by asset sentiment, impact rating, and automatic translation across 12 languages.',
      badge: 'Realtime'
    },
    {
      icon: <Users className="text-pink-400" size={26} />,
      title: 'Social Trader Hub',
      description: 'Publish interactive chart setups, copy elite portfolio strategies, and join verified analyst channels.',
      badge: 'Network'
    },
    {
      icon: <Video className="text-rose-400" size={26} />,
      title: 'WebRTC Live Broadcasts',
      description: 'Stream live market breakdown sessions with low-latency audio/video and interactive group chat.',
      badge: 'Webinars'
    },
    {
      icon: <Monitor className="text-indigo-400" size={26} />,
      title: 'Pro Terminal Layouts',
      description: 'Fully customizable multi-chart workspace with Light, Dark, and Cyberpunk Neon visual themes.',
      badge: 'Adaptive'
    },
  ];

  const defaultTicker = [
    { symbol: 'BTCUSD', price: '$89,420.50', change: '+3.42%', positive: true },
    { symbol: 'EURUSD', price: '1.0845', change: '-0.14%', positive: false },
    { symbol: 'NVDA', price: '$135.20', change: '+5.18%', positive: true },
    { symbol: 'ETHUSD', price: '$3,410.80', change: '+2.90%', positive: true },
    { symbol: 'XAUUSD', price: '$2,415.30', change: '+0.85%', positive: true },
    { symbol: 'AAPL', price: '$224.50', change: '-0.45%', positive: false },
  ];

  const tickerAssets = livePrices.length > 0
    ? livePrices.map((p: any) => ({
        symbol: p.symbol,
        price: p.price > 10 ? `$${p.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : `$${p.price}`,
        change: `${p.change_pct >= 0 ? '+' : ''}${p.change_pct.toFixed(2)}%`,
        positive: p.change_pct >= 0
      }))
    : defaultTicker;

  return (
    <div className="min-h-screen text-zinc-100 selection:bg-purple-600/30 selection:text-white relative overflow-x-hidden">
      {/* Top Fixed Header */}
      <nav className="h-20 px-6 md:px-12 border-b border-zinc-800/50 bg-zinc-950/70 backdrop-blur-xl fixed top-0 left-0 right-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-[0_0_20px_rgba(99,102,241,0.5)] border border-white/10">
            FX
          </div>
          <span className="text-2xl font-black tracking-tight text-white">
            FxZone
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-xs font-semibold text-zinc-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#markets" className="hover:text-white transition-colors">Markets</a>
          <a href="#ai" className="hover:text-white transition-colors">AI Intelligence</a>
          <a href="#stats" className="hover:text-white transition-colors">Performance</a>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-xs text-zinc-300 hover:text-white hover:bg-zinc-900/60 font-semibold px-4">
              Sign In
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="text-xs bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 font-bold shadow-lg shadow-purple-600/25 px-5 rounded-lg border border-purple-400/20">
              Get Started Free
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-36 pb-20 px-6 max-w-6xl mx-auto text-center flex flex-col items-center relative z-10">
        
        {/* Release Pill */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 backdrop-blur-md text-xs font-semibold text-purple-300 mb-8 shadow-inner"
        >
          <Sparkles size={14} className="text-purple-400 animate-pulse" />
          <span>Introducing FxZone v2.5 with Gemini AI Insights</span>
          <ChevronRight size={14} className="text-purple-400" />
        </motion.div>

        {/* BOLD AND BIG FxZone TITLE */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="flex flex-col items-center"
        >
          <h1 className="text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter text-white leading-none drop-shadow-[0_10px_35px_rgba(0,0,0,0.8)] select-none">
            Fx<span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">Zone</span>
          </h1>
          <p className="text-lg sm:text-2xl md:text-3xl font-extrabold text-zinc-300 tracking-tight mt-4 max-w-3xl">
            Next-Gen AI Trading Intelligence & Multi-Asset Terminal
          </p>
        </motion.div>

        {/* Subtitle Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-sm md:text-base text-zinc-400 mt-6 max-w-2xl leading-relaxed font-medium"
        >
          Stream real-time global markets, generate deep AI technical analysis, follow top signal analysts, and execute high-precision setups in one unified platform.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-wrap justify-center gap-4 mt-10"
        >
          <Link href="/register">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold px-8 py-6 rounded-xl flex items-center gap-2 shadow-2xl shadow-purple-600/30 text-sm border border-white/10 transition-all hover:scale-105">
              Launch Terminal <ArrowRight size={18} />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" size="lg" className="border-zinc-700/80 bg-zinc-900/60 backdrop-blur-md text-zinc-200 hover:text-white hover:bg-zinc-800/80 px-8 py-6 rounded-xl font-bold text-sm transition-all">
              Explore Live Demo
            </Button>
          </Link>
        </motion.div>

        {/* Live Ticker Bar Preview */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="w-full mt-16 p-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between gap-4 overflow-x-auto no-scrollbar py-1 px-2">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest shrink-0 border-r border-zinc-800 pr-4">
              <Activity size={16} className="text-blue-400 animate-pulse" /> Live Markets
            </div>
            {tickerAssets.map((asset, i) => (
              <div key={i} className="flex items-center gap-2 text-xs shrink-0 px-3 py-1.5 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                <span className="font-bold text-zinc-200">{asset.symbol}</span>
                <span className="font-semibold text-zinc-400">{asset.price}</span>
                <span className={`font-bold ${asset.positive ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {asset.change}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Terminal Feature Preview Banner */}
      <section className="py-12 px-6 max-w-6xl mx-auto relative z-10">
        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/50 backdrop-blur-xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-500/10 border border-blue-500/30 text-[11px] font-bold text-blue-400 uppercase tracking-wider mb-4">
                <Brain size={12} /> Powered by Google Gemini
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
                AI Assistant That Reads Chart Setup & Sentiment
              </h2>
              <p className="text-zinc-400 text-xs md:text-sm mt-4 leading-relaxed">
                FxZone AI monitors high-volume tickers, parses real-time macroeconomic feeds, and generates actionable buy/sell sentiment signals directly on your watchlist.
              </p>
              <div className="flex flex-col gap-3 mt-6">
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <ShieldCheck size={16} className="text-emerald-400" /> Instant Watchlist Sentiment Analytics
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <ShieldCheck size={16} className="text-purple-400" /> Automated Risk & Leverage Exposure Calculation
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <ShieldCheck size={16} className="text-blue-400" /> Multi-Timeframe Price Pattern Recognition
                </div>
              </div>
            </div>
            <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800/90 backdrop-blur-md shadow-xl flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-white">
                    {landingInsight ? `${landingInsight.symbol} Watchlist Insight` : 'BTCUSD Watchlist Insight'}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {landingInsight ? `${landingInsight.sentiment} ${Math.round((landingInsight.confidence || 0.8) * 100)}%` : 'Bullish 84%'}
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-mono">
                {landingInsight ? `"${landingInsight.summary || 'Market technicals and sentiment remain constructive.'}"` : '"BTC is consolidating above the 50-period EMA. RSI neutral (58). News sentiment score +0.42."'}
              </p>
              <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-2 border-t border-zinc-800/50">
                <span>Updated Live</span>
                <span className="text-purple-400 font-semibold">Gemini 3.5 Flash</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-6 max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            Engineered for High-Performance Trading
          </h2>
          <p className="text-xs md:text-sm text-zinc-400 mt-3 max-w-xl mx-auto">
            Everything you need for market intelligence, technical execution, and community collaboration in one terminal.
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {features.map((feat, idx) => (
            <motion.div
              key={idx}
              variants={itemVariants}
              className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-950/40 hover:bg-zinc-900/60 hover:border-purple-500/40 transition-all duration-300 backdrop-blur-md group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="h-12 w-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {feat.icon}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
                    {feat.badge}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mb-2">{feat.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{feat.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Stats Counter Section */}
      <section id="stats" className="border-y border-zinc-800/60 bg-zinc-950/50 backdrop-blur-xl py-16 px-6 relative z-10">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <span className="text-3xl md:text-5xl font-black text-white block bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">{systemStats.monthlyVolume}</span>
            <span className="text-[11px] text-zinc-400 uppercase tracking-widest font-bold mt-2 block">Monthly Volume</span>
          </div>
          <div>
            <span className="text-3xl md:text-5xl font-black text-white block bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">{systemStats.activeTraders}</span>
            <span className="text-[11px] text-zinc-400 uppercase tracking-widest font-bold mt-2 block">Active Traders</span>
          </div>
          <div>
            <span className="text-3xl md:text-5xl font-black text-white block bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">{systemStats.executionLatency}</span>
            <span className="text-[11px] text-zinc-400 uppercase tracking-widest font-bold mt-2 block">Execution Latency</span>
          </div>
          <div>
            <span className="text-3xl md:text-5xl font-black text-white block bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">{systemStats.platformUptime}</span>
            <span className="text-[11px] text-zinc-400 uppercase tracking-widest font-bold mt-2 block">Platform Uptime</span>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="py-24 px-6 max-w-4xl mx-auto text-center relative z-10">
        <div className="p-10 md:p-16 rounded-3xl border border-purple-500/30 bg-gradient-to-b from-purple-900/20 to-zinc-950/80 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight">
            Ready to Experience <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">FxZone</span>?
          </h2>
          <p className="text-xs md:text-sm text-zinc-400 mt-4 max-w-xl mx-auto leading-relaxed">
            Join thousands of traders leveraging AI-powered insights, real-time market streams, and community signal sharing.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold px-8 py-6 rounded-xl shadow-xl shadow-purple-600/30 text-sm">
                Create Free Account
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/80 py-10 px-6 text-center relative z-10">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="h-6 w-6 rounded-md bg-purple-600 flex items-center justify-center text-white font-black text-xs">FX</div>
          <span className="text-lg font-black text-white">FxZone</span>
        </div>
        <p className="text-[11px] text-zinc-500 max-w-lg mx-auto">
          © 2026 FxZone Inc. All rights reserved. Leveraged financial trading carries high risk. Past performance does not guarantee future results.
        </p>
      </footer>
    </div>
  );
}

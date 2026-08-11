'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

export default function RiskDisclosurePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-12 max-w-4xl mx-auto font-sans">
      <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-purple-400 hover:text-purple-300 mb-8 transition-colors">
        <ArrowLeft size={14} /> Back to FxZone
      </Link>

      <div className="flex items-center gap-3 mb-6 border-b border-zinc-800 pb-4">
        <AlertTriangle size={28} className="text-amber-400" />
        <h1 className="text-3xl font-black text-white">Risk & Financial Disclosure</h1>
      </div>

      <div className="space-y-6 text-sm text-zinc-300 leading-relaxed font-normal">
        <p className="text-xs text-zinc-400">Last updated: August 2026</p>

        <section className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2">
          <p className="font-bold uppercase tracking-wider">High Risk Investment Warning:</p>
          <p>Trading foreign exchange (Forex), cryptocurrencies, equities, and financial derivatives carries a high level of risk and may not be suitable for all investors. The high degree of leverage can work against you as well as for you.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">1. AI Analysis & Signals Disclaimer</h2>
          <p>AI-generated market sentiment indicators, technical setups, and rating metrics produced by FxZone are derived automatically via machine learning algorithms. They represent probability models rather than guaranteed financial advice or trade recommendations.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">2. No Guarantee of Performance</h2>
          <p>Past performance metrics, historical chart patterns, and simulated demo results do not guarantee future returns. You should never risk capital that you cannot afford to lose.</p>
        </section>
      </div>
    </div>
  );
}

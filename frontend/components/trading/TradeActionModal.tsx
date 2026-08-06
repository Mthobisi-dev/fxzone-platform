'use client';

import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TrendingUp, ExternalLink, ShieldCheck, Zap, BarChart2 } from 'lucide-react';

interface TradeActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol?: string;
}

export function TradeActionModal({ isOpen, onClose, symbol = 'EURUSD' }: TradeActionModalProps) {
  const tradingViewUrl = symbol 
    ? `https://www.tradingview.com/chart/?symbol=${symbol.includes('USD') && !symbol.startsWith('BTC') && !symbol.startsWith('ETH') ? 'FX:' + symbol : symbol}`
    : 'https://www.tradingview.com';

  const exnessUrl = 'https://one.exnesstrack.net';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Execute Trade & Analysis - ${symbol}`}>
      <div className="py-3 flex flex-col gap-4 text-zinc-200">
        <p className="text-xs text-zinc-400 leading-relaxed">
          Select your preferred trading execution venue or technical analysis terminal for <span className="font-bold text-white">{symbol}</span>:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Exness Direct Trade */}
          <a
            href={exnessUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 hover:border-emerald-400 transition-all flex flex-col justify-between group shadow-lg"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                  <Zap size={18} />
                </div>
                <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
                  Live Broker
                </span>
              </div>
              <h4 className="text-sm font-black text-white flex items-center gap-1.5 group-hover:text-emerald-300">
                Trade on Exness <ExternalLink size={14} />
              </h4>
              <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                Execute live Forex, Crypto & Commodities orders with ultra-low spreads on Exness.
              </p>
            </div>
            <div className="mt-4 pt-2 border-t border-emerald-500/20 flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
              <ShieldCheck size={12} /> Institutional Liquidity & Instant Execution
            </div>
          </a>

          {/* TradingView Charting */}
          <a
            href={tradingViewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 hover:border-blue-400 transition-all flex flex-col justify-between group shadow-lg"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
                  <BarChart2 size={18} />
                </div>
                <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/30">
                  Chart Engine
                </span>
              </div>
              <h4 className="text-sm font-black text-white flex items-center gap-1.5 group-hover:text-blue-300">
                Analyze on TradingView <ExternalLink size={14} />
              </h4>
              <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                Access advanced multi-timeframe charts, technical indicators, and pine script indicators.
              </p>
            </div>
            <div className="mt-4 pt-2 border-t border-blue-500/20 flex items-center gap-1 text-[10px] text-blue-400 font-semibold">
              <TrendingUp size={12} /> Global Market Data & Indicators
            </div>
          </a>
        </div>

        {/* FxZone Internal Terminal Option */}
        <div className="p-3.5 rounded-xl border border-purple-500/30 bg-zinc-900/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-400 font-bold">
              FX
            </div>
            <div>
              <span className="text-xs font-bold text-white block">FxZone AI Terminal</span>
              <span className="text-[10px] text-zinc-400">Integrated AI analysis & order book terminal</span>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              onClose();
              window.location.href = '/dashboard';
            }}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-xs font-semibold px-4 shadow-md"
          >
            Launch Terminal
          </Button>
        </div>
      </div>
    </Modal>
  );
}

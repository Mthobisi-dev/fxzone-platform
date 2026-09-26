'use client';

import React from 'react';
import { Check, Sparkles, Building2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BrokerOption {
  id: string;
  name: string;
  badge?: string;
  isFeatured?: boolean;
  accentColor: string;
  tagline: string;
  website: string;
}

export const SUPPORTED_BROKERS: BrokerOption[] = [
  {
    id: 'exness',
    name: 'Exness',
    badge: '⭐ Featured Broker',
    isFeatured: true,
    accentColor: 'from-amber-500 via-yellow-400 to-amber-600',
    tagline: 'Ultra-low spreads, instant withdrawals & zero commissions on ECN accounts.',
    website: 'https://www.exness.com/',
  },
  {
    id: 'ic_markets',
    name: 'IC Markets',
    badge: 'Raw ECN',
    accentColor: 'from-emerald-500 to-teal-400',
    tagline: 'True ECN liquidity provider with raw spread trading execution.',
    website: 'https://www.icmarkets.com/',
  },
  {
    id: 'pepperstone',
    name: 'Pepperstone',
    badge: 'cTrader / MT5',
    accentColor: 'from-blue-500 to-cyan-400',
    tagline: 'Award-winning execution speed across MT4, MT5, and cTrader.',
    website: 'https://pepperstone.com/',
  },
  {
    id: 'xm',
    name: 'XM Group',
    badge: 'Zero Requotes',
    accentColor: 'from-rose-500 to-red-400',
    tagline: 'Strict zero requotes & zero rejection policy with micro account leverage.',
    website: 'https://www.xm.com/',
  },
  {
    id: 'deriv',
    name: 'Deriv',
    badge: 'Synthetic Indices',
    accentColor: 'from-orange-500 to-amber-400',
    tagline: '24/7 trading on synthetic volatility indices, forex & multipliers.',
    website: 'https://deriv.com/',
  },
  {
    id: 'fxtm',
    name: 'FXTM (ForexTime)',
    badge: 'Copy Trading',
    accentColor: 'from-purple-500 to-indigo-400',
    tagline: 'Regulated global forex broker with integrated copy trading accounts.',
    website: 'https://www.fxtm.com/',
  },
  {
    id: 'interactive_brokers',
    name: 'Interactive Brokers',
    badge: 'Institutional',
    accentColor: 'from-sky-500 to-blue-600',
    tagline: 'Direct market access to stocks, options, futures & forex worldwide.',
    website: 'https://www.interactivebrokers.com/',
  },
  {
    id: 'oanda',
    name: 'OANDA',
    badge: 'API & Forex',
    accentColor: 'from-teal-500 to-emerald-400',
    tagline: 'Multi-asset broker with premium charting & developer REST APIs.',
    website: 'https://www.oanda.com/',
  },
];

interface BrokerSelectorProps {
  selectedBroker: string;
  onSelectBroker: (brokerName: string) => void;
}

export function BrokerSelector({ selectedBroker, onSelectBroker }: BrokerSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
          <Building2 size={14} className="text-amber-400" /> Preferred Trading Broker
        </label>
        <span className="text-[10px] text-zinc-400 font-medium">Select your primary brokerage partner</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1 no-scrollbar">
        {SUPPORTED_BROKERS.map((broker) => {
          const isSelected =
            selectedBroker.toLowerCase() === broker.name.toLowerCase() ||
            (broker.id === 'exness' && !selectedBroker);

          return (
            <div
              key={broker.id}
              onClick={() => onSelectBroker(broker.name)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectBroker(broker.name);
                }
              }}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              className={cn(
                'relative p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group select-none',
                isSelected
                  ? 'border-amber-500/80 bg-amber-500/10 shadow-lg shadow-amber-500/10'
                  : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-850'
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'h-6 w-6 rounded-lg bg-gradient-to-br flex items-center justify-center font-black text-[10px] text-white shadow',
                      broker.accentColor
                    )}
                  >
                    {broker.name.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                    {broker.name}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {broker.isFeatured && (
                    <span className="text-[9px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Sparkles size={10} /> Exness Choice
                    </span>
                  )}
                  {isSelected && (
                    <div className="h-4 w-4 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center">
                      <Check size={11} strokeWidth={3} />
                    </div>
                  )}
                </div>
              </div>

              <p className="text-[10px] text-zinc-400 leading-tight font-medium">
                {broker.tagline}
              </p>
              <a
                href={broker.website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="mt-2 inline-flex w-fit items-center gap-1 text-[10px] font-semibold text-amber-300 hover:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded"
                aria-label={`Visit ${broker.name}`}
              >
                Visit broker <ExternalLink size={11} aria-hidden="true" />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

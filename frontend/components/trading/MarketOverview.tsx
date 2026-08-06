'use client';

import React, { useState } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { formatPrice, formatPercentage } from '@/lib/utils';
import { Card } from '../ui/Card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

import { TradeActionModal } from './TradeActionModal';
import { ExternalLink } from 'lucide-react';

export function MarketOverview() {
  const { assets, prices, setSelectedAsset } = useMarketStore();
  const [filter, setFilter] = useState<'all' | 'forex' | 'stock' | 'crypto'>('all');
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeSymbol, setTradeSymbol] = useState('EURUSD');

  const filteredAssets = assets.filter((asset) => {
    if (filter === 'all') return true;
    return asset.asset_type === filter;
  });

  return (
    <>
      <TradeActionModal
        isOpen={tradeModalOpen}
        onClose={() => setTradeModalOpen(false)}
        symbol={tradeSymbol}
      />
      <Card className="p-4 bg-zinc-950/40 border-zinc-900/60 flex flex-col gap-4 select-none">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Market Overview Heatmap</h3>
          <div className="flex gap-1 bg-zinc-900/30 border border-zinc-850 p-0.5 rounded-lg">
            {(['all', 'forex', 'stock', 'crypto'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={cn(
                  'px-2.5 py-1 text-[9px] font-bold rounded capitalize transition-all focus:outline-none',
                  filter === tab ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-350'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {filteredAssets.slice(0, 12).map((asset) => {
            const priceData = prices[asset.symbol.toUpperCase()];
            const price = priceData ? priceData.price : null;
            const changePct = priceData ? priceData.change_pct : 0;
            const isUp = changePct >= 0;

            return (
              <div
                key={asset.id}
                onClick={() => {
                  setSelectedAsset(asset);
                  setTradeSymbol(asset.symbol);
                  setTradeModalOpen(true);
                }}
                className={cn(
                  'p-3 border rounded-xl cursor-pointer transition-all duration-200 flex flex-col justify-between h-20 relative overflow-hidden group',
                  isUp 
                    ? 'bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/30' 
                    : 'bg-rose-500/5 border-rose-500/10 hover:border-rose-500/30'
                )}
                title="Click to trade on Exness or analyze on TradingView"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white block uppercase leading-none mb-1 group-hover:text-purple-300">
                      {asset.symbol}
                    </span>
                    <ExternalLink size={10} className="text-zinc-600 group-hover:text-purple-400" />
                  </div>
                  <span className="text-[8px] text-zinc-550 truncate block max-w-full leading-none">
                    {asset.name}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-auto">
                  <span className="text-[10px] font-semibold text-zinc-200">
                    {price !== null ? formatPrice(price, asset.symbol) : '---'}
                  </span>
                  
                  <span className={cn('text-[9px] font-bold flex items-center gap-0.5', isUp ? 'text-emerald-400' : 'text-red-400')}>
                    {isUp ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
                    {formatPercentage(changePct)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

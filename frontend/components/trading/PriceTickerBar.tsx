'use client';

import React from 'react';
import { useMarketData } from '@/hooks/useMarketData';
import { formatPrice, formatPercentage } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PriceTickerBar() {
  // Major forex, stocks, crypto symbols to show in the scrolling ticker
  const symbols = [
    'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD',
    'AAPL', 'MSFT', 'TSLA', 'AMZN', 'NVDA',
    'BTCUSD', 'ETHUSD', 'SOLUSD', 'DOGEUSD'
  ];

  const { prices } = useMarketData(symbols);

  // Repeat items to ensure smooth infinite loop scroll
  const tickerItems = symbols.map(sym => {
    const data = prices[sym.toUpperCase()];
    return {
      symbol: sym,
      price: data ? data.price : null,
      changePct: data ? data.change_pct : 0,
      isUp: data ? data.change_pct >= 0 : true
    };
  });

  const doubledItems = [...tickerItems, ...tickerItems, ...tickerItems];

  return (
    <div className="h-7 bg-zinc-950 border-b border-zinc-900/60 overflow-hidden flex items-center select-none z-40 relative">
      <div className="animate-ticker-scroll flex items-center gap-8 py-1 whitespace-nowrap">
        {doubledItems.map((item, index) => {
          const formattedPrice = item.price !== null ? formatPrice(item.price, item.symbol) : '---';
          const formattedChange = formatPercentage(item.changePct);

          return (
            <div key={index} className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-wide cursor-pointer hover:bg-white/5 px-2 py-0.5 rounded transition-all">
              <span className="text-zinc-400 uppercase">{item.symbol}</span>
              <span className="text-zinc-200">{formattedPrice}</span>
              <span
                className={cn(
                  'flex items-center',
                  item.isUp ? 'text-emerald-400' : 'text-red-400'
                )}
              >
                {item.isUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                {formattedChange}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

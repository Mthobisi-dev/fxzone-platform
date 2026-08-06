'use client';

import React, { useState, useEffect } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { formatPrice } from '@/lib/utils';
import { Card } from '../ui/Card';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface OrderBookRow {
  price: number;
  size: number;
  total: number;
}

export function OrderBook() {
  const { selectedAsset, prices } = useMarketStore();
  const [bids, setBids] = useState<OrderBookRow[]>([]);
  const [asks, setAsks] = useState<OrderBookRow[]>([]);
  
  const currentPriceData = selectedAsset ? prices[selectedAsset.symbol.toUpperCase()] : null;
  const currentPrice = currentPriceData ? currentPriceData.price : null;

  useEffect(() => {
    if (!currentPrice) return;

    // Generate simulated order book around current price
    const spread = currentPrice * 0.0005; // 0.05% spread
    const startAsk = currentPrice + spread / 2;
    const startBid = currentPrice - spread / 2;

    const generateSide = (start: number, direction: 1 | -1): OrderBookRow[] => {
      let accumTotal = 0;
      return Array.from({ length: 6 }).map((_, idx) => {
        // Price shifts slightly outward
        const price = start + (direction * idx * currentPrice * 0.0002);
        const size = Math.random() * (selectedAsset?.asset_type === 'crypto' ? 2.5 : 10000) + 0.1;
        accumTotal += size;
        return { price, size, total: accumTotal };
      });
    };

    setAsks(generateSide(startAsk, 1).reverse()); // Highest ask at top
    setBids(generateSide(startBid, -1)); // Highest bid at top
  }, [currentPrice, selectedAsset]);

  if (!selectedAsset || !currentPrice) {
    return (
      <Card className="p-4 bg-zinc-950/40 border-zinc-900/60 flex items-center justify-center h-full text-zinc-550 text-[10px] italic">
        Waiting for asset feeds...
      </Card>
    );
  }

  const maxTotal = Math.max(
    bids[bids.length - 1]?.total || 1,
    asks[0]?.total || 1
  );

  const spreadAmount = asks[asks.length - 1]?.price - bids[0]?.price || 0;
  const spreadPct = (spreadAmount / currentPrice) * 100;

  return (
    <Card className="p-4 bg-zinc-950/40 border-zinc-900/60 flex flex-col justify-between h-full font-mono text-[10px] select-none">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-900/60 mb-2">
        <h4 className="text-xs font-bold text-white tracking-wider font-sans">ORDER FLOWS</h4>
        <span className="text-[8px] bg-zinc-900 border border-zinc-850 px-1 py-0.5 rounded text-zinc-400 font-sans uppercase">
          {selectedAsset.symbol}
        </span>
      </div>

      {/* Grid Headers */}
      <div className="grid grid-cols-3 text-zinc-500 font-bold mb-1.5 text-right">
        <span className="text-left">Price</span>
        <span>Size</span>
        <span>Total</span>
      </div>

      {/* Asks (Sells, red) */}
      <div className="flex-1 flex flex-col justify-end gap-1 mb-1">
        {asks.map((ask, idx) => (
          <div key={idx} className="grid grid-cols-3 text-right relative py-0.5">
            {/* Depth bar visualization */}
            <div
              className="absolute right-0 top-0 bottom-0 bg-red-500/5 -z-10 transition-all duration-300"
              style={{ width: `${(ask.total / maxTotal) * 100}%` }}
            />
            <span className="text-left text-red-400 font-semibold">{formatPrice(ask.price, selectedAsset.symbol)}</span>
            <span className="text-zinc-300">{ask.size.toFixed(selectedAsset.asset_type === 'crypto' ? 3 : 1)}</span>
            <span className="text-zinc-400">{ask.total.toFixed(selectedAsset.asset_type === 'crypto' ? 2 : 0)}</span>
          </div>
        ))}
      </div>

      {/* Spread Bar */}
      <div className="bg-zinc-900/40 border-y border-zinc-850/60 py-2 my-2 flex items-center justify-between px-2">
        <div className="flex items-center gap-1">
          {(currentPriceData?.change_pct ?? 0) >= 0 ? (
            <ArrowUp size={12} className="text-emerald-500 animate-pulse" />
          ) : (
            <ArrowDown size={12} className="text-rose-500 animate-pulse" />
          )}
          <span className="text-xs font-bold text-white">
            {formatPrice(currentPrice, selectedAsset.symbol)}
          </span>
        </div>
        <div className="text-right text-[8px] text-zinc-500 font-sans">
          <span>Spread: {spreadAmount.toFixed(selectedAsset.asset_type === 'forex' ? 5 : 2)} ({spreadPct.toFixed(3)}%)</span>
        </div>
      </div>

      {/* Bids (Buys, green) */}
      <div className="flex-1 flex flex-col gap-1 mt-1">
        {bids.map((bid, idx) => (
          <div key={idx} className="grid grid-cols-3 text-right relative py-0.5">
            {/* Depth bar visualization */}
            <div
              className="absolute right-0 top-0 bottom-0 bg-emerald-500/5 -z-10 transition-all duration-300"
              style={{ width: `${(bid.total / maxTotal) * 100}%` }}
            />
            <span className="text-left text-emerald-400 font-semibold">{formatPrice(bid.price, selectedAsset.symbol)}</span>
            <span className="text-zinc-300">{bid.size.toFixed(selectedAsset.asset_type === 'crypto' ? 3 : 1)}</span>
            <span className="text-zinc-400">{bid.total.toFixed(selectedAsset.asset_type === 'crypto' ? 2 : 0)}</span>
          </div>
        ))}
      </div>

      {/* Quick Execution Action Bar — Exness Only */}
      <div className="mt-3 pt-2 border-t border-zinc-900 grid grid-cols-2 gap-2 font-sans">
        <a
          href="https://one.exnesstrack.net"
          target="_blank"
          rel="noopener noreferrer"
          className="py-2 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-center text-[11px] transition-all shadow-md flex items-center justify-center gap-1.5 select-none"
        >
          ▲ BUY {selectedAsset.symbol}
        </a>
        <a
          href="https://one.exnesstrack.net"
          target="_blank"
          rel="noopener noreferrer"
          className="py-2 px-2 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-black text-center text-[11px] transition-all shadow-md flex items-center justify-center gap-1.5 select-none"
        >
          ▼ SELL {selectedAsset.symbol}
        </a>
        <p className="col-span-2 text-center text-[9px] text-zinc-500 mt-0.5">
          Executing via <span className="text-emerald-400 font-semibold">Exness</span> — Institutional liquidity, instant fill
        </p>
      </div>
    </Card>
  );
}

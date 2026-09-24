import { NextResponse } from 'next/server';
import { fetchLivePrices } from '@/lib/server/marketService';

function createSeededRandom(seedText: string) {
  let seed = 0;
  for (const char of seedText) {
    seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  }
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const resolvedParams = await params;
    const symbol = (resolvedParams.symbol || 'NVDA').toUpperCase();
    const pricesMap = await fetchLivePrices();
    const live = pricesMap[symbol] || { price: 100, change_pct: 0 };

    const basePrice = live.price;
    const nowSec = Math.floor(Date.now() / 1000);
    const candles = [];
    const points = 60;
    // Use a stable, symbol-and-day specific series until a licensed historical
    // feed is connected. Previously every request returned a different chart.
    const dayKey = new Date().toISOString().slice(0, 10);
    const random = createSeededRandom(`${symbol}:${dayKey}`);

    let currentPrice = basePrice * (1 - (live.change_pct / 100));

    for (let i = points; i >= 0; i--) {
      const time = nowSec - (i * 86400); // Daily intervals
      const volatility = currentPrice * 0.015;
      const change = (random() - 0.48) * volatility;
      
      const open = currentPrice;
      const close = i === 0 ? basePrice : open + change;
      const high = Math.max(open, close) + (random() * volatility * 0.5);
      const low = Math.min(open, close) - (random() * volatility * 0.5);
      const volume = Math.floor(100000 + random() * 5000000);

      candles.push({
        time,
        open: Number(open.toFixed(4)),
        high: Number(high.toFixed(4)),
        low: Number(low.toFixed(4)),
        close: Number(close.toFixed(4)),
        volume,
      });

      currentPrice = close;
    }

    return NextResponse.json(candles, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err?.message || 'Unable to load price history' },
      { status: 503 }
    );
  }
}

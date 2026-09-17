import { NextResponse } from 'next/server';
import { SUPPORTED_ASSETS } from '@/lib/server/marketService';

// In-memory serverless session store fallback for demo watchlists
let defaultWatchlist = {
  id: 'watchlist-default',
  name: 'My Watchlist',
  items: [
    SUPPORTED_ASSETS.find((a) => a.symbol === 'NVDA') || SUPPORTED_ASSETS[0],
    SUPPORTED_ASSETS.find((a) => a.symbol === 'BTCUSD') || SUPPORTED_ASSETS[1],
    SUPPORTED_ASSETS.find((a) => a.symbol === 'EURUSD') || SUPPORTED_ASSETS[2],
  ],
};

export async function GET() {
  return NextResponse.json([defaultWatchlist]);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Adding an item to watchlist
    if (body.asset_id) {
      const asset = SUPPORTED_ASSETS.find((a) => a.id === body.asset_id || a.symbol === body.asset_id);
      if (asset && !defaultWatchlist.items.some((i) => i.id === asset.id)) {
        defaultWatchlist.items.push(asset);
      }
      return NextResponse.json(defaultWatchlist);
    }

    // Creating a new watchlist
    if (body.name) {
      defaultWatchlist.name = body.name;
      return NextResponse.json(defaultWatchlist);
    }

    return NextResponse.json(defaultWatchlist);
  } catch {
    return NextResponse.json(defaultWatchlist);
  }
}

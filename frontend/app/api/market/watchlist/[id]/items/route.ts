import { NextResponse } from 'next/server';
import { SUPPORTED_ASSETS } from '@/lib/server/marketService';

// Memory store for session watchlists
let memoryWatchlistItems: any[] = [
  SUPPORTED_ASSETS.find((a) => a.symbol === 'NVDA') || SUPPORTED_ASSETS[0],
  SUPPORTED_ASSETS.find((a) => a.symbol === 'BTCUSD') || SUPPORTED_ASSETS[1],
  SUPPORTED_ASSETS.find((a) => a.symbol === 'EURUSD') || SUPPORTED_ASSETS[2],
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const watchlistId = resolvedParams.id;
    const body = await request.json();
    const assetIdOrSymbol = body.asset_id || body.symbol;

    if (assetIdOrSymbol) {
      const asset = SUPPORTED_ASSETS.find(
        (a) =>
          a.id === assetIdOrSymbol ||
          a.symbol.toUpperCase() === String(assetIdOrSymbol).toUpperCase()
      ) || {
        id: String(assetIdOrSymbol).toLowerCase(),
        symbol: String(assetIdOrSymbol).toUpperCase(),
        name: String(assetIdOrSymbol).toUpperCase(),
        asset_type: 'stock',
        is_active: true,
      };

      if (!memoryWatchlistItems.some((i) => i.symbol.toUpperCase() === asset.symbol.toUpperCase())) {
        memoryWatchlistItems.push(asset);
      }
    }

    return NextResponse.json({
      id: watchlistId || 'watchlist-default',
      name: 'My Watchlist',
      items: memoryWatchlistItems,
    });
  } catch (err: any) {
    return NextResponse.json({
      id: 'watchlist-default',
      name: 'My Watchlist',
      items: memoryWatchlistItems,
    });
  }
}

import { NextResponse } from 'next/server';
import {
  fetchHistoricalCandles,
  fetchLivePrices,
  MarketDataUnavailableError,
  SUPPORTED_ASSETS,
} from '@/lib/server/marketService';
import { buildMarketInsight } from '@/lib/server/marketInsights';
import { calculateTechnicalAnalysis, type TechnicalAnalysis } from '@/lib/server/technicalAnalysis';
import { apiError } from '@/lib/api-error';

const FEATURED_SYMBOLS = ['NVDA', 'BTCUSD', 'EURUSD', 'XAUUSD'] as const;

async function buildFeaturedInsight(symbol: string, prices: Awaited<ReturnType<typeof fetchLivePrices>>) {
  const asset = SUPPORTED_ASSETS.find((item) => item.symbol === symbol);
  const quote = prices[symbol] ?? null;
  let technical: TechnicalAnalysis = { status: 'insufficient_data' };

  // A quote alone is insufficient evidence for an RSI, MACD, or
  // support/resistance claim. fetchHistoricalCandles only resolves with
  // provider-supplied OHLCV from Twelve Data or the delayed Yahoo fallback.
  if (quote) {
    try {
      technical = calculateTechnicalAnalysis(await fetchHistoricalCandles(symbol, '1d'));
    } catch (error) {
      if (!(error instanceof MarketDataUnavailableError)) {
        console.warn(`Historical analysis unavailable for ${symbol}:`, error);
      }
    }
  }

  return buildMarketInsight({
    symbol,
    name: asset?.name ?? symbol,
    quote,
    technical,
  });
}

/**
 * Source-aware market research cards. The endpoint retains its historical URL
 * for client compatibility but does not call a model or manufacture insights.
 */
export async function GET() {
  try {
    const prices = await fetchLivePrices();
    if (Object.keys(prices).length === 0) {
      return apiError('SERVICE_UNAVAILABLE', 'Verified market data is temporarily unavailable.', 503);
    }

    const insights = await Promise.all(FEATURED_SYMBOLS.map((symbol) => buildFeaturedInsight(symbol, prices)));
    return NextResponse.json({ insights }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('Market insight route error:', error);
    return apiError('SERVICE_UNAVAILABLE', 'Verified market data is temporarily unavailable.', 503);
  }
}

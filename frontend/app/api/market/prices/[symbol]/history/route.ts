import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { fetchHistoricalCandles, MarketDataUnavailableError } from '@/lib/server/marketService';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const timeframe = new URL(request.url).searchParams.get('timeframe') || '1h';
    const candles = await fetchHistoricalCandles(symbol, timeframe);
    return NextResponse.json(candles, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    if (!(error instanceof MarketDataUnavailableError)) {
      console.error('Market history route error:', error);
    }
    return apiError('SERVICE_UNAVAILABLE', 'Verified historical market data is temporarily unavailable.', 503);
  }
}
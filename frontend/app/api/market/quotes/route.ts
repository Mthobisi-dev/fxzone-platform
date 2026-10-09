import { NextResponse } from 'next/server';
import { fetchLivePrices } from '@/lib/server/marketService';
import { apiError } from '@/lib/api-error';

// GET /api/market/quotes — live price ticker feed alias
export async function GET() {
  try {
    const prices = await fetchLivePrices();
    if (Object.keys(prices).length === 0) {
      return apiError('SERVICE_UNAVAILABLE', 'Live market data is temporarily unavailable.', 503);
    }
    return NextResponse.json(prices, {
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10',
      },
    });
  } catch (error) {
    console.error('Market quotes error:', error);
    return apiError('SERVICE_UNAVAILABLE', 'Live market data is temporarily unavailable.', 503);
  }
}

import { NextResponse } from 'next/server';
import { fetchLivePrices } from '@/lib/server/marketService';

// GET /api/market/quotes — live price ticker feed alias
export async function GET() {
  try {
    const prices = await fetchLivePrices();
    return NextResponse.json(prices, {
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10',
      },
    });
  } catch (error: any) {
    console.error('Market quotes error:', error);
    return NextResponse.json({ error: 'Failed to fetch live prices' }, { status: 500 });
  }
}

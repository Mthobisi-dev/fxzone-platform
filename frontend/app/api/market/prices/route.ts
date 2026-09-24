import { NextResponse } from 'next/server';
import { fetchLivePrices } from '@/lib/server/marketService';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');

  try {
    const livePricesMap = await fetchLivePrices();

    if (symbolsParam) {
      const requestedSymbols = symbolsParam.split(',').map((s) => s.trim().toUpperCase());
      const filteredMap: Record<string, any> = {};
      requestedSymbols.forEach((sym) => {
        if (livePricesMap[sym]) {
          filteredMap[sym] = livePricesMap[sym];
        }
      });
      return NextResponse.json(filteredMap, {
        headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10' },
      });
    }

    // Default: return array of all price objects or dictionary
    const pricesArray = Object.values(livePricesMap);
    return NextResponse.json(pricesArray, {
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch market prices' }, { status: 500 });
  }
}

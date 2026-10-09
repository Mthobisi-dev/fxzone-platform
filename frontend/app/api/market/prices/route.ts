import { NextResponse } from 'next/server';
import { fetchLivePrices } from '@/lib/server/marketService';
import { apiError } from '@/lib/api-error';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');

  try {
    const livePricesMap = await fetchLivePrices();

    if (symbolsParam) {
      const requestedSymbols = symbolsParam.split(',').map((s) => s.trim().toUpperCase());
      const filteredMap: Record<string, unknown> = {};
      requestedSymbols.forEach((sym) => {
        if (livePricesMap[sym]) {
          filteredMap[sym] = livePricesMap[sym];
        }
      });
      if (Object.keys(filteredMap).length === 0) {
        return apiError('SERVICE_UNAVAILABLE', 'Live market data is temporarily unavailable for the requested instruments.', 503);
      }
      return NextResponse.json(filteredMap, {
        headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10' },
      });
    }

    // Default: return array of all price objects or dictionary
    const pricesArray = Object.values(livePricesMap);
    if (pricesArray.length === 0) {
      return apiError('SERVICE_UNAVAILABLE', 'Live market data is temporarily unavailable.', 503);
    }
    return NextResponse.json(pricesArray, {
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10',
      },
    });
  } catch (error) {
    console.error('Market price route error:', error);
    return apiError('SERVICE_UNAVAILABLE', 'Live market data is temporarily unavailable.', 503);
  }
}

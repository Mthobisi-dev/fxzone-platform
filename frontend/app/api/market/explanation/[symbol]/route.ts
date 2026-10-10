import { NextResponse } from 'next/server';
import {
  fetchHistoricalCandles,
  fetchLivePrices,
  MarketDataUnavailableError,
  SUPPORTED_ASSETS,
} from '@/lib/server/marketService';
import { buildMarketInsight } from '@/lib/server/marketInsights';
import { calculateTechnicalAnalysis, type TechnicalAnalysis } from '@/lib/server/technicalAnalysis';
import { buildSelectedAssetExplanation } from '@/lib/server/selectedAssetExplanation';
import { apiError } from '@/lib/api-error';
import { getUserFromRequest } from '@/lib/server/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { user, error: authError } = await getUserFromRequest(request);
  if (!user || authError) {
    return apiError('UNAUTHORIZED', 'Authentication required to generate an AI research explanation.', 401);
  }

  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol.trim().toUpperCase();
  const asset = SUPPORTED_ASSETS.find((item) => item.is_active && item.symbol === symbol);

  if (!asset) {
    return apiError('NOT_FOUND', 'This market instrument is not supported.', 404);
  }

  try {
    const prices = await fetchLivePrices();
    const quote = prices[symbol] ?? null;
    let technical: TechnicalAnalysis = { status: 'insufficient_data' };

    if (quote) {
      try {
        technical = calculateTechnicalAnalysis(await fetchHistoricalCandles(symbol, '1d'));
      } catch (error) {
        if (!(error instanceof MarketDataUnavailableError)) {
          console.warn(`Selected-asset historical analysis unavailable for ${symbol}:`, error);
        }
      }
    }

    const insight = buildMarketInsight({
      symbol,
      name: asset.name,
      quote,
      technical,
    });
    const explanation = await buildSelectedAssetExplanation(insight);

    return NextResponse.json(explanation, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error(`Selected-asset explanation route error for ${symbol}:`, error);
    return apiError('SERVICE_UNAVAILABLE', 'Verified market data is temporarily unavailable.', 503);
  }
}

import { NextResponse } from 'next/server';
import { fetchHistoricalCandles, fetchLivePrices, MarketDataUnavailableError, SUPPORTED_ASSETS } from '@/lib/server/marketService';
import { buildMarketInsight } from '@/lib/server/marketInsights';
import { calculateTechnicalAnalysis, type TechnicalAnalysis } from '@/lib/server/technicalAnalysis';
import { apiError } from '@/lib/api-error';

/** Compatibility endpoint backed only by verified quotes and calculated candles. */
export async function GET(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const symbol = (await params).symbol.toUpperCase();
    const asset = SUPPORTED_ASSETS.find((item) => item.symbol === symbol);
    if (!asset) return apiError('BAD_REQUEST', 'Unsupported market symbol.', 400);
    const prices = await fetchLivePrices();
    const quote = prices[symbol] || null;
    let technical: TechnicalAnalysis = { status: 'insufficient_data' };
    if (quote) {
      try {
        technical = calculateTechnicalAnalysis(await fetchHistoricalCandles(symbol, '1d'));
      } catch (error) {
        if (!(error instanceof MarketDataUnavailableError)) console.warn(`Historical analysis unavailable for ${symbol}:`, error);
      }
    }
    const insight = buildMarketInsight({
      symbol,
      name: asset.name,
      quote: quote ? {
        price: quote.price,
        change_pct: quote.change_pct,
        timestamp: quote.timestamp,
        data_source: quote.data_source,
        freshness: quote.freshness,
      } : null,
      technical,
    });
    const sentiment = insight.direction === 'up' ? 'bullish' : insight.direction === 'down' ? 'bearish' : insight.direction;
    const summary = [
      `### Verified market context: ${asset.name}`,
      '',
      insight.summary,
      ...(insight.highlights.length ? ['', 'Calculated indicators:', ...insight.highlights.map((item) => `- ${item}`)] : []),
      '',
      'No confidence score or trade setup is shown because those values require a validated model and verified inputs.',
    ].join('\n');
    return NextResponse.json({ symbol, sentiment, status: insight.status, summary, analysis: summary, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Sentiment route error:', error);
    return apiError('SERVICE_UNAVAILABLE', 'Verified market data is temporarily unavailable.', 503);
  }
}

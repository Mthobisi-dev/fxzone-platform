import { NextResponse } from 'next/server';
import { fetchHistoricalCandles, fetchLivePrices, SUPPORTED_ASSETS } from '@/lib/server/marketService';
import { calculateTechnicalAnalysis } from '@/lib/server/technicalAnalysis';
import type { TechnicalAnalysis } from '@/lib/server/technicalAnalysis';
import { buildMarketInsight } from '@/lib/server/marketInsights';

function detectSymbol(text: string): string | null {
  const lower = text.toLowerCase();
  const aliases: Record<string, string[]> = {
    BTCUSD: ['btc', 'bitcoin'], ETHUSD: ['eth', 'ethereum'], SOLUSD: ['sol', 'solana'],
    XRPUSD: ['xrp', 'ripple'], NVDA: ['nvda', 'nvidia'], AAPL: ['aapl', 'apple'],
    MSFT: ['msft', 'microsoft'], GOOGL: ['googl', 'google', 'alphabet'], AMZN: ['amzn', 'amazon'],
    TSLA: ['tsla', 'tesla'], EURUSD: ['eurusd', 'eur/usd', 'euro'], GBPUSD: ['gbpusd', 'gbp/usd', 'pound'],
    USDJPY: ['usdjpy', 'usd/jpy', 'yen'], XAUUSD: ['xauusd', 'gold', 'bullion'], XAGUSD: ['xagusd', 'silver'],
  };
  return Object.entries(aliases).find(([, values]) => values.some((value) => lower.includes(value)))?.[0] || null;
}

function formatQuote(symbol: string, quote: { price: number; change_pct: number; data_source: string; freshness: string }) {
  const sign = quote.change_pct > 0 ? '+' : '';
  return `**${symbol}** ${quote.price.toLocaleString(undefined, { maximumFractionDigits: 6 })} (${sign}${quote.change_pct.toFixed(2)}%) · ${quote.data_source} · ${quote.freshness}`;
}

async function explainSymbol(symbol: string, prices: Awaited<ReturnType<typeof fetchLivePrices>>) {
  const asset = SUPPORTED_ASSETS.find((item) => item.symbol === symbol);
  const quote = prices[symbol] || null;
  let technical: TechnicalAnalysis = { status: 'insufficient_data' };
  if (quote) {
    try {
      const candles = await fetchHistoricalCandles(symbol, '1d');
      technical = calculateTechnicalAnalysis(candles);
    } catch (error) {
      console.warn(`Historical analysis unavailable for ${symbol}:`, error);
    }
  }

  const insight = buildMarketInsight({
    symbol,
    name: asset?.name || symbol,
    quote: quote ? {
      price: quote.price,
      change_pct: quote.change_pct,
      timestamp: quote.timestamp,
      data_source: quote.data_source,
      freshness: quote.freshness,
    } : null,
    technical,
  });

  const lines = [`### Verified market explanation: ${insight.name}`, '', insight.summary];
  if (quote) lines.push('', `Quote: ${formatQuote(symbol, quote)}`);
  if (insight.highlights.length) lines.push('', 'Calculated indicators:', ...insight.highlights.map((item) => `- ${item}`));
  if (insight.status !== 'available') lines.push('', 'Historical candles are insufficient, so indicator values are withheld.');
  lines.push('', 'This is research context from provider data and deterministic calculations; it is not investment advice.');
  return lines.join('\n');
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const prompt = body && typeof body === 'object' && !Array.isArray(body)
      ? String((body as Record<string, unknown>).message || (body as Record<string, unknown>).prompt || 'market overview')
      : 'market overview';
    const prices = await fetchLivePrices();
    const detected = detectSymbol(prompt);

    if (detected) {
      const response = await explainSymbol(detected, prices);
      return NextResponse.json({ reply: response, message: response, timestamp: new Date().toISOString() });
    }

    const available = Object.values(prices).slice(0, 8);
    const response = available.length
      ? ['### Verified market overview', '', 'Current provider quotes:', ...available.map((quote) => `- ${formatQuote(quote.symbol, quote)}`), '', 'Ask for a specific symbol to receive calculated historical indicators.'].join('\n')
      : 'Verified provider quotes are currently unavailable. No synthetic prices are shown.';
    return NextResponse.json({ reply: response, message: response, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('AI market explanation error:', error);
    return NextResponse.json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Verified market data is temporarily unavailable.' } }, { status: 503 });
  }
}

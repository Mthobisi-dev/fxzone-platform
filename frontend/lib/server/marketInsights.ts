import type { TechnicalAnalysis } from './technicalAnalysis';

export interface InsightQuote {
  price: number;
  change_pct: number;
  timestamp: string;
  data_source: string;
  freshness: string;
}

export interface MarketInsightInput {
  symbol: string;
  name: string;
  quote: InsightQuote | null;
  technical: TechnicalAnalysis;
}

export interface MarketInsight {
  symbol: string;
  name: string;
  status: 'available' | 'insufficient_data' | 'unavailable';
  direction: 'up' | 'down' | 'flat' | 'unavailable';
  price: number | null;
  changePct: number | null;
  timestamp: string | null;
  dataSource: string | null;
  freshness: string | null;
  summary: string;
  highlights: string[];
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function priceDirection(changePct: number): MarketInsight['direction'] {
  if (changePct > 0) return 'up';
  if (changePct < 0) return 'down';
  return 'flat';
}

/**
 * Produces display copy solely from the quote and deterministic technical
 * calculations supplied by the caller. It intentionally has no confidence,
 * trade target, order-flow, on-chain, or macro claim fields.
 */
export function buildMarketInsight(input: MarketInsightInput): MarketInsight {
  if (!input.quote) {
    return {
      symbol: input.symbol,
      name: input.name,
      status: 'unavailable',
      direction: 'unavailable',
      price: null,
      changePct: null,
      timestamp: null,
      dataSource: null,
      freshness: null,
      summary: 'A verified market quote is currently unavailable for this instrument.',
      highlights: [],
    };
  }

  const direction = priceDirection(input.quote.change_pct);
  const changeText = `${input.quote.change_pct > 0 ? '+' : ''}${input.quote.change_pct.toFixed(2)}%`;
  const base = {
    symbol: input.symbol,
    name: input.name,
    direction,
    price: input.quote.price,
    changePct: input.quote.change_pct,
    timestamp: input.quote.timestamp,
    dataSource: input.quote.data_source,
    freshness: input.quote.freshness,
  } as const;

  if (input.technical.status !== 'available') {
    return {
      ...base,
      status: 'insufficient_data',
      summary: `${input.symbol} is ${changeText} at ${formatNumber(input.quote.price)}. Verified historical candles are unavailable, so technical measures are withheld.`,
      highlights: [],
    };
  }

  const technical = input.technical;
  const macdRelation = technical.macd >= technical.macdSignal ? 'above' : 'below';
  return {
    ...base,
    status: 'available',
    summary: `${input.symbol} is ${changeText} at ${formatNumber(input.quote.price)}. The values below are calculated from verified historical candles.`,
    highlights: [
      `RSI (14): ${technical.rsi14.toFixed(2)}.`,
      `EMA (20): ${formatNumber(technical.ema20)}; SMA (20): ${formatNumber(technical.sma20)}.`,
      `MACD: ${technical.macd.toFixed(4)}, ${macdRelation} its signal line (${technical.macdSignal.toFixed(4)}).`,
      `20-period range: support ${formatNumber(technical.support20)}; resistance ${formatNumber(technical.resistance20)}.`,
      `ATR (14): ${formatNumber(technical.atr14)}.`,
    ],
  };
}

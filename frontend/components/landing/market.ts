export type LandingQuote = {
  symbol: string;
  price: number;
  change_pct: number;
  timestamp?: string;
  freshness?: 'live' | 'cached' | 'stale';
  is_stale?: boolean;
};

export const featuredSymbols = ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD'];
export const tickerSymbols = ['BTCUSD', 'EURUSD', 'NVDA', 'ETHUSD', 'XAUUSD', 'AAPL'];
export const landingSymbols = Array.from(new Set([...featuredSymbols, ...tickerSymbols]));

export function isLandingQuote(value: unknown): value is LandingQuote {
  if (!value || typeof value !== 'object') return false;
  const quote = value as Record<string, unknown>;
  return typeof quote.symbol === 'string'
    && landingSymbols.includes(quote.symbol)
    && typeof quote.price === 'number' && Number.isFinite(quote.price) && quote.price > 0
    && typeof quote.change_pct === 'number' && Number.isFinite(quote.change_pct);
}

export function formatQuotePrice(quote: LandingQuote) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: quote.symbol === 'EURUSD' || quote.price < 1 ? 4 : 2,
    maximumFractionDigits: quote.symbol === 'EURUSD' || quote.price < 1 ? 6 : 2,
  }).format(quote.price);
}

export function quoteStatus(quote?: LandingQuote) {
  if (!quote) return 'Unavailable';
  if (quote.is_stale || quote.freshness === 'stale') return 'Stale';
  return quote.freshness === 'live' ? 'Live' : 'Delayed';
}

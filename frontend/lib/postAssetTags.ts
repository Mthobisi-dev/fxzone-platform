const SYMBOL_PATTERN = /\$?[A-Z][A-Z0-9]{1,9}(?:\/[A-Z]{3,5})?/g;

export const POST_ASSET_SYMBOLS = new Set([
  'BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'ADAUSD', 'DOTUSD', 'LINKUSD', 'UNIUSD', 'DOGEUSD', 'AVAXUSD',
  'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'AVGO', 'INTC', 'QCOM', 'AMD', 'LLY', 'JNJ', 'WMT', 'CAT', 'GE',
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'USDCHF', 'EURGBP', 'XAUUSD', 'XAGUSD',
]);

function normalizeSymbol(value: string): string {
  return value.replace(/^\$/, '').replace('/', '').toUpperCase();
}

export function extractPostAssetTags(text: string, knownSymbols: ReadonlySet<string>): string[] {
  const normalizedKnown = new Set(Array.from(knownSymbols, normalizeSymbol));
  const matches = text.match(SYMBOL_PATTERN) ?? [];
  const result: string[] = [];

  for (const match of matches) {
    const symbol = normalizeSymbol(match);
    if (normalizedKnown.has(symbol) && !result.includes(symbol)) result.push(symbol);
  }

  return result;
}

/** Normalize composer input before persisting it on a post. */
export function normalizePostAssetTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const known = new Set(Array.from(POST_ASSET_SYMBOLS, normalizeSymbol));
  const result: string[] = [];
  for (const value of input) {
    if (typeof value !== 'string') continue;
    const symbol = normalizeSymbol(value.trim().replace(/[^A-Za-z0-9/$.]/g, ''));
    if (known.has(symbol) && !result.includes(symbol)) result.push(symbol);
    if (result.length >= 12) break;
  }
  return result;
}

export function getUnreadBadgeLabel(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count > 99 ? '99+' : String(Math.floor(count));
}

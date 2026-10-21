const KNOWN_SYMBOLS = new Set([
  'BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'ADAUSD', 'DOTUSD', 'LINKUSD', 'UNIUSD', 'DOGEUSD', 'AVAXUSD',
  'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'AVGO', 'INTC', 'QCOM', 'AMD', 'LLY', 'JNJ', 'WMT', 'CAT', 'GE',
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'USDCHF', 'EURGBP', 'XAUUSD', 'XAGUSD',
]);
const SUPPORTED_INTERVALS = new Set(['1m', '5m', '15m', '1h', '4h', '1d']);

export type ShareSignal = {
  symbol: string;
  interval: string;
  side: 'BUY' | 'SELL';
  entry: number;
  takeProfit: number;
  stopLoss: number;
  provider: string;
  timestamp: string;
  rationale?: string;
};

export function validateShareSignal(input: unknown): ShareSignal {
  if (!input || typeof input !== 'object') throw new Error('Signal data is required.');
  const value = input as Record<string, unknown>;
  const symbol = String(value.symbol || '').toUpperCase();
  const interval = String(value.interval || '');
  const side = value.side === 'BUY' || value.side === 'SELL' ? value.side : null;
  const entry = Number(value.entry);
  const takeProfit = Number(value.takeProfit);
  const stopLoss = Number(value.stopLoss);
  if (!KNOWN_SYMBOLS.has(symbol) || !SUPPORTED_INTERVALS.has(interval) || !side) throw new Error('Signal instrument, interval, and side are invalid.');
  if (![entry, takeProfit, stopLoss].every((level) => Number.isFinite(level) && level > 0)) throw new Error('Signal levels must be positive numbers.');
  const provider = String(value.provider || 'provider')
    .replace(/[^a-z0-9 _.-]/gi, '')
    .slice(0, 40) || 'provider';
  const timestamp = String(value.timestamp || '');
  if (!timestamp || Number.isNaN(Date.parse(timestamp))) throw new Error('Signal timestamp is invalid.');
  const rationale = typeof value.rationale === 'string' ? value.rationale.trim().slice(0, 240) : undefined;
  return { symbol, interval, side, entry, takeProfit, stopLoss, provider, timestamp, ...(rationale ? { rationale } : {}) };
}

export function serializeShareSignal(signal: ShareSignal): string {
  const safe = validateShareSignal(signal);
  return `[FxZone Signal] ${JSON.stringify(safe)}`;
}

/**
 * Parses the structured signal payload used by chat messages.
 * Invalid or legacy text is ignored so a malformed message is rendered as
 * ordinary text instead of inventing prices or trade levels in the UI.
 */
export function parseSerializedShareSignal(content: string): ShareSignal | null {
  const prefix = '[FxZone Signal] ';
  if (!content.startsWith(prefix)) return null;

  try {
    return validateShareSignal(JSON.parse(content.slice(prefix.length)));
  } catch {
    return null;
  }
}

const FOREX_SYMBOLS = new Set(['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'USDCHF', 'EURGBP']);
const CRYPTO_SYMBOLS = new Set(['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'ADAUSD', 'DOTUSD', 'LINKUSD', 'UNIUSD', 'DOGEUSD', 'AVAXUSD']);
const METAL_SYMBOLS: Record<string, string> = { XAUUSD: 'OANDA:XAUUSD', XAGUSD: 'OANDA:XAGUSD' };

/** Builds a TradingView research link without implying TradingView supplies FxZone candles. */
export function getTradingViewChartUrl(rawSymbol: string): string | null {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!/^[A-Z0-9.=-]{1,16}$/.test(symbol)) return null;
  const providerSymbol = METAL_SYMBOLS[symbol]
    ?? (FOREX_SYMBOLS.has(symbol) ? `FX:${symbol}` : null)
    ?? (CRYPTO_SYMBOLS.has(symbol) ? `COINBASE:${symbol}` : null)
    ?? symbol;
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(providerSymbol)}`;
}

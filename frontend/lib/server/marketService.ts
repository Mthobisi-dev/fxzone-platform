/**
 * Server-side market-data service.
 *
 * Quotes are only returned when they came from a provider. The cache retains a
 * recent provider quote as explicitly stale data; it never substitutes a
 * hard-coded or generated price. Twelve Data powers listed markets, forex and
 * metals. CoinGecko powers the cryptocurrency catalogue.
 */

export interface MarketAsset {
  id: string;
  symbol: string;
  name: string;
  asset_type: 'stock' | 'crypto' | 'forex' | 'commodity';
  description?: string;
  is_active: boolean;
}

export interface PriceData {
  symbol: string;
  price: number;
  change: number;
  change_pct: number;
  bid: number | null;
  ask: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  open: number | null;
  /** Original provider timestamp where available. */
  timestamp: string;
  is_indicative: boolean;
  data_source: 'coingecko' | 'twelve_data';
  freshness: 'live' | 'cached' | 'stale';
  is_stale: boolean;
  is_live: boolean;
}

export interface HistoricalCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export class MarketDataUnavailableError extends Error {
  constructor(message = 'Live market data is temporarily unavailable.') {
    super(message);
    this.name = 'MarketDataUnavailableError';
  }
}

export const SUPPORTED_ASSETS: MarketAsset[] = [
  { id: 'asset-btc', symbol: 'BTCUSD', name: 'Bitcoin', asset_type: 'crypto', description: 'Digital Gold - Premier Cryptocurrency', is_active: true },
  { id: 'asset-eth', symbol: 'ETHUSD', name: 'Ethereum', asset_type: 'crypto', description: 'Smart Contract & Layer-1 Platform', is_active: true },
  { id: 'asset-sol', symbol: 'SOLUSD', name: 'Solana', asset_type: 'crypto', description: 'High Performance Layer-1 Blockchain', is_active: true },
  { id: 'asset-xrp', symbol: 'XRPUSD', name: 'XRP Ledger', asset_type: 'crypto', description: 'Cross-Border Digital Payment Asset', is_active: true },
  { id: 'asset-ada', symbol: 'ADAUSD', name: 'Cardano', asset_type: 'crypto', description: 'Proof-of-Stake Blockchain Protocol', is_active: true },
  { id: 'asset-dot', symbol: 'DOTUSD', name: 'Polkadot', asset_type: 'crypto', description: 'Interoperable Multi-Chain Network', is_active: true },
  { id: 'asset-link', symbol: 'LINKUSD', name: 'Chainlink', asset_type: 'crypto', description: 'Decentralized Oracle Network', is_active: true },
  { id: 'asset-uni', symbol: 'UNIUSD', name: 'Uniswap', asset_type: 'crypto', description: 'Decentralized AMM Exchange Protocol', is_active: true },
  { id: 'asset-doge', symbol: 'DOGEUSD', name: 'Dogecoin', asset_type: 'crypto', description: 'Peer-to-Peer Memetic Currency', is_active: true },
  { id: 'asset-avax', symbol: 'AVAXUSD', name: 'Avalanche', asset_type: 'crypto', description: 'Scalable Subnet Blockchain', is_active: true },
  { id: 'asset-nvda', symbol: 'NVDA', name: 'NVIDIA Corporation', asset_type: 'stock', description: 'AI GPU Computing Leader', is_active: true },
  { id: 'asset-aapl', symbol: 'AAPL', name: 'Apple Inc.', asset_type: 'stock', description: 'Consumer Hardware & Services Giant', is_active: true },
  { id: 'asset-msft', symbol: 'MSFT', name: 'Microsoft Corporation', asset_type: 'stock', description: 'Enterprise Cloud & AI Leader', is_active: true },
  { id: 'asset-googl', symbol: 'GOOGL', name: 'Alphabet Inc.', asset_type: 'stock', description: 'Search & Cloud AI Powerhouse', is_active: true },
  { id: 'asset-amzn', symbol: 'AMZN', name: 'Amazon.com Inc.', asset_type: 'stock', description: 'E-Commerce & AWS Cloud Leader', is_active: true },
  { id: 'asset-tsla', symbol: 'TSLA', name: 'Tesla Inc.', asset_type: 'stock', description: 'Electric Vehicles & Clean Energy', is_active: true },
  { id: 'asset-meta', symbol: 'META', name: 'Meta Platforms Inc.', asset_type: 'stock', description: 'Social Media & AI Ecosystem', is_active: true },
  { id: 'asset-avgo', symbol: 'AVGO', name: 'Broadcom Inc.', asset_type: 'stock', description: 'Semiconductors & Infrastructure Software', is_active: true },
  { id: 'asset-intc', symbol: 'INTC', name: 'Intel Corporation', asset_type: 'stock', description: 'Semiconductor Microprocessors', is_active: true },
  { id: 'asset-qcom', symbol: 'QCOM', name: 'Qualcomm Inc.', asset_type: 'stock', description: 'Wireless Telecommunications Tech', is_active: true },
  { id: 'asset-amd', symbol: 'AMD', name: 'Advanced Micro Devices', asset_type: 'stock', description: 'CPUs & Data Center Accelerators', is_active: true },
  { id: 'asset-lly', symbol: 'LLY', name: 'Eli Lilly and Company', asset_type: 'stock', description: 'Pharmaceutical & Biotechs', is_active: true },
  { id: 'asset-jnj', symbol: 'JNJ', name: 'Johnson & Johnson', asset_type: 'stock', description: 'Healthcare & Pharmaceuticals', is_active: true },
  { id: 'asset-wmt', symbol: 'WMT', name: 'Walmart Inc.', asset_type: 'stock', description: 'Global Hypermarket Retail', is_active: true },
  { id: 'asset-cat', symbol: 'CAT', name: 'Caterpillar Inc.', asset_type: 'stock', description: 'Heavy Industrial Machinery', is_active: true },
  { id: 'asset-ge', symbol: 'GE', name: 'General Electric Aerospace', asset_type: 'stock', description: 'Aerospace & Power Systems', is_active: true },
  { id: 'asset-eurusd', symbol: 'EURUSD', name: 'Euro / US Dollar', asset_type: 'forex', description: 'Eurozone vs United States Currency Pair', is_active: true },
  { id: 'asset-gbpusd', symbol: 'GBPUSD', name: 'British Pound / US Dollar', asset_type: 'forex', description: 'Great Britain Pound vs US Dollar Pair', is_active: true },
  { id: 'asset-usdjpy', symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', asset_type: 'forex', description: 'US Dollar vs Japanese Yen Pair', is_active: true },
  { id: 'asset-audusd', symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', asset_type: 'forex', description: 'Australian Dollar vs US Dollar Pair', is_active: true },
  { id: 'asset-usdcad', symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', asset_type: 'forex', description: 'US Dollar vs Canadian Dollar Pair', is_active: true },
  { id: 'asset-nzdusd', symbol: 'NZDUSD', name: 'New Zealand Dollar / US Dollar', asset_type: 'forex', description: 'New Zealand Dollar vs US Dollar Pair', is_active: true },
  { id: 'asset-usdchf', symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', asset_type: 'forex', description: 'US Dollar vs Swiss Franc Pair', is_active: true },
  { id: 'asset-eurgbp', symbol: 'EURGBP', name: 'Euro / British Pound', asset_type: 'forex', description: 'Eurozone vs Great Britain Currency Cross', is_active: true },
  { id: 'asset-xauusd', symbol: 'XAUUSD', name: 'Gold Spot / US Dollar', asset_type: 'commodity', description: 'Gold Bullion Spot Price per Ounce', is_active: true },
  { id: 'asset-xagusd', symbol: 'XAGUSD', name: 'Silver Spot / US Dollar', asset_type: 'commodity', description: 'Silver Bullion Spot Price per Ounce', is_active: true },
];

const COINGECKO_MAP: Record<string, string> = {
  BTCUSD: 'bitcoin', ETHUSD: 'ethereum', SOLUSD: 'solana', XRPUSD: 'ripple', ADAUSD: 'cardano',
  DOTUSD: 'polkadot', LINKUSD: 'chainlink', UNIUSD: 'uniswap', DOGEUSD: 'dogecoin', AVAXUSD: 'avalanche-2',
};

const TWELVE_DATA_MAP: Record<string, string> = {
  NVDA: 'NVDA', AAPL: 'AAPL', MSFT: 'MSFT', GOOGL: 'GOOGL', AMZN: 'AMZN', TSLA: 'TSLA', META: 'META',
  AVGO: 'AVGO', INTC: 'INTC', QCOM: 'QCOM', AMD: 'AMD', LLY: 'LLY', JNJ: 'JNJ', WMT: 'WMT', CAT: 'CAT', GE: 'GE',
  EURUSD: 'EUR/USD', GBPUSD: 'GBP/USD', USDJPY: 'USD/JPY', AUDUSD: 'AUD/USD', USDCAD: 'USD/CAD',
  NZDUSD: 'NZD/USD', USDCHF: 'USD/CHF', EURGBP: 'EUR/GBP', XAUUSD: 'XAU/USD', XAGUSD: 'XAG/USD',
};

let priceCache: Record<string, PriceData> = {};
let lastFetchTime = 0;
const CACHE_TTL_MS = 15_000;
const STALE_CACHE_TTL_MS = 5 * 60 * 1_000;
const PROVIDER_TIMEOUT_MS = 5_000;

function asFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function quoteTimestamp(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value * 1_000).toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const withTimeZone = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
    const timestamp = Date.parse(withTimeZone);
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString();
  }
  // The provider omitted a quote time. This is a receipt time, never a price.
  return new Date().toISOString();
}

function cachedPrices(freshness: 'cached' | 'stale'): Record<string, PriceData> {
  return Object.fromEntries(Object.entries(priceCache)
    .filter(([, quote]) => Date.now() - Date.parse(quote.timestamp) <= STALE_CACHE_TTL_MS)
    .map(([symbol, quote]) => [symbol, {
      ...quote,
      freshness,
      is_stale: freshness === 'stale',
      is_live: false,
    }]));
}

function createCoinGeckoQuote(symbol: string, item: Record<string, unknown>): PriceData | null {
  const price = asFiniteNumber(item.usd);
  const changePct = asFiniteNumber(item.usd_24h_change);
  if (price === null || changePct === null) return null;

  return {
    symbol,
    price,
    change: price * (changePct / 100),
    change_pct: changePct,
    bid: null,
    ask: null,
    high: null,
    low: null,
    open: null,
    volume: asFiniteNumber(item.usd_24h_vol),
    timestamp: quoteTimestamp(item.last_updated_at),
    is_indicative: false,
    data_source: 'coingecko',
    freshness: 'live',
    is_stale: false,
    is_live: true,
  };
}

function createTwelveDataQuote(symbol: string, quote: Record<string, unknown>): PriceData | null {
  const price = asFiniteNumber(quote.close);
  const change = asFiniteNumber(quote.change);
  const changePct = asFiniteNumber(quote.percent_change);
  if (price === null || change === null || changePct === null) return null;

  return {
    symbol,
    price,
    change,
    change_pct: changePct,
    bid: asFiniteNumber(quote.bid),
    ask: asFiniteNumber(quote.ask),
    high: asFiniteNumber(quote.high),
    low: asFiniteNumber(quote.low),
    open: asFiniteNumber(quote.open),
    volume: asFiniteNumber(quote.volume),
    timestamp: quoteTimestamp(quote.timestamp ?? quote.datetime),
    is_indicative: false,
    data_source: 'twelve_data',
    freshness: 'live',
    is_stale: false,
    is_live: true,
  };
}

function providerQuoteEntries(payload: unknown): Array<[string, Record<string, unknown>]> {
  if (!payload || typeof payload !== 'object') return [];
  const objectPayload = payload as Record<string, unknown>;
  if (typeof objectPayload.symbol === 'string') return [[objectPayload.symbol, objectPayload]];
  return Object.entries(objectPayload).filter((entry): entry is [string, Record<string, unknown>] =>
    Boolean(entry[1]) && typeof entry[1] === 'object' && !Array.isArray(entry[1])
  );
}

async function fetchCoinGeckoQuotes(): Promise<Record<string, PriceData>> {
  const ids = Object.values(COINGECKO_MAP).join(',');
  const apiKey = process.env.COINGECKO_DEMO_API_KEY;
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_last_updated_at=true`,
    {
      headers: apiKey ? { 'x-cg-demo-api-key': apiKey } : undefined,
      next: { revalidate: 15 },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    }
  );
  if (!response.ok) throw new MarketDataUnavailableError(`CoinGecko returned ${response.status}.`);
  const payload = await response.json() as Record<string, Record<string, unknown>>;
  const quotes: Record<string, PriceData> = {};
  for (const [symbol, id] of Object.entries(COINGECKO_MAP)) {
    const quote = payload[id] ? createCoinGeckoQuote(symbol, payload[id]) : null;
    if (quote) quotes[symbol] = quote;
  }
  return quotes;
}

async function fetchTwelveDataQuotes(): Promise<Record<string, PriceData>> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) return {};
  const symbols = Object.values(TWELVE_DATA_MAP).join(',');
  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols)}&apikey=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, { next: { revalidate: 15 }, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  if (!response.ok) throw new MarketDataUnavailableError(`Twelve Data returned ${response.status}.`);

  const payload = await response.json();
  const providerToInternal = new Map(Object.entries(TWELVE_DATA_MAP).map(([internal, provider]) => [provider.toUpperCase(), internal]));
  const quotes: Record<string, PriceData> = {};
  for (const [providerSymbol, providerQuote] of providerQuoteEntries(payload)) {
    const internalSymbol = providerToInternal.get(providerSymbol.toUpperCase());
    const quote = internalSymbol ? createTwelveDataQuote(internalSymbol, providerQuote) : null;
    if (quote && internalSymbol) quotes[internalSymbol] = quote;
  }
  return quotes;
}

/** Returns live or explicitly cached/stale provider quotes. */
export async function fetchLivePrices(): Promise<Record<string, PriceData>> {
  const now = Date.now();
  if (Object.keys(priceCache).length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedPrices('cached');
  }

  const [cryptoResult, listedResult] = await Promise.allSettled([fetchCoinGeckoQuotes(), fetchTwelveDataQuotes()]);
  if (cryptoResult.status === 'rejected') console.warn('CoinGecko quote fetch failed:', cryptoResult.reason);
  if (listedResult.status === 'rejected') console.warn('Twelve Data quote fetch failed:', listedResult.reason);

  const liveQuotes = {
    ...(cryptoResult.status === 'fulfilled' ? cryptoResult.value : {}),
    ...(listedResult.status === 'fulfilled' ? listedResult.value : {}),
  };
  if (Object.keys(liveQuotes).length === 0) return cachedPrices('stale');

  priceCache = { ...priceCache, ...liveQuotes };
  lastFetchTime = now;
  return { ...cachedPrices('stale'), ...liveQuotes };
}

const TWELVE_INTERVALS: Record<string, string> = {
  '1m': '1min',
  '5m': '5min',
  '15m': '15min',
  '1h': '1h',
  '4h': '4h',
  '1d': '1day',
};

/** Fetches provider OHLCV. Generated candles are deliberately not supported. */
export async function fetchHistoricalCandles(symbol: string, timeframe: string): Promise<HistoricalCandle[]> {
  const providerSymbol = TWELVE_DATA_MAP[symbol.toUpperCase()];
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!providerSymbol || !apiKey) {
    throw new MarketDataUnavailableError('Verified historical market data is not configured for this instrument.');
  }
  const interval = TWELVE_INTERVALS[timeframe] || TWELVE_INTERVALS['1h'];
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(providerSymbol)}&interval=${interval}&outputsize=200&timezone=UTC&apikey=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, { next: { revalidate: 60 }, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  if (!response.ok) throw new MarketDataUnavailableError(`Twelve Data returned ${response.status}.`);
  const payload = await response.json() as { values?: Array<Record<string, unknown>>; message?: string };
  if (!Array.isArray(payload.values) || payload.values.length === 0) {
    throw new MarketDataUnavailableError(payload.message || 'No verified historical data is currently available.');
  }

  const candles = payload.values.map((value) => {
    const time = Date.parse(`${String(value.datetime ?? '').replace(' ', 'T')}Z`);
    const open = asFiniteNumber(value.open);
    const high = asFiniteNumber(value.high);
    const low = asFiniteNumber(value.low);
    const close = asFiniteNumber(value.close);
    if (!Number.isFinite(time) || open === null || high === null || low === null || close === null) return null;
    return { time: Math.floor(time / 1_000), open, high, low, close, volume: asFiniteNumber(value.volume) };
  }).filter((candle): candle is HistoricalCandle => candle !== null);
  if (candles.length === 0) throw new MarketDataUnavailableError('The provider returned incomplete historical data.');
  return candles.reverse();
}

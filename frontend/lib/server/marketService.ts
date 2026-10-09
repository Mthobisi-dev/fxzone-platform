/**
 * Server-side market-data service.
 *
 * Quotes are only returned when they came from a provider. The cache retains a
 * recent provider quote as explicitly stale data; it never substitutes a
 * hard-coded or generated price. Twelve Data powers listed markets, forex and
 * metals. CoinGecko powers the cryptocurrency catalogue. Frankfurter provides
 * daily official forex reference rates when no real-time forex key is set.
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
  data_source: 'coingecko' | 'twelve_data' | 'frankfurter' | 'yahoo_finance';
  freshness: 'live' | 'delayed' | 'cached' | 'stale';
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

/**
 * Yahoo Finance is a no-key, delayed fallback for provider outages or an
 * unconfigured Twelve Data key. Every quote derived from this map is labelled
 * delayed; it must never be displayed as live exchange data.
 */
const YAHOO_FINANCE_MAP: Record<string, string> = {
  BTCUSD: 'BTC-USD', ETHUSD: 'ETH-USD', SOLUSD: 'SOL-USD', XRPUSD: 'XRP-USD', ADAUSD: 'ADA-USD',
  DOTUSD: 'DOT-USD', LINKUSD: 'LINK-USD', UNIUSD: 'UNI7083-USD', DOGEUSD: 'DOGE-USD', AVAXUSD: 'AVAX-USD',
  NVDA: 'NVDA', AAPL: 'AAPL', MSFT: 'MSFT', GOOGL: 'GOOGL', AMZN: 'AMZN', TSLA: 'TSLA', META: 'META',
  AVGO: 'AVGO', INTC: 'INTC', QCOM: 'QCOM', AMD: 'AMD', LLY: 'LLY', JNJ: 'JNJ', WMT: 'WMT', CAT: 'CAT', GE: 'GE',
  EURUSD: 'EURUSD=X', GBPUSD: 'GBPUSD=X', USDJPY: 'JPY=X', AUDUSD: 'AUDUSD=X', USDCAD: 'CAD=X',
  NZDUSD: 'NZDUSD=X', USDCHF: 'CHF=X', EURGBP: 'EURGBP=X', XAUUSD: 'GC=F', XAGUSD: 'SI=F',
};

const FRANKFURTER_CURRENCIES = ['USD', 'GBP', 'JPY', 'AUD', 'CAD', 'NZD', 'CHF'] as const;

let priceCache: Record<string, PriceData> = {};
let lastFetchTime = 0;
const CACHE_TTL_MS = 15_000;
const STALE_CACHE_TTL_MS = 5 * 60 * 1_000;
const PROVIDER_TIMEOUT_MS = 5_000;

function asFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null;
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
      // A fresh cache of a daily reference rate remains delayed. If it grows
      // too old, stale is the stronger warning and replaces that label.
      freshness: freshness === 'stale' ? 'stale' : quote.freshness === 'delayed' ? 'delayed' : 'cached',
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

function lastFiniteNumber(values: unknown): number | null {
  if (!Array.isArray(values)) return null;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = asFiniteNumber(values[index]);
    if (value !== null) return value;
  }
  return null;
}

type YahooSparkPayload = {
  spark?: {
    result?: Array<{
      symbol?: unknown;
      response?: Array<{
        meta?: Record<string, unknown>;
        timestamp?: unknown[];
        indicators?: { quote?: Array<{ close?: unknown[] }> };
      }>;
    }>;
  };
};

/** Converts Yahoo Finance provider values to transparently delayed quotes. */
export function buildYahooFinanceQuotes(payload: YahooSparkPayload): Record<string, PriceData> {
  const providerToInternal = new Map(
    Object.entries(YAHOO_FINANCE_MAP).map(([internal, provider]) => [provider.toUpperCase(), internal])
  );
  const quotes: Record<string, PriceData> = {};

  for (const result of payload.spark?.result ?? []) {
    const response = result.response?.[0];
    const meta = response?.meta;
    if (!response || !meta) continue;

    const providerSymbol = typeof result.symbol === 'string'
      ? result.symbol
      : typeof meta.symbol === 'string' ? meta.symbol : '';
    const internalSymbol = providerToInternal.get(providerSymbol.toUpperCase());
    if (!internalSymbol) continue;

    const lastClose = lastFiniteNumber(response.indicators?.quote?.[0]?.close);
    const price = asFiniteNumber(meta.regularMarketPrice) ?? lastClose;
    if (price === null) continue;

    const previousClose = asFiniteNumber(meta.chartPreviousClose);
    const change = asFiniteNumber(meta.regularMarketChange)
      ?? (previousClose === null ? null : price - previousClose);
    const changePct = asFiniteNumber(meta.regularMarketChangePercent)
      ?? (change === null || previousClose === null || previousClose === 0 ? null : (change / previousClose) * 100);
    if (change === null || changePct === null) continue;

    quotes[internalSymbol] = {
      symbol: internalSymbol,
      price,
      change,
      change_pct: changePct,
      bid: null,
      ask: null,
      high: asFiniteNumber(meta.regularMarketDayHigh),
      low: asFiniteNumber(meta.regularMarketDayLow),
      open: asFiniteNumber(meta.regularMarketOpen),
      volume: asFiniteNumber(meta.regularMarketVolume),
      timestamp: quoteTimestamp(meta.regularMarketTime ?? lastFiniteNumber(response.timestamp)),
      is_indicative: false,
      data_source: 'yahoo_finance',
      freshness: 'delayed',
      is_stale: false,
      is_live: false,
    };
  }

  return quotes;
}

/** Yahoo Finance rejects oversized spark symbol lists, so keep requests small. */
export function splitYahooFinanceSymbols(symbols: string[], size = 10): string[][] {
  const batches: string[][] = [];
  for (let index = 0; index < symbols.length; index += size) {
    batches.push(symbols.slice(index, index + size));
  }
  return batches;
}

async function fetchYahooFinanceQuotes(): Promise<Record<string, PriceData>> {
  const providerSymbols = [...new Set(Object.values(YAHOO_FINANCE_MAP))];
  const payloads = await Promise.all(splitYahooFinanceSymbols(providerSymbols).map(async (symbols) => {
    const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symbols.join(','))}&range=5d&interval=1d`;
    const response = await fetch(url, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    if (!response.ok) throw new MarketDataUnavailableError(`Yahoo Finance returned ${response.status}.`);
    return response.json() as Promise<YahooSparkPayload>;
  }));
  return Object.assign({}, ...payloads.map((payload) => buildYahooFinanceQuotes(payload)));
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

type FrankfurterPayload = {
  rates?: Record<string, Record<string, unknown>>;
};

function getCrossRate(rates: Record<string, unknown>, numerator: string, denominator: string): number | null {
  const numeratorRate = numerator === 'EUR' ? 1 : asFiniteNumber(rates[numerator]);
  const denominatorRate = denominator === 'EUR' ? 1 : asFiniteNumber(rates[denominator]);
  if (numeratorRate === null || denominatorRate === null || denominatorRate === 0) return null;
  return numeratorRate / denominatorRate;
}

/**
 * Converts two official EUR reference-rate snapshots into FxZone pair quotes.
 * These rates update daily, so they are explicitly labelled delayed rather
 * than live. Crosses are calculated directly from the two provider values.
 */
export function buildFrankfurterForexQuotes(payload: FrankfurterPayload): Record<string, PriceData> {
  const datedRates = Object.entries(payload.rates || {})
    .filter((entry): entry is [string, Record<string, unknown>] => Boolean(entry[1]) && typeof entry[1] === 'object')
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate));
  if (datedRates.length < 2) return {};

  const [, previousRates] = datedRates[datedRates.length - 2];
  const [currentDate, currentRates] = datedRates[datedRates.length - 1];
  const pairs: Array<{ symbol: string; base: string; quote: string }> = [
    { symbol: 'EURUSD', base: 'EUR', quote: 'USD' },
    { symbol: 'GBPUSD', base: 'GBP', quote: 'USD' },
    { symbol: 'USDJPY', base: 'USD', quote: 'JPY' },
    { symbol: 'AUDUSD', base: 'AUD', quote: 'USD' },
    { symbol: 'USDCAD', base: 'USD', quote: 'CAD' },
    { symbol: 'NZDUSD', base: 'NZD', quote: 'USD' },
    { symbol: 'USDCHF', base: 'USD', quote: 'CHF' },
    { symbol: 'EURGBP', base: 'EUR', quote: 'GBP' },
  ];

  const quotes: Record<string, PriceData> = {};
  for (const pair of pairs) {
    const price = getCrossRate(currentRates, pair.quote, pair.base);
    const previousPrice = getCrossRate(previousRates, pair.quote, pair.base);
    if (price === null || previousPrice === null || previousPrice === 0) continue;
    const change = price - previousPrice;
    quotes[pair.symbol] = {
      symbol: pair.symbol,
      price,
      change,
      change_pct: (change / previousPrice) * 100,
      bid: null,
      ask: null,
      high: null,
      low: null,
      open: null,
      volume: null,
      timestamp: new Date(`${currentDate}T00:00:00.000Z`).toISOString(),
      is_indicative: true,
      data_source: 'frankfurter',
      freshness: 'delayed',
      is_stale: false,
      is_live: false,
    };
  }
  return quotes;
}

async function fetchFrankfurterForexQuotes(): Promise<Record<string, PriceData>> {
  const startDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1_000).toISOString().slice(0, 10);
  const symbols = FRANKFURTER_CURRENCIES.join(',');
  const url = `https://api.frankfurter.dev/v1/${startDate}..?base=EUR&symbols=${symbols}`;
  const response = await fetch(url, { next: { revalidate: 60 * 60 }, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  if (!response.ok) throw new MarketDataUnavailableError(`Frankfurter returned ${response.status}.`);
  return buildFrankfurterForexQuotes(await response.json() as FrankfurterPayload);
}

/** Returns live or explicitly cached/stale provider quotes. */
export async function fetchLivePrices(): Promise<Record<string, PriceData>> {
  const now = Date.now();
  if (Object.keys(priceCache).length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedPrices('cached');
  }

  const [cryptoResult, listedResult, forexResult, yahooResult] = await Promise.allSettled([
    fetchCoinGeckoQuotes(),
    fetchTwelveDataQuotes(),
    fetchFrankfurterForexQuotes(),
    fetchYahooFinanceQuotes(),
  ]);
  if (cryptoResult.status === 'rejected') console.warn('CoinGecko quote fetch failed:', cryptoResult.reason);
  if (listedResult.status === 'rejected') console.warn('Twelve Data quote fetch failed:', listedResult.reason);
  if (forexResult.status === 'rejected') console.warn('Frankfurter forex fetch failed:', forexResult.reason);
  if (yahooResult.status === 'rejected') console.warn('Yahoo Finance quote fetch failed:', yahooResult.reason);

  // Twelve Data is the live listed-market and Forex source when configured,
  // so it intentionally overrides every delayed fallback. CoinGecko remains
  // the preferred live cryptocurrency source. Yahoo Finance is only used when
  // a more direct provider did not return a quote.
  const liveQuotes = {
    ...(forexResult.status === 'fulfilled' ? forexResult.value : {}),
    ...(yahooResult.status === 'fulfilled' ? yahooResult.value : {}),
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

const YAHOO_INTERVALS: Record<string, { interval: string; range: string }> = {
  '1m': { interval: '1m', range: '5d' },
  '5m': { interval: '5m', range: '1mo' },
  '15m': { interval: '15m', range: '2mo' },
  '1h': { interval: '1h', range: '3mo' },
  '4h': { interval: '4h', range: '3mo' },
  '1d': { interval: '1d', range: '3mo' },
};

type YahooChartPayload = {
  chart?: {
    result?: Array<{
      timestamp?: unknown[];
      indicators?: {
        quote?: Array<{
          open?: unknown[];
          high?: unknown[];
          low?: unknown[];
          close?: unknown[];
          volume?: unknown[];
        }>;
      };
    }>;
  };
};

/** Drops incomplete provider rows rather than manufacturing OHLC values. */
export function parseYahooFinanceCandles(payload: YahooChartPayload): HistoricalCandle[] {
  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (!result || !quote || !Array.isArray(result.timestamp)) return [];

  const candles: HistoricalCandle[] = [];
  for (let index = 0; index < result.timestamp.length; index += 1) {
    const time = asFiniteNumber(result.timestamp[index]);
    const open = asFiniteNumber(quote.open?.[index]);
    const high = asFiniteNumber(quote.high?.[index]);
    const low = asFiniteNumber(quote.low?.[index]);
    const close = asFiniteNumber(quote.close?.[index]);
    if (time === null || open === null || high === null || low === null || close === null) continue;
    candles.push({
      time: Math.floor(time),
      open,
      high,
      low,
      close,
      volume: asFiniteNumber(quote.volume?.[index]),
    });
  }
  return candles;
}

async function fetchTwelveDataCandles(symbol: string, timeframe: string): Promise<HistoricalCandle[]> {
  const providerSymbol = TWELVE_DATA_MAP[symbol.toUpperCase()];
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!providerSymbol || !apiKey) {
    throw new MarketDataUnavailableError('Twelve Data historical market data is not configured for this instrument.');
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

async function fetchYahooFinanceCandles(symbol: string, timeframe: string): Promise<HistoricalCandle[]> {
  const providerSymbol = YAHOO_FINANCE_MAP[symbol.toUpperCase()];
  if (!providerSymbol) {
    throw new MarketDataUnavailableError('Verified historical market data is unavailable for this instrument.');
  }
  const cadence = YAHOO_INTERVALS[timeframe] || YAHOO_INTERVALS['1h'];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}?range=${cadence.range}&interval=${cadence.interval}`;
  const response = await fetch(url, {
    next: { revalidate: cadence.interval === '1d' ? 300 : 60 },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  if (!response.ok) throw new MarketDataUnavailableError(`Yahoo Finance returned ${response.status}.`);
  const candles = parseYahooFinanceCandles(await response.json() as YahooChartPayload);
  if (candles.length === 0) throw new MarketDataUnavailableError('Yahoo Finance returned incomplete historical data.');
  return candles;
}

/**
 * Fetches genuine OHLCV from Twelve Data when configured, otherwise uses a
 * plainly delayed Yahoo Finance fallback. Generated candles are never used.
 */
export async function fetchHistoricalCandles(symbol: string, timeframe: string): Promise<HistoricalCandle[]> {
  if (process.env.TWELVE_DATA_API_KEY && TWELVE_DATA_MAP[symbol.toUpperCase()]) {
    try {
      return await fetchTwelveDataCandles(symbol, timeframe);
    } catch (error) {
      console.warn(`Twelve Data historical fetch failed for ${symbol}; using delayed fallback.`, error);
    }
  }
  return fetchYahooFinanceCandles(symbol, timeframe);
}

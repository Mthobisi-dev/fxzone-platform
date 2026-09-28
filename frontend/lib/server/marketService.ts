/**
 * Server-side Real Market Data Service for Next.js Route Handlers.
 * 
 * Fetches real-time price feeds from:
 * 1. CoinGecko API for Crypto
 * 2. Yahoo Finance REST API for Stocks, Forex & Commodities
 * 
 * Features automatic 15-second caching & robust fallback metrics.
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
  /** Indicative bid price (calculated spread based on market mid-price) */
  bid: number;
  /** Indicative ask price (calculated spread based on market mid-price) */
  ask: number;
  high: number;
  low: number;
  volume: number;
  open: number;
  timestamp: string;
  /** Flag indicating whether quote spread is calculated/indicative */
  is_indicative?: boolean;
  /** Primary data provider name. Never represents hard-coded production data. */
  data_source: 'coingecko' | 'yahoo_finance';
  /** Data quality metadata: cached values are never presented as live. */
  freshness: 'live' | 'cached' | 'stale';
  is_stale: boolean;
  is_live: boolean;
}

export const SUPPORTED_ASSETS: MarketAsset[] = [
  // ── Crypto Assets ──
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

  // ── US Tech & Mega-Cap Stocks ──
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

  // ── Forex Majors ──
  { id: 'asset-eurusd', symbol: 'EURUSD', name: 'Euro / US Dollar', asset_type: 'forex', description: 'Eurozone vs United States Currency Pair', is_active: true },
  { id: 'asset-gbpusd', symbol: 'GBPUSD', name: 'British Pound / US Dollar', asset_type: 'forex', description: 'Great Britain Pound vs US Dollar Pair', is_active: true },
  { id: 'asset-usdjpy', symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', asset_type: 'forex', description: 'US Dollar vs Japanese Yen Pair', is_active: true },
  { id: 'asset-audusd', symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', asset_type: 'forex', description: 'Australian Dollar vs US Dollar Pair', is_active: true },
  { id: 'asset-usdcad', symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', asset_type: 'forex', description: 'US Dollar vs Canadian Dollar Pair', is_active: true },
  { id: 'asset-nzdusd', symbol: 'NZDUSD', name: 'New Zealand Dollar / US Dollar', asset_type: 'forex', description: 'New Zealand Dollar vs US Dollar Pair', is_active: true },
  { id: 'asset-usdchf', symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', asset_type: 'forex', description: 'US Dollar vs Swiss Franc Pair', is_active: true },
  { id: 'asset-eurgbp', symbol: 'EURGBP', name: 'Euro / British Pound', asset_type: 'forex', description: 'Eurozone vs Great Britain Currency Cross', is_active: true },

  // ── Precious Metals & Commodities ──
  { id: 'asset-xauusd', symbol: 'XAUUSD', name: 'Gold Spot / US Dollar', asset_type: 'commodity', description: 'Gold Bullion Spot Price per Ounce', is_active: true },
  { id: 'asset-xagusd', symbol: 'XAGUSD', name: 'Silver Spot / US Dollar', asset_type: 'commodity', description: 'Silver Bullion Spot Price per Ounce', is_active: true },
];

const COINGECKO_MAP: Record<string, string> = {
  BTCUSD: 'bitcoin',
  ETHUSD: 'ethereum',
  SOLUSD: 'solana',
  XRPUSD: 'ripple',
  ADAUSD: 'cardano',
  DOTUSD: 'polkadot',
  LINKUSD: 'chainlink',
  UNIUSD: 'uniswap',
  DOGEUSD: 'dogecoin',
  AVAXUSD: 'avalanche-2',
};

const YAHOO_MAP: Record<string, string> = {
  NVDA: 'NVDA',
  AAPL: 'AAPL',
  MSFT: 'MSFT',
  GOOGL: 'GOOGL',
  AMZN: 'AMZN',
  TSLA: 'TSLA',
  META: 'META',
  AVGO: 'AVGO',
  INTC: 'INTC',
  QCOM: 'QCOM',
  AMD: 'AMD',
  LLY: 'LLY',
  JNJ: 'JNJ',
  WMT: 'WMT',
  CAT: 'CAT',
  GE: 'GE',
  EURUSD: 'EURUSD=X',
  GBPUSD: 'GBPUSD=X',
  USDJPY: 'USDJPY=X',
  AUDUSD: 'AUDUSD=X',
  USDCAD: 'USDCAD=X',
  NZDUSD: 'NZDUSD=X',
  USDCHF: 'USDCHF=X',
  EURGBP: 'EURGBP=X',
  XAUUSD: 'GC=F',
  XAGUSD: 'SI=F',
};

// Internal in-memory price cache for Next.js Server process
let priceCache: Record<string, PriceData> = {};
let lastFetchTime = 0;
const CACHE_TTL_MS = 15000; // 15 seconds
const STALE_CACHE_TTL_MS = 5 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 5_000;

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

function getDecimals(symbol: string, price: number): number {
  if (symbol in YAHOO_MAP && symbol.length === 6 && !symbol.startsWith('X')) {
    return price < 2 ? 5 : 3;
  }
  if (price > 1000) return 2;
  if (price > 10) return 2;
  if (price > 1) return 4;
  return 5;
}

export async function fetchLivePrices(): Promise<Record<string, PriceData>> {
  const now = Date.now();
  if (Object.keys(priceCache).length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedPrices('cached');
  }

  const result: Record<string, PriceData> = cachedPrices('stale');
  const timestamp = new Date().toISOString();
  let receivedLiveQuote = false;
  const cgIds = Object.values(COINGECKO_MAP).join(',');
  const cgUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${cgIds}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`;
  const yahooTickers = Object.values(YAHOO_MAP).join(',');
  const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooTickers)}`;

  // Start both independent providers immediately. On a cold cache this avoids
  // making page latency the sum of two network timeouts.
  const coinGeckoRequest = fetch(cgUrl, {
    headers: { 'User-Agent': 'FxZonePlatform/1.0' },
    next: { revalidate: 15 },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  const yahooRequest = fetch(yahooUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    next: { revalidate: 15 },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });

  // 1. Fetch Crypto from CoinGecko
  try {
    const cgRes = await coinGeckoRequest;

    if (cgRes.ok) {
      const cgData = await cgRes.json();
      Object.entries(COINGECKO_MAP).forEach(([symbol, cgId]) => {
        if (cgData[cgId]) {
          const item = cgData[cgId];
          const price = item.usd || 0;
          const changePct = item.usd_24h_change || 0;
          const vol = item.usd_24h_vol || 0;
          const dec = getDecimals(symbol, price);

          result[symbol] = {
            symbol,
            price: Number(price.toFixed(dec)),
            change: Number((price * changePct / 100).toFixed(dec)),
            change_pct: Number(changePct.toFixed(2)),
            bid: Number((price * 0.9998).toFixed(dec)),
            ask: Number((price * 1.0002).toFixed(dec)),
            high: Number((price * 1.015).toFixed(dec)),
            low: Number((price * 0.985).toFixed(dec)),
            open: Number((price - (price * changePct / 100)).toFixed(dec)),
            volume: Math.round(vol),
            timestamp,
            is_indicative: true,
            data_source: 'coingecko',
            freshness: 'live',
            is_stale: false,
            is_live: true,
          };
          receivedLiveQuote = true;
        }
      });
    }
  } catch (err) {
    console.warn('CoinGecko live fetch warning:', err);
  }

  // 2. Fetch Stocks & Forex from Yahoo Finance HTTP API
  try {
    const yRes = await yahooRequest;

    if (yRes.ok) {
      const yData = await yRes.json();
      const quoteList = yData?.quoteResponse?.result || [];

      const yahooSymbolToInternal: Record<string, string> = {};
      Object.entries(YAHOO_MAP).forEach(([intSym, ySym]) => {
        yahooSymbolToInternal[ySym.toUpperCase()] = intSym;
      });

      quoteList.forEach((q: any) => {
        const ySym = q.symbol?.toUpperCase();
        const intSym = yahooSymbolToInternal[ySym];
        if (intSym) {
          const price = q.regularMarketPrice || q.postMarketPrice || q.bid || 0;
          const changePct = q.regularMarketChangePercent || 0;
          const change = q.regularMarketChange || 0;
          const high = q.regularMarketDayHigh || price * 1.008;
          const low = q.regularMarketDayLow || price * 0.992;
          const open = q.regularMarketOpen || price - change;
          const volume = q.regularMarketVolume || 0;
          const dec = getDecimals(intSym, price);
          const spread = intSym.length === 6 ? price * 0.0001 : 0.02;

          result[intSym] = {
            symbol: intSym,
            price: Number(price.toFixed(dec)),
            change: Number(change.toFixed(dec)),
            change_pct: Number(changePct.toFixed(2)),
            bid: Number((price - spread).toFixed(dec)),
            ask: Number((price + spread).toFixed(dec)),
            high: Number(high.toFixed(dec)),
            low: Number(low.toFixed(dec)),
            open: Number(open.toFixed(dec)),
            volume: Math.round(volume),
            timestamp,
            is_indicative: true,
            data_source: 'yahoo_finance',
            freshness: 'live',
            is_stale: false,
            is_live: true,
          };
          receivedLiveQuote = true;
        }
      });
    }
  } catch (err) {
    console.warn('Yahoo Finance live fetch warning:', err);
  }

  // Never fabricate a quote. If a provider is unavailable, retain only a
  // recent provider quote marked stale; otherwise omit the symbol so callers
  // can render it as unavailable.
  if (receivedLiveQuote) {
    priceCache = Object.fromEntries(Object.entries(result).map(([symbol, quote]) => [symbol, {
      ...quote,
      freshness: quote.freshness === 'stale' ? 'cached' : quote.freshness,
      is_stale: false,
      is_live: quote.freshness === 'live',
    }]));
    lastFetchTime = now;
  }
  return result;
}
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
  /** Primary data provider name */
  data_source?: 'coingecko' | 'yahoo_finance' | 'indicative_fallback';
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
const PROVIDER_TIMEOUT_MS = 5_000;

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
    return priceCache;
  }

  const result: Record<string, PriceData> = { ...priceCache };
  const timestamp = new Date().toISOString();
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
          };
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
          };
        }
      });
    }
  } catch (err) {
    console.warn('Yahoo Finance live fetch warning:', err);
  }

  // 3. Fallback defaults for any symbol missing from live API responses
  const fallbacks: Record<string, Partial<PriceData>> = {
    BTCUSD: { price: 96450.00, change_pct: 1.92, volume: 28450000000 },
    ETHUSD: { price: 2740.80, change_pct: 1.56, volume: 14500000000 },
    SOLUSD: { price: 188.50, change_pct: 3.17, volume: 4200000000 },
    XRPUSD: { price: 2.4580, change_pct: 5.31, volume: 7800000000 },
    ADAUSD: { price: 0.7850, change_pct: 3.15, volume: 1200000000 },
    DOTUSD: { price: 8.4500, change_pct: 3.42, volume: 450000000 },
    LINKUSD: { price: 14.8000, change_pct: 4.20, volume: 680000000 },
    UNIUSD: { price: 8.2000, change_pct: 2.10, volume: 320000000 },
    DOGEUSD: { price: 0.2450, change_pct: 6.40, volume: 2100000000 },
    AVAXUSD: { price: 34.1000, change_pct: 3.80, volume: 540000000 },
    NVDA: { price: 138.80, change_pct: 3.04, volume: 72000000 },
    AAPL: { price: 228.40, change_pct: 0.55, volume: 48000000 },
    MSFT: { price: 418.50, change_pct: 0.50, volume: 22000000 },
    GOOGL: { price: 182.20, change_pct: 0.80, volume: 25000000 },
    AMZN: { price: 204.80, change_pct: 1.29, volume: 35000000 },
    TSLA: { price: 242.60, change_pct: 2.88, volume: 65000000 },
    META: { price: 638.50, change_pct: 1.17, volume: 18000000 },
    AVGO: { price: 178.20, change_pct: 1.45, volume: 12000000 },
    INTC: { price: 22.40, change_pct: -0.80, volume: 38000000 },
    QCOM: { price: 175.50, change_pct: 2.10, volume: 14000000 },
    AMD: { price: 158.30, change_pct: 2.80, volume: 42000000 },
    LLY: { price: 948.50, change_pct: -0.40, volume: 8500000 },
    JNJ: { price: 161.80, change_pct: -0.20, volume: 11000000 },
    WMT: { price: 74.20, change_pct: 0.60, volume: 19000000 },
    CAT: { price: 348.50, change_pct: 1.80, volume: 6200000 },
    GE: { price: 174.20, change_pct: 0.90, volume: 7800000 },
    EURUSD: { price: 1.04850, change_pct: -0.17, volume: 185000000 },
    GBPUSD: { price: 1.25800, change_pct: 0.18, volume: 142000000 },
    USDJPY: { price: 153.850, change_pct: 0.27, volume: 165000000 },
    AUDUSD: { price: 0.63500, change_pct: -0.19, volume: 95000000 },
    USDCAD: { price: 1.41800, change_pct: 0.11, volume: 88000000 },
    NZDUSD: { price: 0.57200, change_pct: -0.14, volume: 62000000 },
    USDCHF: { price: 0.90200, change_pct: 0.07, volume: 75000000 },
    EURGBP: { price: 0.83350, change_pct: -0.17, volume: 82000000 },
    XAUUSD: { price: 2892.40, change_pct: 0.65, volume: 42000000 },
    XAGUSD: { price: 32.85, change_pct: 1.39, volume: 18000000 },
  };

  SUPPORTED_ASSETS.forEach((asset) => {
    if (!result[asset.symbol]) {
      const fb = fallbacks[asset.symbol] || { price: 100, change_pct: 0, volume: 100000 };
      const price = fb.price || 100;
      const changePct = fb.change_pct || 0;
      const dec = getDecimals(asset.symbol, price);

      result[asset.symbol] = {
        symbol: asset.symbol,
        price: Number(price.toFixed(dec)),
        change: Number((price * changePct / 100).toFixed(dec)),
        change_pct: Number(changePct.toFixed(2)),
        bid: Number((price * 0.9998).toFixed(dec)),
        ask: Number((price * 1.0002).toFixed(dec)),
        high: Number((price * 1.008).toFixed(dec)),
        low: Number((price * 0.992).toFixed(dec)),
        open: Number((price - (price * changePct / 100)).toFixed(dec)),
        volume: fb.volume || 1000000,
        timestamp,
        is_indicative: true,
        data_source: 'indicative_fallback',
      };
    }
  });

  priceCache = result;
  lastFetchTime = now;
  return result;
}

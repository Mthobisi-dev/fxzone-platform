export interface TrendPost {
  content?: string | null;
  asset_tags?: string[] | null;
}

export interface TrendingQuote {
  symbol: string;
  price: number;
  change_pct: number;
  freshness: string;
  data_source: string;
}

export interface TrendingSymbol {
  symbol: string;
  posts: number;
  basis: 'community' | 'market_movement';
  price: number;
  change_pct: number;
  freshness: string;
  data_source: string;
}

const SYMBOL_ALIASES: Record<string, string[]> = {
  BTCUSD: ['BTCUSD', 'BTC/USD', 'BTC', 'BITCOIN'],
  ETHUSD: ['ETHUSD', 'ETH/USD', 'ETH', 'ETHEREUM'],
  SOLUSD: ['SOLUSD', 'SOL/USD', 'SOL', 'SOLANA'],
  XRPUSD: ['XRPUSD', 'XRP/USD', 'XRP'],
  ADAUSD: ['ADAUSD', 'ADA/USD', 'ADA', 'CARDANO'],
  DOTUSD: ['DOTUSD', 'DOT/USD', 'DOT', 'POLKADOT'],
  LINKUSD: ['LINKUSD', 'LINK/USD', 'LINK', 'CHAINLINK'],
  UNIUSD: ['UNIUSD', 'UNI/USD', 'UNI', 'UNISWAP'],
  DOGEUSD: ['DOGEUSD', 'DOGE/USD', 'DOGE', 'DOGECOIN'],
  AVAXUSD: ['AVAXUSD', 'AVAX/USD', 'AVAX', 'AVALANCHE'],
  EURUSD: ['EURUSD', 'EUR/USD'],
  GBPUSD: ['GBPUSD', 'GBP/USD'],
  USDJPY: ['USDJPY', 'USD/JPY'],
  AUDUSD: ['AUDUSD', 'AUD/USD'],
  USDCAD: ['USDCAD', 'USD/CAD'],
  NZDUSD: ['NZDUSD', 'NZD/USD'],
  USDCHF: ['USDCHF', 'USD/CHF'],
  EURGBP: ['EURGBP', 'EUR/GBP'],
  XAUUSD: ['XAUUSD', 'XAU/USD', 'GOLD'],
  XAGUSD: ['XAGUSD', 'XAG/USD', 'SILVER'],
  AAPL: ['AAPL'],
  NVDA: ['NVDA', 'NVIDIA'],
  TSLA: ['TSLA', 'TESLA'],
  MSFT: ['MSFT', 'MICROSOFT'],
  GOOGL: ['GOOGL', 'GOOGLE', 'ALPHABET'],
  AMZN: ['AMZN', 'AMAZON'],
  META: ['META'],
  AVGO: ['AVGO', 'BROADCOM'],
  INTC: ['INTC', 'INTEL'],
  QCOM: ['QCOM', 'QUALCOMM'],
  AMD: ['AMD'],
  LLY: ['LLY', 'ELI LILLY'],
  JNJ: ['JNJ', 'JOHNSON & JOHNSON'],
  WMT: ['WMT', 'WALMART'],
  CAT: ['CAT', 'CATERPILLAR'],
  GE: ['GE', 'GENERAL ELECTRIC'],
};

const AMBIGUOUS_SHORT_ALIASES = new Set(['ADA', 'SOL', 'DOT', 'LINK', 'UNI', 'META', 'CAT', 'GE']);

function normalizeTag(value: string): string {
  return value.trim().toUpperCase().replace(/^[$#]/, '').replace(/[^A-Z0-9/]/g, '');
}

function aliasPattern(alias: string): RegExp {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Z0-9])[$#]?${escaped}($|[^A-Z0-9])`, 'i');
}

function contentMentionsAlias(content: string, alias: string): boolean {
  if (!AMBIGUOUS_SHORT_ALIASES.has(alias)) return aliasPattern(alias).test(content);
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const uppercaseWord = new RegExp(`(^|[^A-Z0-9])${escaped}($|[^A-Z0-9])`);
  const taggedWord = new RegExp(`(^|[^A-Z0-9])[$#]${escaped}($|[^A-Z0-9])`, 'i');
  return uppercaseWord.test(content) || taggedWord.test(content);
}

export function countPostSymbolMentions(posts: TrendPost[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const post of posts) {
    const content = post.content ?? '';
    const tags = new Set((post.asset_tags ?? []).map(normalizeTag));
    for (const [symbol, aliases] of Object.entries(SYMBOL_ALIASES)) {
      const mentioned = aliases.some((alias) => tags.has(normalizeTag(alias)) || contentMentionsAlias(content, alias));
      if (mentioned) counts[symbol] = (counts[symbol] ?? 0) + 1;
    }
  }
  return counts;
}

export function buildTrendingSymbols(
  mentionCounts: Record<string, number>,
  quotes: Record<string, TrendingQuote>,
  limit = 5
): TrendingSymbol[] {
  const boundedLimit = Math.max(1, Math.min(limit, 10));
  const selected = new Set<string>();
  const result: TrendingSymbol[] = [];

  const discussed = Object.entries(mentionCounts)
    .filter(([, count]) => Number.isFinite(count) && count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  for (const [symbol, posts] of discussed) {
    const quote = quotes[symbol];
    if (!quote || !Number.isFinite(quote.price) || !Number.isFinite(quote.change_pct)) continue;
    selected.add(symbol);
    result.push({ ...quote, symbol, posts, basis: 'community' });
    if (result.length >= boundedLimit) return result;
  }

  const movers = Object.values(quotes)
    .filter((quote) => quote && Number.isFinite(quote.price) && Number.isFinite(quote.change_pct) && !selected.has(quote.symbol))
    .sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct) || a.symbol.localeCompare(b.symbol));

  for (const quote of movers) {
    result.push({ ...quote, posts: mentionCounts[quote.symbol] ?? 0, basis: 'market_movement' });
    if (result.length >= boundedLimit) break;
  }
  return result;
}

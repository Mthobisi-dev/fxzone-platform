export type DashboardMarket = 'all' | 'stock' | 'crypto' | 'forex' | 'commodity';
export type DashboardPriceFilter = 'all' | 'under_50' | 'from_50_to_200' | 'over_200';
export type DashboardChangeFilter = 'all' | 'gainers' | 'losers';

export interface DashboardQuote {
  price: number;
  change_pct: number;
  timestamp?: string;
  data_source?: string;
  freshness?: 'live' | 'delayed' | 'cached' | 'stale';
  is_live?: boolean;
  is_stale?: boolean;
}

export interface DashboardRow {
  id: string;
  symbol: string;
  name: string;
  assetType: string;
  quote: DashboardQuote | null;
}

export interface DashboardFilters {
  market: DashboardMarket;
  price: DashboardPriceFilter;
  change: DashboardChangeFilter;
  search: string;
}

function matchesPrice(quote: DashboardQuote, filter: DashboardPriceFilter): boolean {
  if (filter === 'under_50') return quote.price < 50;
  if (filter === 'from_50_to_200') return quote.price >= 50 && quote.price <= 200;
  if (filter === 'over_200') return quote.price > 200;
  return true;
}

function matchesChange(quote: DashboardQuote, filter: DashboardChangeFilter): boolean {
  if (filter === 'gainers') return quote.change_pct > 0;
  if (filter === 'losers') return quote.change_pct < 0;
  return true;
}

/** Filters only provider-supplied values; null quote rows remain transparent. */
export function filterMarketDashboardRows(rows: DashboardRow[], filters: DashboardFilters): DashboardRow[] {
  const search = filters.search.trim().toLowerCase();
  const hasNumericFilter = filters.price !== 'all' || filters.change !== 'all';

  return rows.filter((row) => {
    if (filters.market !== 'all' && row.assetType !== filters.market) return false;
    if (search && !row.symbol.toLowerCase().includes(search) && !row.name.toLowerCase().includes(search)) return false;
    if (!row.quote) return !hasNumericFilter;
    return matchesPrice(row.quote, filters.price) && matchesChange(row.quote, filters.change);
  });
}

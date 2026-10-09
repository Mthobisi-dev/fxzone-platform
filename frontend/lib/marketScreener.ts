export interface MarketScreenerAsset {
  id: string;
  symbol: string;
  name: string;
  asset_type: string;
  is_active: boolean;
}

export interface MarketScreenerQuote {
  symbol: string;
  price: number;
  change: number;
  change_pct: number;
  timestamp: string;
  data_source?: string;
  freshness?: 'live' | 'cached' | 'stale';
  is_stale?: boolean;
  is_live?: boolean;
}

export interface MarketScreenerRow {
  id: string;
  symbol: string;
  name: string;
  assetType: string;
  quote: MarketScreenerQuote | null;
}

/**
 * Joins the catalog with quotes without manufacturing a value for missing data.
 * A null quote is intentional: it lets the UI describe an unavailable provider
 * instead of rendering a sample number as a live market price.
 */
export function buildMarketScreenerRows(
  assets: MarketScreenerAsset[],
  prices: Record<string, MarketScreenerQuote>
): MarketScreenerRow[] {
  return assets
    .filter((asset) => asset.is_active)
    .map((asset) => ({
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      assetType: asset.asset_type,
      quote: prices[asset.symbol.toUpperCase()] ?? null,
    }));
}

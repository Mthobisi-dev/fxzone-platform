export type VerifiedMarketCategory = 'stock' | 'crypto' | 'forex' | 'commodity';

export interface MarketContextAsset {
  id: string;
  symbol: string;
  name: string;
  asset_type: string;
  is_active: boolean;
}

export interface MarketContextQuote {
  symbol: string;
  price: number;
  change_pct: number;
  timestamp: string;
  data_source?: string;
  freshness?: string;
  is_live?: boolean;
  is_stale?: boolean;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
}

export interface VerifiedMarketContextAsset extends MarketContextAsset {
  quote: MarketContextQuote | null;
}

export interface VerifiedMarketContextGroup {
  id: VerifiedMarketCategory;
  label: string;
  assets: VerifiedMarketContextAsset[];
  availableCount: number;
}

export interface PreferredAssetOption {
  id: string;
  symbol: string;
  name: string;
}

export interface PreferredAssetOptionGroup {
  id: VerifiedMarketCategory;
  label: string;
  options: PreferredAssetOption[];
}

export interface VerifiedAssetDetail {
  symbol: string;
  name: string;
  assetType: string;
  price: number | null;
  changePct: number | null;
  provider: string | null;
  freshness: string | null;
  timestamp: string | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
}

const CATEGORIES: Array<{ id: VerifiedMarketCategory; label: string }> = [
  { id: 'stock', label: 'US equities' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'forex', label: 'Forex' },
  { id: 'commodity', label: 'Metals' },
];

/**
 * Lists active catalogue instruments in the same category order as the market
 * context. The selector is catalogue-backed, so it cannot select retired or
 * client-invented assets.
 */
export function buildPreferredAssetOptions(
  assets: MarketContextAsset[]
): PreferredAssetOptionGroup[] {
  return CATEGORIES.map((category) => ({
    ...category,
    options: assets
      .filter((asset) => asset.is_active && asset.asset_type === category.id)
      .map(({ id, symbol, name }) => ({ id, symbol, name })),
  })).filter((category) => category.options.length > 0);
}

/**
 * Resolves a selection emitted by UI controls. Catalogue IDs are the primary
 * identifier; symbol support remains for existing links and chat actions.
 */
export function resolveMarketAssetSelection<T extends MarketContextAsset>(
  assets: T[],
  identifier: string
): T | undefined {
  const value = identifier.trim();
  if (!value) return undefined;

  return assets.find((asset) => asset.id === value)
    ?? assets.find((asset) => asset.symbol.toUpperCase() === value.toUpperCase());
}

/**
 * Joins the public asset catalogue with provider quotes in category order.
 * A missing quote remains null, so the UI can state that data is unavailable
 * rather than inventing a price or performance value.
 */
export function groupVerifiedMarketContext(
  assets: MarketContextAsset[],
  prices: Record<string, MarketContextQuote>
): VerifiedMarketContextGroup[] {
  return CATEGORIES.map((category) => {
    const categoryAssets = assets
      .filter((asset) => asset.is_active && asset.asset_type === category.id)
      .map((asset) => ({
        ...asset,
        quote: prices[asset.symbol.toUpperCase()] ?? null,
      }));

    return {
      ...category,
      assets: categoryAssets,
      availableCount: categoryAssets.filter((asset) => asset.quote !== null).length,
    };
  }).filter((category) => category.assets.length > 0);
}

/** Returns only fields that a provider supplied for the selected instrument. */
export function buildVerifiedAssetDetail(
  asset: MarketContextAsset,
  quote: MarketContextQuote | null
): VerifiedAssetDetail {
  return {
    symbol: asset.symbol,
    name: asset.name,
    assetType: asset.asset_type,
    price: quote?.price ?? null,
    changePct: quote?.change_pct ?? null,
    provider: quote?.data_source ?? null,
    freshness: quote?.freshness ?? null,
    timestamp: quote?.timestamp ?? null,
    open: quote?.open ?? null,
    high: quote?.high ?? null,
    low: quote?.low ?? null,
    volume: quote?.volume ?? null,
  };
}

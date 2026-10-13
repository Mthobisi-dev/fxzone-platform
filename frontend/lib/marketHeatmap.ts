import type { DashboardRow } from './marketDashboard';

export type MarketHeatTone = 'gain-strong' | 'gain' | 'loss' | 'loss-strong' | 'unavailable';
export type MarketHeatTileSize = 'feature' | 'standard';
export type MarketHeatSizeMetric = 'market_cap' | 'volume' | 'equal';
export type MarketHeatColorMetric = 'change_1d' | 'neutral';

export interface MarketHeatmapGroup {
  id: string;
  label: string;
  rows: DashboardRow[];
}

const MARKET_GROUPS = [
  { id: 'stock', label: 'US equities' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'forex', label: 'Forex' },
  { id: 'commodity', label: 'Metals' },
] as const;

/**
 * Groups the same provider-backed rows used by the screener. There is no
 * synthetic sector classification here: asset type is the only grouping that
 * exists in the current catalogue.
 */
export function groupMarketHeatmapRows(rows: DashboardRow[]): MarketHeatmapGroup[] {
  return MARKET_GROUPS
    .map((group) => ({
      ...group,
      rows: rows.filter((row) => row.assetType === group.id),
    }))
    .filter((group) => group.rows.length > 0);
}

/** Maps a real daily percentage move to a visual heat-map tone. */
export function marketHeatTone(changePct: number | null | undefined, metric: MarketHeatColorMetric = 'change_1d'): MarketHeatTone {
  if (metric === 'neutral') return 'unavailable';
  if (typeof changePct !== 'number' || !Number.isFinite(changePct)) return 'unavailable';
  if (changePct >= 2) return 'gain-strong';
  if (changePct > 0) return 'gain';
  if (changePct <= -2) return 'loss-strong';
  return 'loss';
}

/**
 * Sizes tiles only from the metric selected by the user. A missing market cap
 * stays standard rather than silently substituting a different value.
 */
export function marketHeatTileSize(
  row: Pick<DashboardRow, 'quote'>,
  largestComparableMetric: number,
  metric: MarketHeatSizeMetric = 'volume',
): MarketHeatTileSize {
  if (metric === 'equal') return 'standard';
  const value = metric === 'market_cap' ? row.quote?.market_cap : row.quote?.volume;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || largestComparableMetric <= 0) {
    return 'standard';
  }
  return value >= largestComparableMetric ? 'feature' : 'standard';
}

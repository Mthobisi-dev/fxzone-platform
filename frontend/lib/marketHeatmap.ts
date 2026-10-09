import type { DashboardRow } from './marketDashboard';

export type MarketHeatTone = 'gain-strong' | 'gain' | 'loss' | 'loss-strong' | 'unavailable';
export type MarketHeatTileSize = 'feature' | 'standard';

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
export function marketHeatTone(changePct: number | null | undefined): MarketHeatTone {
  if (typeof changePct !== 'number' || !Number.isFinite(changePct)) return 'unavailable';
  if (changePct >= 2) return 'gain-strong';
  if (changePct > 0) return 'gain';
  if (changePct <= -2) return 'loss-strong';
  return 'loss';
}

/**
 * Market-cap data is not available from the configured providers. A tile is
 * enlarged only when a comparable provider volume value is present, otherwise
 * the heat map keeps all instruments equal-sized.
 */
export function marketHeatTileSize(
  row: Pick<DashboardRow, 'quote'>,
  largestComparableVolume: number
): MarketHeatTileSize {
  const volume = row.quote?.volume;
  if (typeof volume !== 'number' || !Number.isFinite(volume) || volume <= 0 || largestComparableVolume <= 0) {
    return 'standard';
  }
  return volume >= largestComparableVolume ? 'feature' : 'standard';
}

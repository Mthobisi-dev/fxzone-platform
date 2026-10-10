import type { DashboardRow } from './marketDashboard';

export interface ScreenerListGroup {
  id: string;
  label: string;
  rows: DashboardRow[];
}

const LIST_CATEGORIES = [
  { id: 'stock', label: 'US equities' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'forex', label: 'Forex' },
  { id: 'commodity', label: 'Metals' },
] as const;

/**
 * Produces the list-mode sections from the same filtered provider-backed rows
 * used by the heat map. It keeps unavailable rows explicit instead of dropping
 * them or substituting a sample quote.
 */
export function groupScreenerListRows(rows: DashboardRow[]): ScreenerListGroup[] {
  return LIST_CATEGORIES.map((category) => ({
    ...category,
    rows: rows.filter((row) => row.assetType === category.id),
  })).filter((category) => category.rows.length > 0);
}

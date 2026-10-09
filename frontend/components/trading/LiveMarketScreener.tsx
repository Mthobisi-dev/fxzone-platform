'use client';

import { useEffect, useMemo, useState } from 'react';
import { Grid2X2, RefreshCw, Search, Settings2, Wifi, WifiOff } from 'lucide-react';
import { filterMarketDashboardRows, type DashboardChangeFilter, type DashboardPriceFilter } from '@/lib/marketDashboard';
import { groupMarketHeatmapRows, marketHeatTileSize, marketHeatTone, type MarketHeatTone } from '@/lib/marketHeatmap';
import { buildMarketScreenerRows } from '@/lib/marketScreener';
import { useMarketStore } from '@/stores/marketStore';
import { cn } from '@/lib/utils';

type MarketFilter = 'all' | 'stock' | 'crypto' | 'forex' | 'commodity';

const FILTERS: Array<{ value: MarketFilter; label: string }> = [
  { value: 'all', label: 'All markets' },
  { value: 'stock', label: 'US equities' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'forex', label: 'Forex' },
  { value: 'commodity', label: 'Metals' },
];

const TONE_CLASSES: Record<MarketHeatTone, string> = {
  'gain-strong': 'fxzone-heatmap-tile--gain-strong',
  gain: 'fxzone-heatmap-tile--gain',
  loss: 'fxzone-heatmap-tile--loss',
  'loss-strong': 'fxzone-heatmap-tile--loss-strong',
  unavailable: 'fxzone-heatmap-tile--unavailable',
};

function formatPrice(price: number): string {
  if (price >= 1_000) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 10) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 4 });
  return price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

function quoteQuality(quote: { freshness?: string; is_live?: boolean; is_stale?: boolean } | null): string {
  if (!quote) return 'Unavailable';
  if (quote.is_stale || quote.freshness === 'stale') return 'Stale';
  if (quote.freshness === 'delayed') return 'Delayed';
  if (quote.is_live || quote.freshness === 'live') return 'Live';
  return 'Cached';
}

function providerLabel(source?: string): string {
  if (source === 'coingecko') return 'CoinGecko';
  if (source === 'twelve_data') return 'Twelve Data';
  if (source === 'frankfurter') return 'Frankfurter';
  if (source === 'yahoo_finance') return 'Yahoo Finance';
  return 'Provider';
}

export function LiveMarketScreener() {
  const { assets, prices, error, isLoading, selectedAssetId, fetchAssets, fetchPrices, setSelectedAsset } = useMarketStore();
  const [filter, setFilter] = useState<MarketFilter>('stock');
  const [priceFilter, setPriceFilter] = useState<DashboardPriceFilter>('all');
  const [changeFilter, setChangeFilter] = useState<DashboardChangeFilter>('all');
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') void fetchPrices();
    };

    if (assets.length === 0) void fetchAssets();
    refresh();
    const intervalId = window.setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [assets.length, fetchAssets, fetchPrices]);

  const rows = useMemo(() => filterMarketDashboardRows(buildMarketScreenerRows(assets, prices), {
    market: filter,
    price: priceFilter,
    change: changeFilter,
    search,
  }), [assets, changeFilter, filter, priceFilter, prices, search]);

  const groups = useMemo(() => groupMarketHeatmapRows(rows), [rows]);
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const largestComparableVolume = useMemo(
    () => Math.max(0, ...rows.map((row) => row.quote?.volume ?? 0).filter((volume) => Number.isFinite(volume))),
    [rows]
  );
  const liveCount = rows.filter((row) => row.quote?.is_live).length;
  const delayedCount = rows.filter((row) => row.quote?.freshness === 'delayed').length;
  const unavailableCount = rows.filter((row) => !row.quote).length;
  const selectedSymbol = assets.find((asset) => asset.id === selectedAssetId)?.symbol;

  const refreshNow = async () => {
    setIsRefreshing(true);
    await fetchPrices();
    setIsRefreshing(false);
  };

  const resetFilters = () => {
    setFilter('stock');
    setPriceFilter('all');
    setChangeFilter('all');
    setSearch('');
  };

  const hasActiveFilters = filter !== 'stock' || priceFilter !== 'all' || changeFilter !== 'all' || Boolean(search.trim());

  return (
    <section className="fxzone-screener fxzone-heatmap overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[0_22px_60px_rgba(2,6,23,0.2)]">
      <header className="fxzone-heatmap-toolbar border-b border-[var(--color-border)] px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 items-center gap-2 pr-1">
            <Grid2X2 size={15} className="shrink-0 text-cyan-400" />
            <h1 className="truncate text-xs font-semibold tracking-tight text-[var(--color-text)] sm:text-sm">Stock screener</h1>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={cn(
                  'shrink-0 rounded border px-2 py-1 text-[10px] font-medium transition',
                  filter === item.value
                    ? 'border-cyan-400/65 bg-cyan-400/15 text-cyan-700 dark:text-cyan-200'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-cyan-400/45 hover:text-[var(--color-text)]'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void refreshNow()}
            aria-label="Refresh market data"
            className="grid h-7 w-7 shrink-0 place-items-center rounded border border-[var(--color-border)] text-[var(--color-text-muted)] transition hover:border-cyan-400 hover:text-cyan-500"
          >
            <RefreshCw size={13} className={cn(isRefreshing && 'animate-spin')} />
          </button>
        </div>

        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          <label className="fxzone-heatmap-filter">
            <span>Price:</span>
            <select value={priceFilter} onChange={(event) => setPriceFilter(event.target.value as DashboardPriceFilter)}>
              <option value="all">All</option>
              <option value="under_50">Under 50</option>
              <option value="from_50_to_200">50–200</option>
              <option value="over_200">Over 200</option>
            </select>
          </label>
          <label className="fxzone-heatmap-filter">
            <span>Chg %:</span>
            <select value={changeFilter} onChange={(event) => setChangeFilter(event.target.value as DashboardChangeFilter)}>
              <option value="all">All</option>
              <option value="gainers">Gainers</option>
              <option value="losers">Losers</option>
            </select>
          </label>
          <span className="fxzone-heatmap-filter" title="Market-cap data is not available from the current verified providers.">Mkt cap: unavailable</span>
          <span className="fxzone-heatmap-filter" title="Sector data is not available from the current verified providers.">Sector: asset class</span>
          <span className="fxzone-heatmap-filter">Size: provider volume</span>
          <span className="fxzone-heatmap-filter">Color: 1D % change</span>
          {hasActiveFilters && <button type="button" onClick={resetFilters} className="shrink-0 px-1 text-[10px] font-medium text-cyan-600 hover:underline dark:text-cyan-400">Reset</button>}
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-[var(--color-text-muted)]">
          <span className="truncate">{liveCount} live · {delayedCount} delayed · {unavailableCount} unavailable{selectedSymbol ? ` · selected ${selectedSymbol}` : ''}</span>
          <label className="flex min-w-0 w-36 shrink-0 items-center gap-1.5 rounded border border-[var(--color-border)] px-2 py-1 sm:w-48">
            <Search size={11} className="shrink-0" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              className="min-w-0 w-full bg-transparent text-[10px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
            />
          </label>
          <Settings2 size={13} className="hidden shrink-0 text-[var(--color-text-muted)] sm:block" aria-hidden="true" />
        </div>
      </header>

      {error && (
        <div role="status" className="border-b border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 sm:px-4">
          {error} Values are hidden until a provider responds.
        </div>
      )}

      <div className="p-2 sm:p-3">
        {isLoading && assets.length === 0 ? (
          <div className="grid min-h-[26rem] place-items-center text-sm text-[var(--color-text-muted)]">Loading market catalogue…</div>
        ) : groups.length === 0 ? (
          <div className="grid min-h-[26rem] place-items-center text-sm text-[var(--color-text-muted)]">No instruments match this filter.</div>
        ) : (
          <div className={cn('grid gap-2', groups.length > 1 && 'lg:grid-cols-2')}>
            {groups.map((group) => (
              <section key={group.id} className="fxzone-heatmap-group rounded-lg border border-[var(--color-border)] p-1.5">
                <div className="px-1 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{group.label}</div>
                <div className="grid auto-rows-[88px] grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                  {group.rows.map((row) => {
                    const quote = row.quote;
                    const asset = assetById.get(row.id);
                    const tone = marketHeatTone(quote?.change_pct);
                    const featured = marketHeatTileSize(row, largestComparableVolume) === 'feature';
                    const isSelected = selectedAssetId === row.id;
                    const positive = (quote?.change_pct ?? 0) >= 0;
                    const title = quote
                      ? `${providerLabel(quote.data_source)} · ${quoteQuality(quote)} · updated ${quote.timestamp ? new Date(quote.timestamp).toLocaleString() : 'time unavailable'}`
                      : `${row.symbol} is unavailable`;

                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => asset && setSelectedAsset(asset)}
                        aria-pressed={isSelected}
                        title={title}
                        className={cn(
                          'fxzone-heatmap-tile group relative min-w-0 overflow-hidden rounded p-2 text-left transition focus:outline-none focus:ring-2 focus:ring-cyan-400/80',
                          TONE_CLASSES[tone],
                          featured && 'col-span-2 row-span-2',
                          isSelected && 'ring-1 ring-cyan-300'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn('truncate font-semibold tracking-tight text-white', featured ? 'text-sm sm:text-base' : 'text-[11px]')}>
                            {row.symbol}
                          </p>
                          {quote ? <Wifi size={featured ? 14 : 11} className="shrink-0 text-white/65" /> : <WifiOff size={featured ? 14 : 11} className="shrink-0 text-white/45" />}
                        </div>
                        <p className={cn('mt-0.5 truncate text-white/70', featured ? 'text-[11px]' : 'text-[9px]')}>{row.name}</p>
                        {quote ? (
                          <div className="absolute inset-x-2 bottom-2 flex items-end justify-between gap-2">
                            <p className={cn('tabular-nums font-medium text-white', featured ? 'text-base' : 'text-[11px]')}>{formatPrice(quote.price)}</p>
                            <p className={cn('tabular-nums font-semibold text-white', featured ? 'text-sm' : 'text-[10px]')}>
                              {positive ? '+' : ''}{quote.change_pct.toFixed(2)}%
                            </p>
                          </div>
                        ) : (
                          <p className="absolute bottom-2 left-2 text-[10px] font-medium text-white/65">Unavailable</p>
                        )}
                        <span className="absolute right-1.5 top-1.5 rounded bg-black/15 px-1 py-0.5 text-[8px] font-medium uppercase tracking-wide text-white/75 opacity-0 transition group-hover:opacity-100">
                          {quote ? `${quoteQuality(quote)} · ${providerLabel(quote.data_source)}` : 'No quote'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

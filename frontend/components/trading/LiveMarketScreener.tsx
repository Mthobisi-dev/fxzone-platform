'use client';

import { useEffect, useMemo, useState } from 'react';
import { Grid2X2, List as ListIcon, RefreshCw, Search, Settings2, Wifi, WifiOff } from 'lucide-react';
import { filterMarketDashboardRows, type DashboardChangeFilter, type DashboardMarketCapFilter, type DashboardPriceFilter } from '@/lib/marketDashboard';
import { groupMarketHeatmapRows, marketHeatTileSize, marketHeatTone, type MarketHeatColorMetric, type MarketHeatSizeMetric, type MarketHeatTone } from '@/lib/marketHeatmap';
import { buildMarketScreenerRows } from '@/lib/marketScreener';
import { groupScreenerListRows } from '@/lib/marketScreenerView';
import { useMarketStore } from '@/stores/marketStore';
import { cn } from '@/lib/utils';

type MarketFilter = 'all' | 'stock' | 'crypto' | 'forex' | 'commodity';
type ScreenerView = 'heatmap' | 'list';

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
  const [marketCapFilter, setMarketCapFilter] = useState<DashboardMarketCapFilter>('all');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [sizeMetric, setSizeMetric] = useState<MarketHeatSizeMetric>('volume');
  const [colorMetric, setColorMetric] = useState<MarketHeatColorMetric>('change_1d');
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [view, setView] = useState<ScreenerView>('heatmap');

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
    marketCap: marketCapFilter,
    sector: sectorFilter,
    search,
  }), [assets, changeFilter, filter, marketCapFilter, priceFilter, prices, search, sectorFilter]);

  const groups = useMemo(() => groupMarketHeatmapRows(rows), [rows]);
  const listGroups = useMemo(() => groupScreenerListRows(rows), [rows]);
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const sectors = useMemo(
    () => Array.from(new Set(rows.map((row) => row.sector).filter((sector): sector is string => Boolean(sector)))).sort(),
    [rows]
  );
  const largestComparableMetric = useMemo(
    () => Math.max(0, ...rows.map((row) => sizeMetric === 'market_cap' ? row.quote?.market_cap ?? 0 : row.quote?.volume ?? 0).filter((value) => Number.isFinite(value))),
    [rows, sizeMetric]
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
    setMarketCapFilter('all');
    setSectorFilter('all');
    setSizeMetric('volume');
    setColorMetric('change_1d');
    setSearch('');
  };

  const hasActiveFilters = filter !== 'stock' || priceFilter !== 'all' || changeFilter !== 'all' || marketCapFilter !== 'all' || sectorFilter !== 'all' || sizeMetric !== 'volume' || colorMetric !== 'change_1d' || Boolean(search.trim());

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
          <div className="flex shrink-0 rounded border border-[var(--color-border)] p-0.5" role="group" aria-label="Screener layout">
            <button
              type="button"
              onClick={() => setView('heatmap')}
              aria-label="Show heat map"
              aria-pressed={view === 'heatmap'}
              title="Heat map"
              className={cn('grid h-6 w-6 place-items-center rounded transition', view === 'heatmap' ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-200' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]')}
            >
              <Grid2X2 size={12} />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              aria-label="Show list"
              aria-pressed={view === 'list'}
              title="List"
              className={cn('grid h-6 w-6 place-items-center rounded transition', view === 'list' ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-200' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]')}
            >
              <ListIcon size={13} />
            </button>
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
          <label className="fxzone-heatmap-filter">
            <span>Mkt cap:</span>
            <select value={marketCapFilter} onChange={(event) => setMarketCapFilter(event.target.value as DashboardMarketCapFilter)}>
              <option value="all">All</option>
              <option value="under_10b">Under 10B</option>
              <option value="from_10b_to_100b">10B–100B</option>
              <option value="over_100b">Over 100B</option>
              <option value="unavailable">Not supplied</option>
            </select>
          </label>
          <label className="fxzone-heatmap-filter">
            <span>Sector:</span>
            <select value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)}>
              <option value="all">All</option>
              {sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
            </select>
          </label>
          <label className="fxzone-heatmap-filter">
            <span>Size:</span>
            <select value={sizeMetric} onChange={(event) => setSizeMetric(event.target.value as MarketHeatSizeMetric)}>
              <option value="volume">Provider volume</option>
              <option value="market_cap">Market cap</option>
              <option value="equal">Equal tiles</option>
            </select>
          </label>
          <label className="fxzone-heatmap-filter">
            <span>Color:</span>
            <select value={colorMetric} onChange={(event) => setColorMetric(event.target.value as MarketHeatColorMetric)}>
              <option value="change_1d">1D % change</option>
              <option value="neutral">Neutral</option>
            </select>
          </label>
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
        ) : view === 'heatmap' ? (
          <div className={cn('grid gap-2', groups.length > 1 && 'lg:grid-cols-2')}>
            {groups.map((group) => (
              <section key={group.id} className="fxzone-heatmap-group rounded-lg border border-[var(--color-border)] p-1.5">
                <div className="px-1 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{group.label}</div>
                <div className="grid auto-rows-[88px] grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                  {group.rows.map((row) => {
                    const quote = row.quote;
                    const asset = assetById.get(row.id);
                    const tone = marketHeatTone(quote?.change_pct, colorMetric);
                    const featured = marketHeatTileSize(row, largestComparableMetric, sizeMetric) === 'feature';
                    const isSelected = selectedAssetId === row.id;
                    const positive = (quote?.change_pct ?? 0) >= 0;
                    const title = quote
                      ? `${providerLabel(quote.data_source)} · ${quoteQuality(quote)} · ${row.sector} · updated ${quote.timestamp ? new Date(quote.timestamp).toLocaleString() : 'time unavailable'}`
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
        ) : (
          <div className="space-y-2">
            {listGroups.map((group) => (
              <section key={group.id} className="overflow-hidden rounded-lg border border-[var(--color-border)]">
                <div className="border-b border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                  {group.label}
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  {group.rows.map((row) => {
                    const quote = row.quote;
                    const asset = assetById.get(row.id);
                    const isSelected = selectedAssetId === row.id;
                    const positive = (quote?.change_pct ?? 0) >= 0;
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => asset && setSelectedAsset(asset)}
                        aria-pressed={isSelected}
                        className={cn('grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2.5 text-left transition hover:bg-cyan-500/5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-400/70 sm:grid-cols-[minmax(0,1fr)_7rem_5.5rem_5rem]', isSelected && 'bg-cyan-500/10')}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-[var(--color-text)]">{row.symbol}</span>
                          <span className="block truncate text-[10px] text-[var(--color-text-muted)]">{row.name}</span>
                        </span>
                        <span className="hidden truncate text-right text-[10px] text-[var(--color-text-muted)] sm:block">{quote ? `${providerLabel(quote.data_source)} · ${quoteQuality(quote)}` : 'Unavailable'}</span>
                        <span className="text-right text-xs font-medium tabular-nums text-[var(--color-text)]">{quote ? formatPrice(quote.price) : 'Unavailable'}</span>
                        <span className={cn('text-right text-[11px] font-semibold tabular-nums', quote ? positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400' : 'text-[var(--color-text-muted)]')}>
                          {quote ? `${quote.change_pct > 0 ? '+' : ''}${quote.change_pct.toFixed(2)}%` : '—'}
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

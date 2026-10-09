'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Wifi, WifiOff } from 'lucide-react';
import { filterMarketDashboardRows, type DashboardChangeFilter, type DashboardPriceFilter } from '@/lib/marketDashboard';
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
  return 'Provider';
}

export function LiveMarketScreener() {
  const { assets, prices, error, isLoading, selectedAssetId, fetchAssets, fetchPrices, setSelectedAsset } = useMarketStore();
  const [filter, setFilter] = useState<MarketFilter>('all');
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

  const rows = useMemo(() => {
    return filterMarketDashboardRows(buildMarketScreenerRows(assets, prices), {
      market: filter,
      price: priceFilter,
      change: changeFilter,
      search,
    });
  }, [assets, changeFilter, filter, priceFilter, prices, search]);

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
    setFilter('all');
    setPriceFilter('all');
    setChangeFilter('all');
    setSearch('');
  };

  const hasActiveFilters = filter !== 'all' || priceFilter !== 'all' || changeFilter !== 'all' || Boolean(search.trim());

  return (
    <section className="fxzone-screener overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[0_20px_60px_rgba(4,11,23,0.16)]">
      <header className="border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-card)_92%,#020617)] px-3 py-3 sm:px-5 sm:py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.9)]" />
              <h1 className="text-sm font-semibold tracking-tight text-[var(--color-text)] sm:text-base">Stock screener</h1>
              <span className="hidden text-xs text-[var(--color-text-muted)] sm:inline">Provider-verified quotes</span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
              {liveCount} live · {delayedCount} delayed · {unavailableCount} unavailable
              {selectedSymbol ? ` · selected ${selectedSymbol}` : ''}
            </p>
          </div>

          <div className="flex w-full items-center gap-2 lg:w-auto">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-2 lg:w-60 lg:flex-none">
              <Search size={14} className="shrink-0 text-[var(--color-text-muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search symbol"
                className="min-w-0 w-full bg-transparent text-xs text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
              />
            </label>
            <button
              type="button"
              onClick={() => void refreshNow()}
              aria-label="Refresh market data"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] transition hover:border-blue-400 hover:text-blue-500"
            >
              <RefreshCw size={15} className={cn(isRefreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        <div className="mt-3 flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={cn(
                'shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition',
                filter === item.value
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          <label className="shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[10px] font-medium text-[var(--color-text-muted)]">
            <span>Price: </span>
            <select value={priceFilter} onChange={(event) => setPriceFilter(event.target.value as DashboardPriceFilter)} className="bg-transparent text-[var(--color-text)] outline-none">
              <option value="all">All</option>
              <option value="under_50">Under 50</option>
              <option value="from_50_to_200">50–200</option>
              <option value="over_200">Over 200</option>
            </select>
          </label>
          <label className="shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[10px] font-medium text-[var(--color-text-muted)]">
            <span>Chg %: </span>
            <select value={changeFilter} onChange={(event) => setChangeFilter(event.target.value as DashboardChangeFilter)} className="bg-transparent text-[var(--color-text)] outline-none">
              <option value="all">All</option>
              <option value="gainers">Gainers</option>
              <option value="losers">Losers</option>
            </select>
          </label>
          <span title="A verified company-fundamentals provider is required." className="shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[10px] text-[var(--color-text-muted)]">Mkt cap: feed required</span>
          <span title="A verified company-fundamentals provider is required." className="shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[10px] text-[var(--color-text-muted)]">Sector: feed required</span>
          <span className="shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[10px] text-[var(--color-text-muted)]">Size: Equal tiles</span>
          <span className="shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-[10px] text-[var(--color-text-muted)]">Color: 1D % change</span>
          {hasActiveFilters && <button type="button" onClick={resetFilters} className="shrink-0 rounded-md px-2 py-1.5 text-[10px] font-medium text-blue-600 hover:bg-blue-500/10 dark:text-blue-400">Reset</button>}
        </div>
      </header>

      {error && (
        <div role="status" className="border-b border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 sm:px-5">
          {error} Values are hidden until a provider responds.
        </div>
      )}

      <div className="p-2 sm:p-3">
        {isLoading && assets.length === 0 ? (
          <div className="grid min-h-72 place-items-center text-sm text-[var(--color-text-muted)]">Loading market catalogue…</div>
        ) : rows.length === 0 ? (
          <div className="grid min-h-72 place-items-center text-sm text-[var(--color-text-muted)]">No instruments match this filter.</div>
        ) : (
          <div className="grid auto-rows-[106px] grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 lg:grid-cols-5 xl:grid-cols-6">
            {rows.map((row) => {
              const quote = row.quote;
              const change = quote?.change_pct ?? null;
              const positive = change !== null && change >= 0;
              const asset = assets.find((item) => item.id === row.id);
              const isDelayed = quote?.freshness === 'delayed';
              const isSelected = selectedAssetId === row.id;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => asset && setSelectedAsset(asset)}
                  aria-pressed={isSelected}
                  title={quote ? `${providerLabel(quote.data_source)} · ${quoteQuality(quote)} · updated ${quote.timestamp ? new Date(quote.timestamp).toLocaleString() : 'time unavailable'}` : `${row.symbol} is unavailable`}
                  className={cn(
                    'group relative overflow-hidden rounded-lg border p-2.5 text-left transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/70',
                    isSelected && 'ring-1 ring-blue-400/80',
                    quote
                      ? positive
                        ? 'border-emerald-500/25 bg-emerald-500/[0.11] hover:border-emerald-400/60 hover:bg-emerald-500/[0.16]'
                        : 'border-rose-500/25 bg-rose-500/[0.11] hover:border-rose-400/60 hover:bg-rose-500/[0.16]'
                      : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-text-muted)]'
                  )}
                >
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-0 transition group-hover:opacity-100" />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold tracking-wide text-[var(--color-text)]">{row.symbol}</p>
                      <p className="mt-0.5 truncate text-[10px] text-[var(--color-text-muted)]">{row.name}</p>
                    </div>
                    {quote ? <Wifi size={13} className={isDelayed ? 'text-amber-500' : positive ? 'text-emerald-500' : 'text-rose-500'} /> : <WifiOff size={13} className="text-[var(--color-text-muted)]" />}
                  </div>
                  <div className="mt-3.5">
                    {quote ? (
                      <>
                        <p className="text-sm font-semibold tabular-nums text-[var(--color-text)]">{formatPrice(quote.price)}</p>
                        <p className={cn('mt-0.5 text-xs font-medium tabular-nums', positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                          {positive ? '+' : ''}{quote.change_pct.toFixed(2)}%
                        </p>
                      </>
                    ) : (
                      <p className="text-sm font-medium text-[var(--color-text-muted)]">Unavailable</p>
                    )}
                  </div>
                  <p className={cn('absolute bottom-2 right-2 text-[9px] font-medium uppercase tracking-wide', isDelayed ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--color-text-muted)]')}>
                    {quote ? `${quoteQuality(quote)} · ${providerLabel(quote.data_source)}` : quoteQuality(quote)}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Newspaper, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { groupVerifiedMarketContext, type VerifiedMarketCategory } from '@/lib/marketContext';
import { useMarketStore } from '@/stores/marketStore';
import { cn } from '@/lib/utils';
import { VerifiedAssetDetail } from './VerifiedAssetDetail';

interface NewsArticle {
  id: string;
  title: string;
  content: string;
  source: string;
  url: string | null;
  published_at: string | null;
  asset_tags: string[];
}

type ContextFilter = 'all' | VerifiedMarketCategory;

function providerLabel(source?: string): string {
  if (source === 'coingecko') return 'CoinGecko';
  if (source === 'twelve_data') return 'Twelve Data';
  if (source === 'frankfurter') return 'Frankfurter';
  if (source === 'yahoo_finance') return 'Yahoo Finance';
  return 'Provider unavailable';
}

function quoteQuality(quote: { freshness?: string; is_live?: boolean; is_stale?: boolean } | null): string {
  if (!quote) return 'Unavailable';
  if (quote.is_stale || quote.freshness === 'stale') return 'Stale';
  if (quote.freshness === 'delayed') return 'Delayed';
  if (quote.is_live || quote.freshness === 'live') return 'Live';
  return 'Cached';
}

function formatPrice(value: number | null): string {
  if (value === null) return 'Unavailable';
  if (Math.abs(value) >= 1_000) return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (Math.abs(value) >= 1) return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return value.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

function dateLabel(value: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return 'Time unavailable';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function readArticles(payload: unknown): NewsArticle[] {
  return Array.isArray(payload) ? payload as NewsArticle[] : [];
}

export function MarketResearchPanel() {
  const {
    assets,
    prices,
    selectedAsset,
    selectedAssetId,
    isLoading,
    fetchAssets,
    fetchPrices,
    setSelectedAsset,
  } = useMarketStore();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [activeCategory, setActiveCategory] = useState<ContextFilter>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setNewsError(null);
    const tasks: Array<Promise<unknown>> = [fetchPrices(), api.get('/api/news/feed', { params: { limit: 4 }, public: true })];
    if (assets.length === 0) tasks.unshift(fetchAssets());

    const results = await Promise.allSettled(tasks);
    const newsResult = results[results.length - 1];
    if (newsResult.status === 'fulfilled') {
      setArticles(readArticles(newsResult.value));
    } else {
      setArticles([]);
      setNewsError('Verified market news is temporarily unavailable.');
    }
    setIsRefreshing(false);
  }, [assets.length, fetchAssets, fetchPrices]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const groups = useMemo(() => groupVerifiedMarketContext(assets, prices), [assets, prices]);
  const visibleGroups = activeCategory === 'all' ? groups : groups.filter((group) => group.id === activeCategory);
  const activeAsset = selectedAssetId ? assets.find((asset) => asset.id === selectedAssetId) ?? selectedAsset : selectedAsset;
  const activeQuote = activeAsset ? prices[activeAsset.symbol.toUpperCase()] ?? null : null;
  const availableQuotes = useMemo(() => groups.reduce((total, group) => total + group.availableCount, 0), [groups]);

  return (
    <section className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-3 px-0.5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-600 dark:text-cyan-300">Research</p>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-text)] sm:text-lg">Verified market context</h2>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{availableQuotes}/{assets.length} instruments with a provider quote. Select an instrument for verified details.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isRefreshing}
          className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] transition hover:border-cyan-400 hover:text-cyan-500 disabled:opacity-60"
          aria-label="Refresh verified market context"
        >
          <RefreshCw size={15} className={cn(isRefreshing && 'animate-spin')} />
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]" aria-label="Verified market categories">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={cn('shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition', activeCategory === 'all' ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-700 dark:text-cyan-200' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-cyan-400/45 hover:text-[var(--color-text)]')}
        >
          All assets ({assets.length})
        </button>
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => setActiveCategory(group.id)}
            className={cn('shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition', activeCategory === group.id ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-700 dark:text-cyan-200' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-cyan-400/45 hover:text-[var(--color-text)]')}
          >
            {group.label} ({group.assets.length})
          </button>
        ))}
      </div>

      {isLoading && assets.length === 0 ? (
        <div className="grid min-h-44 place-items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-sm text-[var(--color-text-muted)]">Loading verified market catalogue…</div>
      ) : visibleGroups.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-sm text-[var(--color-text-muted)]">No verified instruments are available in this category.</div>
      ) : (
        <div className="space-y-3">
          {visibleGroups.map((group) => (
            <section key={group.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:p-3.5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[var(--color-text)]">{group.label}</h3>
                <span className="text-[11px] text-[var(--color-text-muted)]">{group.availableCount}/{group.assets.length} quoted</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {group.assets.map((asset) => {
                  const quote = asset.quote;
                  const positive = (quote?.change_pct ?? 0) >= 0;
                  const isSelected = activeAsset?.id === asset.id;
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setSelectedAsset(asset.id)}
                      aria-pressed={isSelected}
                      className={cn('min-w-0 rounded-lg border p-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-cyan-400/70', isSelected ? 'border-cyan-400/70 bg-cyan-500/10' : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-cyan-400/45')}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-xs font-semibold text-[var(--color-text)]">{asset.symbol}</p>
                        <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold', !quote ? 'bg-zinc-500/10 text-[var(--color-text-muted)]' : positive ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/10 text-rose-700 dark:text-rose-300')}>
                          {quoteQuality(quote)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[10px] text-[var(--color-text-muted)]">{asset.name}</p>
                      <div className="mt-3 flex items-end justify-between gap-2">
                        <p className="truncate text-xs font-semibold tabular-nums text-[var(--color-text)]">{formatPrice(quote?.price ?? null)}</p>
                        {quote && <p className={cn('text-[10px] font-semibold tabular-nums', positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>{quote.change_pct > 0 ? '+' : ''}{quote.change_pct.toFixed(2)}%</p>}
                      </div>
                      <p className="mt-2 truncate text-[9px] text-[var(--color-text-muted)]">{providerLabel(quote?.data_source)}{quote ? ` · ${quote.freshness ?? 'unavailable'}` : ''}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {activeAsset && <VerifiedAssetDetail asset={activeAsset} quote={activeQuote} />}

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3.5 sm:p-4">
        <div className="flex items-center gap-2">
          <Newspaper size={16} className="text-cyan-600 dark:text-cyan-300" />
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Verified market news</h2>
        </div>
        {newsError ? (
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">{newsError}</p>
        ) : articles.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">Loading verified provider articles…</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
            {articles.map((article) => (
              <article key={article.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <div className="flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                  <span className="truncate">{article.source}</span>
                  <span className="shrink-0 normal-case tracking-normal">{dateLabel(article.published_at)}</span>
                </div>
                <h3 className="mt-1.5 text-sm font-semibold leading-5 text-[var(--color-text)]">{article.title}</h3>
                {article.content && <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[var(--color-text-muted)]">{article.content}</p>}
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap gap-1">
                    {article.asset_tags.slice(0, 3).map((tag) => <span key={tag} className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-700 dark:text-cyan-200">{tag}</span>)}
                  </div>
                  {article.url && <a href={article.url} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-medium text-cyan-700 hover:underline dark:text-cyan-300">Source <ExternalLink className="ml-0.5 inline" size={11} /></a>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
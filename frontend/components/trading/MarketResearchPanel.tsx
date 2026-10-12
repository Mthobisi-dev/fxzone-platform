'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Newspaper } from 'lucide-react';
import { api } from '@/lib/api';
import { useMarketStore } from '@/stores/marketStore';
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

function dateLabel(value: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return 'Time unavailable';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function readArticles(payload: unknown): NewsArticle[] {
  return Array.isArray(payload) ? payload as NewsArticle[] : [];
}

/**
 * The dashboard is deliberately focused on the visitor's selected instrument.
 * Asset discovery remains available through the instrument picker, while the
 * large cross-market catalogue is kept out of the primary workspace.
 */
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
  const [newsError, setNewsError] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    setNewsError(null);

    const tasks: Array<Promise<unknown>> = [
      fetchPrices(),
      api.get('/api/news/feed', { params: { limit: 4 }, public: true }),
    ];
    if (assets.length === 0) tasks.unshift(fetchAssets());

    const results = await Promise.allSettled(tasks);
    const newsResult = results[results.length - 1];
    if (newsResult?.status === 'fulfilled') {
      setArticles(readArticles(newsResult.value));
      return;
    }

    setArticles([]);
    setNewsError('Verified market news is temporarily unavailable.');
  }, [assets.length, fetchAssets, fetchPrices]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWorkspace(), 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

  const activeAsset = selectedAssetId
    ? assets.find((asset) => asset.id === selectedAssetId) ?? selectedAsset
    : selectedAsset;
  const activeQuote = activeAsset ? prices[activeAsset.symbol.toUpperCase()] ?? null : null;

  return (
    <section className="space-y-3 sm:space-y-4">
      {activeAsset ? (
        <VerifiedAssetDetail
          asset={activeAsset}
          quote={activeQuote}
          assets={assets}
          onSelectAsset={setSelectedAsset}
        />
      ) : (
        <div className="grid min-h-44 place-items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-sm text-[var(--color-text-muted)]">
          {isLoading ? 'Loading selected instrument…' : 'No market instrument is currently available.'}
        </div>
      )}

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
                    {article.asset_tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-700 dark:text-cyan-200">{tag}</span>
                    ))}
                  </div>
                  {article.url && (
                    <a href={article.url} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-medium text-cyan-700 hover:underline dark:text-cyan-300">
                      Source <ExternalLink className="ml-0.5 inline" size={11} />
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

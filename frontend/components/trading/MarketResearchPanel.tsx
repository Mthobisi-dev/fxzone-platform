'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ExternalLink, Newspaper, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type InsightStatus = 'available' | 'insufficient_data' | 'unavailable';
type InsightDirection = 'up' | 'down' | 'flat' | 'unavailable';

interface MarketInsight {
  symbol: string;
  name: string;
  status: InsightStatus;
  direction: InsightDirection;
  price: number | null;
  changePct: number | null;
  timestamp: string | null;
  dataSource: string | null;
  freshness: string | null;
  summary: string;
  highlights: string[];
}

interface NewsArticle {
  id: string;
  title: string;
  content: string;
  source: string;
  url: string | null;
  published_at: string | null;
  asset_tags: string[];
}

function providerLabel(source: string | null): string {
  if (source === 'coingecko') return 'CoinGecko';
  if (source === 'twelve_data') return 'Twelve Data';
  if (source === 'frankfurter') return 'Frankfurter';
  if (source === 'yahoo_finance') return 'Yahoo Finance';
  return 'Provider unavailable';
}

function formatPrice(value: number | null): string {
  if (value === null) return 'Unavailable';
  if (value >= 1_000) return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value >= 1) return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return value.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

function dateLabel(value: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return 'Time unavailable';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function readInsights(payload: unknown): MarketInsight[] {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { insights?: unknown }).insights)) return [];
  return (payload as { insights: MarketInsight[] }).insights;
}

function readArticles(payload: unknown): NewsArticle[] {
  return Array.isArray(payload) ? payload as NewsArticle[] : [];
}

export function MarketResearchPanel() {
  const [insights, setInsights] = useState<MarketInsight[]>([]);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setInsightError(null);
    setNewsError(null);
    const [insightResult, newsResult] = await Promise.allSettled([
      api.get('/api/ai/insights', { public: true }),
      api.get('/api/news/feed', { params: { limit: 4 }, public: true }),
    ]);

    if (insightResult.status === 'fulfilled') setInsights(readInsights(insightResult.value));
    else {
      setInsights([]);
      setInsightError('Verified market research is temporarily unavailable.');
    }

    if (newsResult.status === 'fulfilled') setArticles(readArticles(newsResult.value));
    else {
      setArticles([]);
      setNewsError('Verified market news is temporarily unavailable.');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Deferring the initial request avoids a synchronous state update during
    // React's effect setup while retaining an immediate first load.
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  return (
    <section className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-3 px-0.5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-500">Research</p>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-text)] sm:text-lg">Verified market context</h2>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isLoading}
          className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] transition hover:border-blue-400 hover:text-blue-500 disabled:opacity-60"
          aria-label="Refresh market research"
        >
          <RefreshCw size={15} className={cn(isLoading && 'animate-spin')} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {isLoading && insights.length === 0 ? (
          <div className="col-span-full grid min-h-44 place-items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-sm text-[var(--color-text-muted)]">Loading verified research…</div>
        ) : insightError ? (
          <div className="col-span-full rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">{insightError}</div>
        ) : insights.map((insight) => {
          const expanded = expandedSymbol === insight.symbol;
          const positive = insight.direction === 'up';
          const negative = insight.direction === 'down';
          return (
            <article key={insight.symbol} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3.5 shadow-sm sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--color-text)]">{insight.symbol}</p>
                  <p className="truncate text-xs text-[var(--color-text-muted)]">{insight.name}</p>
                </div>
                <span className={cn(
                  'shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold',
                  positive && 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
                  negative && 'bg-rose-500/12 text-rose-700 dark:text-rose-300',
                  !positive && !negative && 'bg-[var(--color-bg)] text-[var(--color-text-muted)]'
                )}>
                  {insight.direction === 'up' ? 'Up today' : insight.direction === 'down' ? 'Down today' : insight.status === 'unavailable' ? 'Unavailable' : 'Flat'}
                </span>
              </div>

              <div className="mt-4 flex items-end justify-between gap-3">
                <p className="text-lg font-semibold tabular-nums text-[var(--color-text)]">{formatPrice(insight.price)}</p>
                {insight.changePct !== null && <p className={cn('text-xs font-semibold tabular-nums', positive ? 'text-emerald-600 dark:text-emerald-400' : negative ? 'text-rose-600 dark:text-rose-400' : 'text-[var(--color-text-muted)]')}>{insight.changePct > 0 ? '+' : ''}{insight.changePct.toFixed(2)}%</p>}
              </div>
              <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">{insight.summary}</p>
              <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-[var(--color-text-muted)]">
                <span className="truncate">{providerLabel(insight.dataSource)} · {insight.freshness ?? 'unavailable'}</span>
                <span className="shrink-0">{dateLabel(insight.timestamp)}</span>
              </div>

              <button
                type="button"
                onClick={() => setExpandedSymbol(expanded ? null : insight.symbol)}
                disabled={insight.highlights.length === 0}
                className="mt-3 flex w-full items-center justify-between rounded-lg border border-[var(--color-border)] px-2.5 py-2 text-xs font-medium text-[var(--color-text)] transition hover:border-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>{insight.highlights.length > 0 ? 'Details' : 'Historical data unavailable'}</span>
                <ChevronDown size={14} className={cn('transition-transform', expanded && 'rotate-180')} />
              </button>
              {expanded && (
                <ul className="mt-2 space-y-1.5 border-l-2 border-blue-500/50 pl-3 text-xs leading-5 text-[var(--color-text-muted)]">
                  {insight.highlights.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </article>
          );
        })}
      </div>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3.5 sm:p-4">
        <div className="flex items-center gap-2">
          <Newspaper size={16} className="text-blue-500" />
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Verified market news</h2>
        </div>
        {newsError ? (
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">{newsError}</p>
        ) : articles.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">No verified provider articles have been ingested yet.</p>
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
                    {article.asset_tags.slice(0, 3).map((tag) => <span key={tag} className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-700 dark:text-blue-300">{tag}</span>)}
                  </div>
                  {article.url && <a href={article.url} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">Source <ExternalLink className="ml-0.5 inline" size={11} /></a>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

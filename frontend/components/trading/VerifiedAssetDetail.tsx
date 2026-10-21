'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Clock3, Database, RefreshCw, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { buildPreferredAssetOptions, buildVerifiedAssetDetail } from '@/lib/marketContext';
import type { Asset, PriceData } from '@/stores/marketStore';
import { cn } from '@/lib/utils';
import { ChartIntervalId, SUPPORTED_CHART_INTERVALS } from '@/lib/chartIntervals';

type Timeframe = ChartIntervalId;

interface HistoricalCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

interface AssetExplanationResponse {
  source: 'ai_gateway' | 'verified_data';
  isAiGenerated: boolean;
  explanation: string;
  evidence: string[];
  research: Array<{
    id: 'market_snapshot' | 'technical_context' | 'data_quality';
    title: string;
    items: Array<{ label: string; value: string }>;
  }>;
  insight: {
    status: 'available' | 'insufficient_data' | 'unavailable';
  };
}

function providerLabel(source: string | null): string {
  if (source === 'coingecko') return 'CoinGecko';
  if (source === 'twelve_data') return 'Twelve Data';
  if (source === 'frankfurter') return 'Frankfurter';
  if (source === 'yahoo_finance') return 'Yahoo Finance';
  return 'Provider unavailable';
}

function qualityLabel(quote: PriceData | null): string {
  if (!quote) return 'Unavailable';
  if (quote.is_stale || quote.freshness === 'stale') return 'Stale';
  if (quote.freshness === 'delayed') return 'Delayed';
  if (quote.is_live || quote.freshness === 'live') return 'Live';
  return 'Cached';
}

function formatPrice(value: number | null): string {
  if (value === null) return 'Not supplied';
  if (Math.abs(value) >= 1_000) return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (Math.abs(value) >= 1) return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return value.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

function formatVolume(value: number | null): string {
  if (value === null) return 'Not supplied';
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 2 }).format(value);
}

function formatTime(value: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return 'Time unavailable';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function isCandle(value: unknown): value is HistoricalCandle {
  if (!value || typeof value !== 'object') return false;
  const candle = value as HistoricalCandle;
  return [candle.time, candle.open, candle.high, candle.low, candle.close]
    .every((field) => typeof field === 'number' && Number.isFinite(field));
}

function isAssetExplanation(value: unknown): value is AssetExplanationResponse {
  if (!value || typeof value !== 'object') return false;
  const response = value as Partial<AssetExplanationResponse>;
  return (
    (response.source === 'ai_gateway' || response.source === 'verified_data')
    && typeof response.isAiGenerated === 'boolean'
    && typeof response.explanation === 'string'
    && Array.isArray(response.evidence)
    && Array.isArray(response.research)
    && !!response.insight
    && ['available', 'insufficient_data', 'unavailable'].includes(response.insight.status)
  );
}

function historyPath(candles: HistoricalCandle[]): string | null {
  const closes = candles.map((candle) => candle.close).filter((value) => Number.isFinite(value));
  if (closes.length < 2) return null;

  const low = Math.min(...closes);
  const high = Math.max(...closes);
  const range = high - low || 1;

  return closes.map((close, index) => {
    const x = (index / (closes.length - 1)) * 100;
    const y = 40 - (((close - low) / range) * 38) - 1;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

function historyAreaPath(candles: HistoricalCandle[]): string | null {
  const line = historyPath(candles);
  if (!line) return null;
  return `M 0 40 L ${line.slice(1)} L 100 40 Z`;
}

export function VerifiedAssetDetail({
  asset,
  quote,
  assets,
  onSelectAsset,
}: {
  asset: Asset;
  quote: PriceData | null;
  assets: Asset[];
  onSelectAsset: (assetId: string) => void;
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [candles, setCandles] = useState<HistoricalCandle[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<AssetExplanationResponse | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(true);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const [explanationRefreshKey, setExplanationRefreshKey] = useState(0);
  const detail = buildVerifiedAssetDetail(asset, quote);
  const preferredAssetOptions = useMemo(() => buildPreferredAssetOptions(assets), [assets]);

  useEffect(() => {
    let active = true;

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      setHistoryError(null);
      try {
        const response = await api.get(`/api/market/prices/${asset.symbol}/history`, {
          params: { timeframe },
          public: true,
        });
        if (!active) return;
        setCandles(Array.isArray(response) ? response.filter(isCandle) : []);
      } catch {
        if (active) {
          setCandles([]);
          setHistoryError('Verified historical data is temporarily unavailable.');
        }
      } finally {
        if (active) setIsLoadingHistory(false);
      }
    };

    void loadHistory();
    return () => { active = false; };
  }, [asset.symbol, timeframe]);

  useEffect(() => {
    const controller = new AbortController();

    const loadExplanation = async () => {
      setIsLoadingExplanation(true);
      setExplanationError(null);
      setExplanation(null);

      try {
        const response = await api.get(`/api/market/explanation/${asset.symbol}`, {
          signal: controller.signal,
          timeoutMs: 10_000,
        });
        if (controller.signal.aborted) return;
        if (!isAssetExplanation(response)) throw new Error('Unexpected explanation response');
        setExplanation(response);
      } catch (error) {
        if (controller.signal.aborted) return;
        setExplanationError(
          error instanceof Error && /authentication|required|sign in/i.test(error.message)
            ? 'Sign in to load an AI research explanation for this instrument.'
            : 'An explanation is temporarily unavailable. The verified quote remains above.',
        );
      } finally {
        if (!controller.signal.aborted) setIsLoadingExplanation(false);
      }
    };

    void loadExplanation();
    return () => controller.abort();
  }, [asset.symbol, explanationRefreshKey]);

  const path = useMemo(() => historyPath(candles), [candles]);
  const areaPath = useMemo(() => historyAreaPath(candles), [candles]);
  const isPositive = (detail.changePct ?? 0) >= 0;

  return (
    <section className="overflow-hidden rounded-xl border border-cyan-500/25 bg-[var(--color-card)] shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] px-3.5 py-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-600 dark:text-cyan-300">Selected instrument</p>
          <div className="mt-1 flex min-w-0 items-baseline gap-2">
            <h3 className="truncate text-base font-semibold text-[var(--color-text)]">{detail.symbol}</h3>
            <span className="truncate text-xs text-[var(--color-text-muted)]">{detail.name}</span>
          </div>
          <label className="mt-2 block max-w-md">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Choose preferred asset</span>
            <select
              value={asset.id}
              onChange={(event) => onSelectAsset(event.target.value)}
              aria-label="Choose preferred market asset"
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-xs text-[var(--color-text)] outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            >
              {preferredAssetOptions.map((group) => (
                <optgroup key={group.id} label={group.label}>
                  {group.options.map((option) => (
                    <option key={option.id} value={option.id}>{option.symbol} — {option.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={cn(
            'rounded-full px-2 py-1 text-[10px] font-semibold',
            detail.price === null ? 'bg-zinc-500/10 text-[var(--color-text-muted)]' : isPositive ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
          )}>
            {qualityLabel(quote)}
          </span>
          <span className="rounded-full bg-[var(--color-bg)] px-2 py-1 text-[10px] font-medium text-[var(--color-text-muted)]">{detail.assetType}</span>
        </div>
      </header>

      <div className="grid gap-3 p-3.5 sm:grid-cols-[minmax(0,1.25fr)_minmax(15rem,0.75fr)] sm:p-4">
        <div className="min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Last provider quote</p>
              <p className="fx-data mt-1 text-xl font-semibold text-[var(--color-text)]">{formatPrice(detail.price)}</p>
            </div>
            {detail.changePct !== null && (
              <p className={cn('fx-data text-sm font-semibold', isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                {detail.changePct > 0 ? '+' : ''}{detail.changePct.toFixed(2)}%
              </p>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            {[
              ['Open', formatPrice(detail.open)],
              ['High', formatPrice(detail.high)],
              ['Low', formatPrice(detail.low)],
              ['Volume', formatVolume(detail.volume)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-[var(--color-border)] px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
                <p className="fx-data mt-0.5 truncate font-medium text-[var(--color-text)]">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-1"><Database size={12} className="text-cyan-600 dark:text-cyan-300" />{providerLabel(detail.provider)} · {detail.freshness ?? 'unavailable'}</span>
            <span className="inline-flex items-center gap-1"><Clock3 size={12} />{formatTime(detail.timestamp)}</span>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text)]"><BarChart3 size={14} className="text-cyan-600 dark:text-cyan-300" />Provider history</div>
            <div className="flex max-w-full overflow-x-auto rounded-md border border-[var(--color-border)] p-0.5">
              {SUPPORTED_CHART_INTERVALS.map(({ id: value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTimeframe(value)}
                  className={cn('rounded px-2 py-1 text-[10px] font-medium transition', timeframe === value ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-200' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 grid min-h-24 place-items-center">
            {isLoadingHistory ? (
              <RefreshCw size={16} className="animate-spin text-cyan-600 dark:text-cyan-300" aria-label="Loading verified history" />
            ) : historyError ? (
              <p className="text-center text-xs leading-5 text-amber-700 dark:text-amber-300">{historyError}</p>
            ) : path && areaPath ? (
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-24 w-full" role="img" aria-label={`${asset.symbol} verified ${timeframe} provider history area chart`}>
                <defs>
                  <linearGradient id={`history-area-${asset.symbol}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <path d={areaPath} fill={`url(#history-area-${asset.symbol})`} stroke="none" />
                <path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" vectorEffect="non-scaling-stroke" className={isPositive ? 'text-emerald-500' : 'text-rose-500'} />
              </svg>
            ) : (
              <p className="text-center text-xs leading-5 text-[var(--color-text-muted)]">No verified historical candles are available for this interval.</p>
            )}
          </div>
          {!isLoadingHistory && !historyError && candles.length > 0 && <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">{candles.length} verified OHLC candles · {timeframe.toUpperCase()} interval</p>}
        </div>
      </div>

      <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)]/60 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles size={15} className="shrink-0 text-cyan-600 dark:text-cyan-300" aria-hidden="true" />
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-[var(--color-text)]">AI research explanation</h4>
              <p className="mt-0.5 text-[11px] leading-4 text-[var(--color-text-muted)]">Grounded in the selected instrument&apos;s provider quote and calculated indicators.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'rounded-full px-2 py-1 text-[10px] font-semibold',
              explanation?.isAiGenerated
                ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300'
                : 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
            )}>
              {explanation?.isAiGenerated ? 'AI-generated explanation' : 'Verified-data briefing'}
            </span>
            <button
              type="button"
              onClick={() => setExplanationRefreshKey((key) => key + 1)}
              disabled={isLoadingExplanation}
              aria-label="Refresh selected instrument explanation"
              className="grid size-7 place-items-center rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] transition hover:border-cyan-400 hover:text-cyan-700 disabled:cursor-wait disabled:opacity-60 dark:hover:text-cyan-300"
            >
              <RefreshCw size={13} className={isLoadingExplanation ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5">
          {isLoadingExplanation ? (
            <p className="text-xs leading-5 text-[var(--color-text-muted)]">Preparing the latest verified-data briefing…</p>
          ) : explanationError ? (
            <p className="text-xs leading-5 text-amber-700 dark:text-amber-300">{explanationError}</p>
          ) : (
            <>
              {explanation && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Research details</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {explanation.research.map((section) => (
                      <section key={section.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
                        <h5 className="text-[10px] font-semibold text-[var(--color-text)]">{section.title}</h5>
                        <dl className="mt-1.5 space-y-1.5">
                          {section.items.map((item) => (
                            <div key={`${item.label}-${item.value}`}>
                              <dt className="text-[9px] uppercase tracking-wide text-[var(--color-text-muted)]">{item.label}</dt>
                              <dd className="mt-0.5 text-[10px] leading-4 text-[var(--color-text)]">{item.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </section>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs leading-5 text-[var(--color-text)]">{explanation?.explanation}</p>
              {explanation && explanation.evidence.length > 0 && (
                <p className="mt-2 text-[11px] leading-4 text-[var(--color-text-muted)]">Evidence used: {explanation.evidence.join(' ')}</p>
              )}
            </>
          )}
        </div>
        <p className="mt-2 text-[10px] leading-4 text-[var(--color-text-muted)]">AI wording is optional and never replaces provider data or calculated indicators. It is research context, not investment advice.</p>
      </div>
    </section>
  );
}

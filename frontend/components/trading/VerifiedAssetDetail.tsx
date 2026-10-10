'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Clock3, Database, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { buildVerifiedAssetDetail } from '@/lib/marketContext';
import type { Asset, PriceData } from '@/stores/marketStore';
import { cn } from '@/lib/utils';

type Timeframe = '1h' | '1d';

interface HistoricalCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
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

export function VerifiedAssetDetail({ asset, quote }: { asset: Asset; quote: PriceData | null }) {
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [candles, setCandles] = useState<HistoricalCandle[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const detail = buildVerifiedAssetDetail(asset, quote);

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

  const path = useMemo(() => historyPath(candles), [candles]);
  const isPositive = (detail.changePct ?? 0) >= 0;

  return (
    <section className="overflow-hidden rounded-xl border border-cyan-500/25 bg-[var(--color-card)] shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] px-3.5 py-3 sm:px-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-600 dark:text-cyan-300">Selected instrument</p>
          <div className="mt-1 flex min-w-0 items-baseline gap-2">
            <h3 className="truncate text-base font-semibold text-[var(--color-text)]">{detail.symbol}</h3>
            <span className="truncate text-xs text-[var(--color-text-muted)]">{detail.name}</span>
          </div>
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
              <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--color-text)]">{formatPrice(detail.price)}</p>
            </div>
            {detail.changePct !== null && (
              <p className={cn('text-sm font-semibold tabular-nums', isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
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
                <p className="mt-0.5 truncate font-medium tabular-nums text-[var(--color-text)]">{value}</p>
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
            <div className="flex rounded-md border border-[var(--color-border)] p-0.5">
              {(['1h', '1d'] as Timeframe[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTimeframe(value)}
                  className={cn('rounded px-2 py-1 text-[10px] font-medium transition', timeframe === value ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-200' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]')}
                >
                  {value.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 grid min-h-24 place-items-center">
            {isLoadingHistory ? (
              <RefreshCw size={16} className="animate-spin text-cyan-600 dark:text-cyan-300" aria-label="Loading verified history" />
            ) : historyError ? (
              <p className="text-center text-xs leading-5 text-amber-700 dark:text-amber-300">{historyError}</p>
            ) : path ? (
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-24 w-full" role="img" aria-label={`${asset.symbol} verified ${timeframe} closing-price history`}>
                <path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" vectorEffect="non-scaling-stroke" className={isPositive ? 'text-emerald-500' : 'text-rose-500'} />
              </svg>
            ) : (
              <p className="text-center text-xs leading-5 text-[var(--color-text-muted)]">No verified historical candles are available for this interval.</p>
            )}
          </div>
          {!isLoadingHistory && !historyError && candles.length > 0 && <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">{candles.length} verified OHLC candles · {timeframe.toUpperCase()} interval</p>}
        </div>
      </div>
    </section>
  );
}

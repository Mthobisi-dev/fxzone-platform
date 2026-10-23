'use client';

import { ExternalLink, LineChart } from 'lucide-react';
import { useMemo } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { getTradingViewChartSymbol, getTradingViewChartUrl } from '@/lib/tradingView';

export const LIVE_CHART_SYMBOLS = [
  { symbol: 'BTCUSD', label: 'BTC/USD' },
  { symbol: 'ETHUSD', label: 'ETH/USD' },
  { symbol: 'NVDA', label: 'NVDA' },
  { symbol: 'AAPL', label: 'AAPL' },
  { symbol: 'EURUSD', label: 'EUR/USD' },
  { symbol: 'GBPUSD', label: 'GBP/USD' },
  { symbol: 'XAUUSD', label: 'Gold / USD' },
  { symbol: 'XAGUSD', label: 'Silver / USD' },
] as const;

const LIVE_CHART_INTERVALS = [
  { value: '1', label: '1m' },
  { value: '5', label: '5m' },
  { value: '15', label: '15m' },
  { value: '60', label: '1h' },
  { value: 'D', label: '1D' },
] as const;

export interface LiveChartContext {
  symbol: string;
  interval: string;
}

interface TradingViewLiveChartProps {
  context: LiveChartContext;
  isHost: boolean;
  onContextChange: (context: LiveChartContext) => void;
}

export function TradingViewLiveChart({ context, isHost, onContextChange }: TradingViewLiveChartProps) {
  const { isDark } = useTheme();
  const qualifiedSymbol = getTradingViewChartSymbol(context.symbol) ?? 'COINBASE:BTCUSD';
  const chartUrl = getTradingViewChartUrl(context.symbol);
  const widgetUrl = useMemo(() => {
    const query = new URLSearchParams({
      symbol: qualifiedSymbol,
      interval: context.interval,
      theme: isDark ? 'dark' : 'light',
      style: '1',
      locale: 'en',
      timezone: 'Etc/UTC',
      hide_top_toolbar: '0',
      hide_side_toolbar: '0',
      hide_legend: '0',
      allow_symbol_change: isHost ? '1' : '0',
      save_image: '0',
    });
    return `https://www.tradingview.com/widgetembed/?${query.toString()}`;
  }, [context.interval, isDark, isHost, qualifiedSymbol]);

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--fx-border-subtle)] bg-[var(--fx-bg-surface)] shadow-lg" aria-label="Live TradingView chart">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--fx-border-subtle)] px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <LineChart size={15} className="shrink-0 text-[var(--fx-accent)]" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="truncate text-xs font-semibold text-[var(--fx-text-strong)]">Live chart view</h3>
            <p className="truncate text-[10px] text-[var(--fx-text-muted)]">TradingView · {context.symbol} · {context.interval === 'D' ? '1D' : `${context.interval}m`}</p>
          </div>
        </div>
        {chartUrl && (
          <a
            href={chartUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[var(--fx-border-subtle)] px-2.5 text-[10px] font-semibold text-[var(--fx-text-muted)] transition hover:border-[var(--fx-accent)] hover:text-[var(--fx-text-strong)]"
          >
            Open TradingView <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--fx-border-subtle)] px-3 py-2">
        <label className="sr-only" htmlFor="live-session-chart-symbol">Chart asset</label>
        <select
          id="live-session-chart-symbol"
          value={context.symbol}
          disabled={!isHost}
          onChange={(event) => onContextChange({ ...context, symbol: event.target.value })}
          className="min-h-9 rounded-md border border-[var(--fx-border-subtle)] bg-[var(--fx-bg-canvas)] px-2 text-[10px] font-semibold text-[var(--fx-text-strong)] outline-none focus:border-[var(--fx-accent)] disabled:cursor-not-allowed disabled:opacity-70"
          aria-label={isHost ? 'Choose live chart asset' : 'Live chart asset selected by host'}
        >
          {LIVE_CHART_SYMBOLS.map((item) => <option key={item.symbol} value={item.symbol}>{item.label}</option>)}
        </select>
        <div className="flex max-w-full overflow-x-auto rounded-md border border-[var(--fx-border-subtle)] p-0.5" aria-label="Live chart interval">
          {LIVE_CHART_INTERVALS.map((item) => (
            <button
              key={item.value}
              type="button"
              disabled={!isHost}
              aria-pressed={context.interval === item.value}
              onClick={() => onContextChange({ ...context, interval: item.value })}
              className={`min-h-8 rounded px-2 text-[10px] font-semibold transition ${context.interval === item.value ? 'bg-[var(--fx-accent)]/15 text-[var(--fx-accent)]' : 'text-[var(--fx-text-muted)] hover:text-[var(--fx-text-strong)]'} disabled:cursor-not-allowed disabled:opacity-70`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="aspect-[16/8] min-h-48 w-full bg-black/10 sm:min-h-56">
        <iframe
          key={widgetUrl}
          title={`${context.symbol} live TradingView chart`}
          src={widgetUrl}
          className="h-full w-full border-0"
          loading="lazy"
          allow="fullscreen"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>

      <p className="border-t border-[var(--fx-border-subtle)] px-3 py-2 text-[10px] leading-4 text-[var(--fx-text-muted)]">
        {isHost
          ? 'Choose an asset and interval, then use Share screen and select Entire Screen or this browser tab so viewers can follow your chart discussion.'
          : 'The host controls the shared chart view. Use the broadcast screen to follow the host’s current asset and interval.'}
      </p>
    </section>
  );
}

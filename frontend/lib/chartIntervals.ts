export const SUPPORTED_CHART_INTERVALS = [
  { id: '1m', label: '1m', provider: '1m' },
  { id: '5m', label: '5m', provider: '5m' },
  { id: '15m', label: '15m', provider: '15m' },
  { id: '1h', label: '1H', provider: '1h' },
  { id: '4h', label: '4H', provider: '4h' },
  { id: '1d', label: '1D', provider: '1d' },
] as const;

export type ChartIntervalId = typeof SUPPORTED_CHART_INTERVALS[number]['id'];

export function isSupportedChartInterval(value: unknown): value is ChartIntervalId {
  return SUPPORTED_CHART_INTERVALS.some((interval) => interval.id === value);
}

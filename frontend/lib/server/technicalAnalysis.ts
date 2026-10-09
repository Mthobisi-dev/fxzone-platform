export interface TechnicalCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export type TechnicalAnalysis =
  | { status: 'insufficient_data' }
  | {
    status: 'available';
    sma20: number;
    ema20: number;
    rsi14: number;
    macd: number;
    macdSignal: number;
    macdHistogram: number;
    atr14: number;
    support20: number;
    resistance20: number;
  };

const SMA_PERIOD = 20;
const RSI_PERIOD = 14;
const ATR_PERIOD = 14;
const MACD_FAST_PERIOD = 12;
const MACD_SLOW_PERIOD = 26;
const MACD_SIGNAL_PERIOD = 9;
const MINIMUM_CANDLE_COUNT = MACD_SLOW_PERIOD + MACD_SIGNAL_PERIOD - 1;

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function emaSeries(values: number[], period: number): number[] {
  if (values.length < period) return [];

  const multiplier = 2 / (period + 1);
  let value = mean(values.slice(0, period));
  const series = [value];
  for (let index = period; index < values.length; index += 1) {
    value = ((values[index] - value) * multiplier) + value;
    series.push(value);
  }
  return series;
}

function lastEma(values: number[], period: number): number | null {
  const series = emaSeries(values, period);
  return series.length > 0 ? series[series.length - 1] : null;
}

function rsi(values: number[], period: number): number | null {
  if (values.length <= period) return null;

  let averageGain = 0;
  let averageLoss = 0;
  for (let index = 1; index <= period; index += 1) {
    const change = values[index] - values[index - 1];
    if (change >= 0) averageGain += change;
    else averageLoss += Math.abs(change);
  }
  averageGain /= period;
  averageLoss /= period;

  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    averageGain = ((averageGain * (period - 1)) + gain) / period;
    averageLoss = ((averageLoss * (period - 1)) + loss) / period;
  }

  if (averageLoss === 0) return 100;
  if (averageGain === 0) return 0;
  return 100 - (100 / (1 + (averageGain / averageLoss)));
}

function atr(candles: TechnicalCandle[], period: number): number | null {
  if (candles.length < period) return null;

  const ranges = candles.map((candle, index) => {
    if (index === 0) return candle.high - candle.low;
    const previousClose = candles[index - 1].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    );
  });

  let averageRange = mean(ranges.slice(0, period));
  for (let index = period; index < ranges.length; index += 1) {
    averageRange = ((averageRange * (period - 1)) + ranges[index]) / period;
  }
  return averageRange;
}

function macd(values: number[]): { line: number; signal: number; histogram: number } | null {
  if (values.length < MINIMUM_CANDLE_COUNT) return null;

  const fast = emaSeries(values, MACD_FAST_PERIOD);
  const slow = emaSeries(values, MACD_SLOW_PERIOD);
  const offset = MACD_SLOW_PERIOD - MACD_FAST_PERIOD;
  const line = slow.map((slowValue, index) => fast[index + offset] - slowValue);
  const signal = lastEma(line, MACD_SIGNAL_PERIOD);
  const latestLine = line[line.length - 1];
  if (signal === null || latestLine === undefined) return null;
  return { line: latestLine, signal, histogram: latestLine - signal };
}

/**
 * Calculates technical values from provider-supplied OHLC candles. No values
 * are inferred from a single quote: callers receive insufficient_data instead.
 */
export function calculateTechnicalAnalysis(candles: TechnicalCandle[]): TechnicalAnalysis {
  if (candles.length < MINIMUM_CANDLE_COUNT) return { status: 'insufficient_data' };

  const closes = candles.map((candle) => candle.close);
  const sma20 = mean(closes.slice(-SMA_PERIOD));
  const ema20 = lastEma(closes, SMA_PERIOD);
  const rsi14 = rsi(closes, RSI_PERIOD);
  const atr14 = atr(candles, ATR_PERIOD);
  const macdValues = macd(closes);
  const recentCandles = candles.slice(-SMA_PERIOD);
  const support20 = Math.min(...recentCandles.map((candle) => candle.low));
  const resistance20 = Math.max(...recentCandles.map((candle) => candle.high));

  if (ema20 === null || rsi14 === null || atr14 === null || macdValues === null) {
    return { status: 'insufficient_data' };
  }

  return {
    status: 'available',
    sma20,
    ema20,
    rsi14,
    macd: macdValues.line,
    macdSignal: macdValues.signal,
    macdHistogram: macdValues.histogram,
    atr14,
    support20,
    resistance20,
  };
}

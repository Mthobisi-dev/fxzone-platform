"""Technical indicators (pure functions, no I/O). Series helpers return lists aligned with the input,
with None during the warm-up period."""
from __future__ import annotations

from math import sqrt
from typing import Sequence

Number = float


def sma(values: Sequence[Number], period: int) -> list[Number | None]:
    out: list[Number | None] = [None] * len(values)
    if period <= 0 or len(values) < period:
        return out
    window = sum(values[:period])
    out[period - 1] = window / period
    for i in range(period, len(values)):
        window += values[i] - values[i - period]
        out[i] = window / period
    return out


def ema(values: Sequence[Number], period: int) -> list[Number | None]:
    """EMA seeded with the SMA of the first `period` values (the usual charting convention)."""
    out: list[Number | None] = [None] * len(values)
    if period <= 0 or len(values) < period:
        return out
    k = 2 / (period + 1)
    prev = sum(values[:period]) / period
    out[period - 1] = prev
    for i in range(period, len(values)):
        prev = values[i] * k + prev * (1 - k)
        out[i] = prev
    return out


def rsi(values: Sequence[Number], period: int = 14) -> list[Number | None]:
    """Wilder's RSI."""
    out: list[Number | None] = [None] * len(values)
    if len(values) <= period:
        return out
    gains = losses = 0.0
    for i in range(1, period + 1):
        change = values[i] - values[i - 1]
        gains += max(change, 0.0)
        losses += max(-change, 0.0)
    avg_gain, avg_loss = gains / period, losses / period

    def value(g: float, l: float) -> float:
        if l == 0:
            return 100.0 if g > 0 else 50.0
        return 100 - 100 / (1 + g / l)

    out[period] = value(avg_gain, avg_loss)
    for i in range(period + 1, len(values)):
        change = values[i] - values[i - 1]
        avg_gain = (avg_gain * (period - 1) + max(change, 0.0)) / period
        avg_loss = (avg_loss * (period - 1) + max(-change, 0.0)) / period
        out[i] = value(avg_gain, avg_loss)
    return out


def macd(values: Sequence[Number], fast: int = 12, slow: int = 26, signal: int = 9):
    """Returns (macd_line, signal_line, histogram) series."""
    fast_e, slow_e = ema(values, fast), ema(values, slow)
    line: list[Number | None] = [
        (f - s) if f is not None and s is not None else None for f, s in zip(fast_e, slow_e)]
    first = next((i for i, v in enumerate(line) if v is not None), None)
    sig: list[Number | None] = [None] * len(values)
    hist: list[Number | None] = [None] * len(values)
    if first is not None:
        tail = [v for v in line[first:] if v is not None]
        tail_sig = ema(tail, signal)
        for offset, s in enumerate(tail_sig):
            i = first + offset
            sig[i] = s
            if s is not None and line[i] is not None:
                hist[i] = line[i] - s  # type: ignore[operator]
    return line, sig, hist


def bollinger(values: Sequence[Number], period: int = 20, deviations: float = 2.0):
    """Returns (middle, upper, lower) series using population standard deviation."""
    mid = sma(values, period)
    upper: list[Number | None] = [None] * len(values)
    lower: list[Number | None] = [None] * len(values)
    for i in range(period - 1, len(values)):
        window = values[i - period + 1: i + 1]
        m = mid[i]
        assert m is not None
        sd = sqrt(sum((v - m) ** 2 for v in window) / period)
        upper[i], lower[i] = m + deviations * sd, m - deviations * sd
    return mid, upper, lower


def atr(highs: Sequence[Number], lows: Sequence[Number], closes: Sequence[Number], period: int = 14):
    """Wilder's Average True Range."""
    n = len(closes)
    out: list[Number | None] = [None] * n
    if n <= period:
        return out
    tr = [highs[0] - lows[0]]
    for i in range(1, n):
        tr.append(max(highs[i] - lows[i], abs(highs[i] - closes[i - 1]), abs(lows[i] - closes[i - 1])))
    prev = sum(tr[1: period + 1]) / period
    out[period] = prev
    for i in range(period + 1, n):
        prev = (prev * (period - 1) + tr[i]) / period
        out[i] = prev
    return out


def last(series: Sequence[Number | None]) -> Number | None:
    for v in reversed(series):
        if v is not None:
            return v
    return None

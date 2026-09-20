import pytest

from app.services.market import indicators as ind
from app.services.market.catalog import detect_symbols
from app.services.market.service import aggregate_bars

# Classic Wilder RSI worked example (StockCharts "RSI" chart-school data)
WILDER = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28,
          46.00, 46.03, 46.41, 46.22, 45.64, 46.21, 46.25, 45.71, 46.45, 45.78, 45.35, 44.03, 44.18, 44.22, 44.57,
          43.42, 42.66, 43.13]
# The figures published with that example (70.53, 66.32, ...) were computed from intermediate averages rounded to 2
# decimals, so they drift up to ~0.07 from the exact result. We therefore verify against an exact oracle and only
# sanity-check the published numbers loosely.
PUBLISHED = [70.53, 66.32, 66.55, 69.41, 66.36, 57.97, 62.93, 63.26, 56.06, 62.38, 54.71, 50.42, 39.99, 41.46,
             41.87, 45.46, 37.30, 33.08, 37.77]


def exact_wilder_rsi(closes, period=14):
    """Independent oracle: textbook Wilder RSI in exact rational arithmetic (shares no code with the implementation)."""
    from fractions import Fraction
    c = [Fraction(str(x)) for x in closes]
    ch = [c[i] - c[i - 1] for i in range(1, len(c))]
    g, l = [max(x, 0) for x in ch], [max(-x, 0) for x in ch]
    ag, al = sum(g[:period]) / period, sum(l[:period]) / period
    out = [float(100 - 100 / (1 + ag / al))]
    for i in range(period, len(ch)):
        ag, al = (ag * (period - 1) + g[i]) / period, (al * (period - 1) + l[i]) / period
        out.append(float(100 - 100 / (1 + ag / al)))
    return out


def test_rsi_matches_exact_oracle():
    out = [v for v in ind.rsi(WILDER, 14) if v is not None]
    assert out == pytest.approx(exact_wilder_rsi(WILDER), abs=1e-9)


def test_rsi_is_close_to_published_reference_values():
    out = [v for v in ind.rsi(WILDER, 14) if v is not None]
    assert len(out) == len(PUBLISHED)
    assert out == pytest.approx(PUBLISHED, abs=0.15)


def test_rsi_bounds_and_extremes():
    assert ind.last(ind.rsi(list(range(1, 40)), 14)) == 100.0
    assert ind.last(ind.rsi(list(range(40, 1, -1)), 14)) == pytest.approx(0.0, abs=1e-9)
    assert ind.last(ind.rsi([5.0] * 40, 14)) == 50.0
    assert ind.rsi([1, 2, 3], 14) == [None, None, None]


def test_ema_seeded_with_sma():
    assert ind.ema([1, 2, 3, 4, 5], 3) == [None, None, 2.0, 3.0, 4.0]
    assert ind.last(ind.ema([7.0] * 50, 20)) == pytest.approx(7.0)


def test_sma():
    assert ind.sma([1, 2, 3, 4], 2) == [None, 1.5, 2.5, 3.5]


def test_macd_alignment_and_sign():
    closes = [100 + i for i in range(80)]
    line, sig, hist = ind.macd(closes)
    assert len(line) == len(sig) == len(hist) == 80
    assert line[24] is None and line[25] is not None       # slow EMA warm-up (26)
    assert sig[32] is None and sig[33] is not None          # + 9 signal periods
    assert ind.last(line) > 0                                # steady uptrend => fast EMA above slow EMA
    assert ind.last(hist) == pytest.approx(ind.last(line) - ind.last(sig))


def test_bollinger_flat_series_has_zero_width():
    mid, up, lo = ind.bollinger([10.0] * 30, 20)
    assert mid[-1] == up[-1] == lo[-1] == 10.0


def test_bollinger_known_values():
    vals = [1, 2, 3, 4, 5]
    mid, up, lo = ind.bollinger(vals, 5, 2.0)
    assert mid[-1] == 3 and up[-1] == pytest.approx(3 + 2 * 2 ** 0.5)  # population sd = sqrt(2)


def test_atr_constant_range():
    n = 40
    highs, lows, closes = [11.0] * n, [9.0] * n, [10.0] * n
    assert ind.last(ind.atr(highs, lows, closes, 14)) == pytest.approx(2.0)


def test_aggregate_bars_4h():
    bars = [{"time": 14400 * 5 + h * 3600, "open": 10 + h, "high": 20 + h, "low": 1 + h, "close": 11 + h, "volume": 10} for h in range(8)]
    out = ind.__name__ and aggregate_bars(bars, 4 * 3600)
    assert len(out) == 2
    assert out[0]["open"] == 10 and out[0]["close"] == 14 and out[0]["high"] == 23 and out[0]["low"] == 1 and out[0]["volume"] == 40
    assert out[0]["time"] < out[1]["time"]


def test_symbol_detection_is_token_based():
    assert detect_symbols("Analyze NVDA and gold") == ["NVDA", "XAUUSD"]
    assert detect_symbols("EUR/USD outlook?") == ["EURUSD"]
    assert detect_symbols("this method is a solution, my cat sat") == []      # old code matched 'eth','sol','cat' inside words
    assert detect_symbols("bought $META and $CAT today") == ["META", "CAT"]  # ambiguous tickers need a $

"""AI analysis.

Design rule: every number shown to a user is COMPUTED from real candles (services/market/indicators.py).
Gemini, when configured, only narrates those computed numbers; it is told not to add facts. Without a
Gemini key we render the same numbers with a deterministic template. `confidence` is an
indicator-agreement score (how many independent indicators point the same way), NOT a probability.
"""
from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx

from ..cache import Cache
from ..config import Settings
from ..errors import BadRequest, UpstreamUnavailable
from .market import indicators as ind
from .market.catalog import BY_SYMBOL, detect_symbols
from .market.service import MarketService

log = logging.getLogger("fxzone.ai")

DISCLAIMER = ("Educational analysis computed from public price data. It is not financial advice; "
              "trading carries a high risk of loss.")
DEFAULT_INSIGHT_SYMBOLS = ["NVDA", "BTCUSD", "EURUSD", "XAUUSD"]
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def _fmt(symbol: str, v: float | None) -> str:
    if v is None:
        return "n/a"
    a = BY_SYMBOL.get(symbol)
    if a and a.asset_type == "forex":
        return f"{v:.5f}" if v < 20 else f"{v:.3f}"
    if abs(v) >= 1000:
        return f"{v:,.2f}"
    return f"{v:.4f}" if abs(v) < 1 else f"{v:.2f}"


def compute_analysis(symbol: str, bars: list[dict[str, Any]]) -> dict[str, Any]:
    """Pure function: daily candles -> indicators, votes, bias, illustrative volatility levels."""
    if len(bars) < 35:
        raise BadRequest("Not enough price history to analyse this symbol")
    closes = [b["close"] for b in bars]
    highs = [b["high"] for b in bars]
    lows = [b["low"] for b in bars]
    price = closes[-1]

    ema20, ema50, ema200 = (ind.last(ind.ema(closes, p)) for p in (20, 50, 200))
    rsi14 = ind.last(ind.rsi(closes, 14))
    macd_line, macd_sig, macd_hist = (ind.last(s) for s in ind.macd(closes))
    _, bb_up, bb_lo = ind.bollinger(closes, 20, 2.0)
    bb_upper, bb_lower = ind.last(bb_up), ind.last(bb_lo)
    atr14 = ind.last(ind.atr(highs, lows, closes, 14))
    ret20 = (price / closes[-21] - 1) * 100 if len(closes) > 21 else None
    percent_b = ((price - bb_lower) / (bb_upper - bb_lower)) if bb_upper and bb_lower and bb_upper != bb_lower else None

    def side(value: float, ref: float, band: float = 0.005) -> int:
        """+1/-1 only when clearly above/below `ref` (0.5% dead-band so noise around a level is not a signal)."""
        return 1 if value > ref * (1 + band) else -1 if value < ref * (1 - band) else 0

    votes: dict[str, int] = {}
    if ema20 is not None and ema50 is not None:
        votes["ema_alignment"] = 1 if (price > ema20 > ema50 and side(price, ema50) == 1) else \
            -1 if (price < ema20 < ema50 and side(price, ema50) == -1) else 0
    if ema200 is not None:
        votes["price_vs_ema200"] = side(price, ema200)
    if rsi14 is not None:
        # 45-55 is "no momentum"; >=70 / <=30 is stretched (momentum vs. mean-reversion), so it does not add a vote
        votes["rsi_momentum"] = 0 if (rsi14 >= 70 or rsi14 <= 30) else 1 if rsi14 > 55 else -1 if rsi14 < 45 else 0
    if macd_hist is not None and macd_line is not None and macd_sig is not None:
        votes["macd"] = 1 if macd_hist > 0 and macd_line > macd_sig else -1 if macd_hist < 0 else 0
    if ret20 is not None:
        votes["momentum_20d"] = 1 if ret20 > 2 else -1 if ret20 < -2 else 0

    score = sum(votes.values()) / len(votes) if votes else 0.0
    sentiment = "bullish" if score >= 0.4 else "bearish" if score <= -0.4 else "neutral"

    levels: dict[str, Any] = {"support_20d": min(lows[-20:]), "resistance_20d": max(highs[-20:])}
    if atr14:
        sign = -1 if sentiment == "bearish" else 1
        levels["illustrative_volatility_levels"] = {
            "direction": "short" if sign == -1 else "long",
            "reference_price": price,
            "stop": price - sign * 1.5 * atr14,
            "target_1": price + sign * 2.0 * atr14,
            "target_2": price + sign * 3.5 * atr14,
            "note": "ATR-based, for illustration of volatility only - not a trade recommendation",
        }

    notes: list[str] = []
    if rsi14 is not None and rsi14 >= 70:
        notes.append(f"RSI(14) is {rsi14:.1f} (overbought territory: momentum is strong but stretched)")
    elif rsi14 is not None and rsi14 <= 30:
        notes.append(f"RSI(14) is {rsi14:.1f} (oversold territory)")
    if percent_b is not None and (percent_b > 1 or percent_b < 0):
        notes.append("Price is outside its 20-day Bollinger Bands (elevated short-term volatility)")

    return {
        "symbol": symbol,
        "as_of": datetime.fromtimestamp(bars[-1]["time"], tz=timezone.utc).isoformat(),
        "bars_used": len(bars),
        "price": price,
        "sentiment": sentiment,
        "confidence": round(abs(score), 2),
        "confidence_basis": "indicator_agreement",
        "score": round(score, 2),
        "votes": votes,
        "indicators": {
            "rsi14": rsi14, "ema20": ema20, "ema50": ema50, "ema200": ema200,
            "macd": macd_line, "macd_signal": macd_sig, "macd_histogram": macd_hist,
            "bollinger_upper": bb_upper, "bollinger_lower": bb_lower, "percent_b": percent_b,
            "atr14": atr14, "return_20d_pct": ret20,
        },
        "levels": levels,
        "notes": notes,
    }


def key_points(a: dict[str, Any]) -> list[str]:
    s, i, pts = a["symbol"], a["indicators"], []
    if i["ema20"] is not None and i["ema50"] is not None:
        rel = "above" if a["price"] > i["ema20"] else "below"
        pts.append(f"Price {_fmt(s, a['price'])} is {rel} the 20-day EMA ({_fmt(s, i['ema20'])}); 50-day EMA {_fmt(s, i['ema50'])}.")
    if i["rsi14"] is not None:
        pts.append(f"RSI(14) at {i['rsi14']:.1f}; MACD histogram {'positive' if (i['macd_histogram'] or 0) > 0 else 'negative'}.")
    if i["return_20d_pct"] is not None:
        pts.append(f"20-day return {i['return_20d_pct']:+.1f}%; 20-day range {_fmt(s, a['levels']['support_20d'])} - {_fmt(s, a['levels']['resistance_20d'])}.")
    pts.extend(a["notes"])
    return pts


def render_markdown(a: dict[str, Any], name: str) -> str:
    s, i = a["symbol"], a["indicators"]
    lines = [
        f"### {name} ({s}) - technical snapshot",
        f"- **Bias:** {a['sentiment'].upper()} - indicator agreement {int(a['confidence'] * 100)}% "
        f"({sum(1 for v in a['votes'].values() if v)}/{len(a['votes'])} indicators decisive)",
        f"- **Last daily close:** {_fmt(s, a['price'])} (data as of {a['as_of'][:10]})",
        "", "#### Indicators (daily)",
        f"- RSI(14): {i['rsi14']:.1f}" if i["rsi14"] is not None else "- RSI(14): n/a",
        f"- EMA 20/50/200: {_fmt(s, i['ema20'])} / {_fmt(s, i['ema50'])} / {_fmt(s, i['ema200'])}",
        f"- MACD(12,26,9): line {_fmt(s, i['macd'])}, signal {_fmt(s, i['macd_signal'])}, histogram {_fmt(s, i['macd_histogram'])}",
        f"- Bollinger(20,2): {_fmt(s, i['bollinger_lower'])} - {_fmt(s, i['bollinger_upper'])}",
        f"- ATR(14): {_fmt(s, i['atr14'])}",
        "", "#### Levels",
        f"- 20-day support {_fmt(s, a['levels']['support_20d'])}, resistance {_fmt(s, a['levels']['resistance_20d'])}",
    ]
    v = a["levels"].get("illustrative_volatility_levels")
    if v:
        lines.append(f"- Volatility-based reference (illustrative, not advice): stop {_fmt(s, v['stop'])}, "
                     f"targets {_fmt(s, v['target_1'])} / {_fmt(s, v['target_2'])}")
    for n in a["notes"]:
        lines.append(f"- Note: {n}")
    lines += ["", f"> {DISCLAIMER}"]
    return "\n".join(lines)


class AiService:
    def __init__(self, settings: Settings, http: httpx.AsyncClient, cache: Cache, market: MarketService) -> None:
        self.s, self.http, self.cache, self.market = settings, http, cache, market

    @property
    def gemini_enabled(self) -> bool:
        return bool(self.s.gemini_api_key)

    async def _gemini(self, system: str, contents: list[dict[str, Any]]) -> str | None:
        if not self.gemini_enabled:
            return None
        try:
            r = await self.http.post(
                GEMINI_URL.format(model=self.s.gemini_model),
                headers={"x-goog-api-key": self.s.gemini_api_key or "", "Content-Type": "application/json"},
                json={"systemInstruction": {"parts": [{"text": system}]}, "contents": contents,
                      "generationConfig": {"temperature": 0.3, "maxOutputTokens": 700}},
                timeout=20)
            r.raise_for_status()
            parts = (r.json().get("candidates") or [{}])[0].get("content", {}).get("parts") or []
            text = "".join(p.get("text", "") for p in parts).strip()
            return text or None
        except (httpx.HTTPError, ValueError, KeyError) as e:
            log.warning("gemini call failed, falling back to rules: %s", e)
            return None

    async def analyze(self, symbol: str, narrate: bool = True) -> dict[str, Any]:
        symbol = symbol.upper()
        if symbol not in BY_SYMBOL:
            raise BadRequest(f"Unknown symbol '{symbol}'")
        ckey = f"ai:analysis:{symbol}:{int(narrate)}"
        cached = await self.cache.get_json(ckey)
        if cached:
            return cached
        bars = await self.market.get_history(symbol, "1d", 400)
        a = compute_analysis(symbol, bars)
        name = BY_SYMBOL[symbol].name
        summary, source = render_markdown(a, name), "rules"
        if narrate and self.gemini_enabled:
            text = await self._gemini(
                "You are a markets educator. Write a concise (<= 170 words) markdown technical commentary using ONLY the "
                "numbers in the JSON you are given. Do not invent news, on-chain data, fundamentals, probabilities or "
                "price targets beyond the JSON. Do not give personalised advice. End with one sentence noting this is "
                "educational, not financial advice.",
                [{"role": "user", "parts": [{"text": f"Asset: {name} ({symbol})\nComputed data:\n{a}"}]}])
            if text:
                summary, source = text, "gemini"
        result = {**a, "name": name, "summary": summary, "analysis": summary, "source": source,
                  "key_points": key_points(a), "disclaimer": DISCLAIMER,
                  "timestamp": datetime.now(timezone.utc).isoformat()}
        await self.cache.set_json(ckey, result, 600)
        return result

    async def insights(self, symbols: list[str] | None = None) -> list[dict[str, Any]]:
        out = []
        for sym in symbols or DEFAULT_INSIGHT_SYMBOLS:
            try:
                a = await self.analyze(sym, narrate=False)
            except (UpstreamUnavailable, BadRequest) as e:
                log.warning("insight skipped for %s: %s", sym, e)
                continue
            i = a["indicators"]
            brief = (f"{a['name']} closed at {_fmt(sym, a['price'])}; {a['sentiment']} bias with "
                     f"{int(a['confidence'] * 100)}% indicator agreement (RSI {i['rsi14']:.0f}).") if i["rsi14"] is not None \
                else f"{a['name']} closed at {_fmt(sym, a['price'])}; {a['sentiment']} bias."
            out.append({"symbol": sym, "name": a["name"], "sentiment": a["sentiment"], "confidence": a["confidence"],
                        "confidence_basis": a["confidence_basis"], "summary": brief, "keyPoints": a["key_points"][:3],
                        "as_of": a["as_of"], "source": "indicators", "timestamp": a["timestamp"]})
        return out

    async def chat(self, user_id: str, message: str, conversation_id: str | None) -> dict[str, Any]:
        if conversation_id and not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", conversation_id):
            raise BadRequest("Invalid conversation_id")
        conv = conversation_id or uuid.uuid4().hex
        hkey = f"ai:chat:{user_id}:{conv}"
        history: list[dict[str, str]] = await self.cache.get_json(hkey) or []

        symbols = detect_symbols(message, limit=2)
        context, analyses = [], []
        for sym in symbols:
            try:
                analyses.append(await self.analyze(sym, narrate=False))
            except (UpstreamUnavailable, BadRequest):
                context.append(f"(No reliable price data available for {sym} right now.)")

        reply: str | None = None
        source = "rules"
        if self.gemini_enabled:
            contents = [{"role": "user" if h["role"] == "user" else "model", "parts": [{"text": h["text"]}]}
                        for h in history[-8:]]
            data = "\n\n".join([str({k: a[k] for k in ("symbol", "price", "sentiment", "confidence", "indicators", "levels", "as_of")})
                                for a in analyses] + context)
            contents.append({"role": "user", "parts": [{"text": f"{message}\n\n[Computed market data - the only data you may cite]\n{data or 'none'}"}]})
            reply = await self._gemini(
                "You are FxZone AI, a markets education assistant. Cite only numbers from the computed data block; if "
                "data is missing say so. Never give personalised investment advice or guarantee outcomes. Keep answers "
                "under 200 words in markdown.", contents)
            if reply is not None:
                source = "gemini"
        if reply is None:
            if analyses:
                reply = "\n\n---\n\n".join(render_markdown(a, a["name"]) for a in analyses)
            else:
                snap = await self.market.get_quotes(["BTCUSD", "EURUSD", "XAUUSD", "NVDA"])
                rows = [f"- **{q['symbol']}**: {_fmt(q['symbol'], q['price'])} ({q['change_pct']:+.2f}% 24h)"
                        + (" *(stale)*" if q["is_stale"] else "") for q in snap.values()]
                reply = ("Ask about a specific asset, e.g. *\"Analyze NVDA\"* or *\"Bitcoin outlook\"*, and I'll compute "
                         "RSI, EMAs, MACD, Bollinger Bands and volatility from live price history.\n\n"
                         + ("**Market snapshot**\n" + "\n".join(rows) + "\n\n" if rows else "") + f"> {DISCLAIMER}")
        history += [{"role": "user", "text": message}, {"role": "model", "text": reply}]
        await self.cache.set_json(hkey, history[-20:], 3600)
        return {"message": reply, "reply": reply, "conversation_id": conv,
                "source": source,
                "timestamp": datetime.now(timezone.utc).isoformat()}

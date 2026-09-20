"""Headline aggregator: pulls public RSS/Atom feeds, stores title + short snippet + link (never full
articles), tags assets/category and scores headline sentiment with a transparent keyword lexicon."""
from __future__ import annotations

import html
import logging
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any

import httpx
from defusedxml import ElementTree as ET

from ..db import Database
from ..realtime import NEWS_TOPIC, RealtimePublisher
from .market.catalog import BY_SYMBOL, detect_symbols

log = logging.getLogger("fxzone.news")

_POS = {"surge", "surges", "soar", "soars", "rally", "rallies", "jump", "jumps", "gain", "gains", "rise", "rises",
        "climb", "climbs", "record", "beat", "beats", "upgrade", "upgraded", "bullish", "boost", "inflow", "inflows",
        "approval", "approved", "breakout", "rebound", "rebounds", "optimism", "growth"}
_NEG = {"plunge", "plunges", "tumble", "tumbles", "slump", "slumps", "fall", "falls", "drop", "drops", "crash",
        "miss", "misses", "downgrade", "downgraded", "bearish", "fear", "selloff", "outflow", "outflows", "ban",
        "hack", "hacked", "lawsuit", "recession", "cut", "cuts", "loss", "losses", "warning", "slides", "sinks"}
_CATEGORY_WORDS = {
    "crypto": {"bitcoin", "btc", "ethereum", "crypto", "cryptocurrency", "blockchain", "token", "stablecoin", "defi", "solana"},
    "forex": {"forex", "currency", "currencies", "dollar", "euro", "yen", "sterling", "fx", "ecb", "boj"},
    "commodity": {"gold", "silver", "oil", "crude", "brent", "commodity", "commodities", "opec"},
}
_BREAKING = re.compile(r"\b(breaking|just in|flash)\b", re.I)
_TAG = re.compile(r"<[^>]+>")


def clean_text(raw: str | None, limit: int) -> str:
    text = html.unescape(_TAG.sub(" ", raw or ""))
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit]


def score_headline(text: str) -> tuple[float, str]:
    words = re.findall(r"[a-z]+", text.lower())
    pos, neg = sum(w in _POS for w in words), sum(w in _NEG for w in words)
    score = (pos - neg) / max(pos + neg, 1) if pos + neg else 0.0
    label = "bullish" if score > 0.2 else "bearish" if score < -0.2 else "neutral"
    return round(score, 2), label


def categorize(text: str, symbols: list[str]) -> str:
    words = set(re.findall(r"[a-z]+", text.lower()))
    for cat, vocab in _CATEGORY_WORDS.items():
        if words & vocab:
            return cat
    kinds = {BY_SYMBOL[s].asset_type for s in symbols if s in BY_SYMBOL}
    for cat in ("crypto", "forex", "commodity", "stock"):
        if cat in kinds:
            return cat
    return "general"


def _parse_date(value: str | None) -> datetime:
    if value:
        try:
            dt = parsedate_to_datetime(value)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except (TypeError, ValueError):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                pass
    return datetime.now(timezone.utc)


def parse_feed(xml_text: str, source: str) -> list[dict[str, Any]]:
    root = ET.fromstring(xml_text)
    items: list[dict[str, Any]] = []
    entries = root.findall(".//item") or root.findall(".//{http://www.w3.org/2005/Atom}entry")
    for e in entries:
        def find(*names: str) -> str | None:
            for n in names:
                el = e.find(n)
                if el is not None:
                    return (el.text or el.get("href") or "").strip() or None
            return None

        title = clean_text(find("title", "{http://www.w3.org/2005/Atom}title"), 300)
        link = find("link", "{http://www.w3.org/2005/Atom}link")
        if not title or not link or not link.lower().startswith(("http://", "https://")):
            continue
        summary = clean_text(find("description", "{http://www.w3.org/2005/Atom}summary"), 400)
        published = _parse_date(find("pubDate", "{http://www.w3.org/2005/Atom}updated", "{http://www.w3.org/2005/Atom}published"))
        text = f"{title}. {summary}"
        symbols = detect_symbols(text, limit=5)
        score, label = score_headline(text)
        items.append({"title": title, "summary": summary, "url": link[:2000], "source": source, "published_at": published,
                      "symbols": symbols, "category": categorize(text, symbols), "sentiment": label,
                      "sentiment_score": score, "breaking": bool(_BREAKING.search(title))})
    return items


class NewsService:
    def __init__(self, db: Database, http: httpx.AsyncClient, realtime: RealtimePublisher,
                 feeds: list[tuple[str, str]]) -> None:
        self.db, self.http, self.realtime, self.feeds = db, http, realtime, feeds

    async def ingest_once(self) -> int:
        inserted = 0
        for source, url in self.feeds:
            try:
                r = await self.http.get(url, timeout=12, headers={"User-Agent": "FxZonePlatform/1.0"}, follow_redirects=True)
                r.raise_for_status()
                items = parse_feed(r.text[:3_000_000], source)
            except Exception as e:  # noqa: BLE001 - one bad feed must not stop the others
                log.warning("news feed %s failed: %s", source, e)
                continue
            now = datetime.now(timezone.utc)
            for it in items[:60]:
                age = (now - it["published_at"]).total_seconds()
                it["published_at"] = min(it["published_at"], now)  # a future-dated item must not pin itself to the top of the feed
                row = await self.db.fetchrow(
                    """INSERT INTO news_articles (title, summary, url, source, published_at, sentiment, sentiment_score, symbols, category)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (url) DO NOTHING RETURNING id""",
                    it["title"], it["summary"], it["url"], it["source"], it["published_at"], it["sentiment"],
                    it["sentiment_score"], it["symbols"], it["category"])
                if not row:
                    continue
                inserted += 1
                if it["breaking"] and -300 <= age < 1800:  # only genuinely fresh items; never old (first ingest) or future-dated ones
                    self.realtime.publish_nowait(NEWS_TOPIC, "breaking_news", {"data": {
                        "id": str(row["id"]), "title": it["title"], "source": it["source"], "summary": it["summary"]}})
        return inserted

    async def cleanup(self) -> None:
        await self.db.execute("DELETE FROM news_articles WHERE published_at < NOW() - INTERVAL '30 days'")


def news_to_api(r: dict[str, Any]) -> dict[str, Any]:
    return {"id": str(r["id"]), "title": r["title"], "summary": r["summary"] or "", "content": r["summary"] or "",
            "url": r["url"], "source": r["source"], "published_at": r["published_at"], "category": r["category"],
            "sentiment": r["sentiment"], "sentiment_label": r["sentiment"], "sentiment_score": r["sentiment_score"] or 0,
            "related_symbols": list(r["symbols"] or []), "asset_tags": list(r["symbols"] or []),
            "image_url": r.get("image_url")}

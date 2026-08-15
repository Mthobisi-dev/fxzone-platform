"""News Ingester service — fetches real financial news from RSS feeds + keeps seed data as fallback."""
import asyncio
import logging
from datetime import datetime, timedelta
import random
from typing import List, Dict, Any

import httpx
import feedparser

from services.news.sentiment import analyze_sentiment

logger = logging.getLogger(__name__)

# ── Real RSS Feed Sources ───────────────────────────────────────────────────

RSS_FEEDS = [
    {
        "url": "https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US",
        "source": "Yahoo Finance",
        "category": "stocks",
        "default_tags": ["AAPL", "MSFT", "GOOGL"],
    },
    {
        "url": "https://www.cnbc.com/id/100003114/device/rss/rss.html",
        "source": "CNBC",
        "category": "stocks",
        "default_tags": ["AAPL", "TSLA", "NVDA"],
    },
    {
        "url": "https://www.cnbc.com/id/20910258/device/rss/rss.html",
        "source": "CNBC Crypto",
        "category": "crypto",
        "default_tags": ["BTCUSD", "ETHUSD"],
    },
    {
        "url": "https://cointelegraph.com/rss",
        "source": "CoinTelegraph",
        "category": "crypto",
        "default_tags": ["BTCUSD", "ETHUSD", "SOLUSD"],
    },
    {
        "url": "https://www.investing.com/rss/news.rss",
        "source": "Investing.com",
        "category": "forex",
        "default_tags": ["EURUSD", "GBPUSD", "USDJPY"],
    },
]

# Asset keyword → symbol mapping for auto-tagging articles
ASSET_KEYWORDS = {
    "bitcoin": "BTCUSD", "btc": "BTCUSD",
    "ethereum": "ETHUSD", "eth": "ETHUSD", "ether": "ETHUSD",
    "solana": "SOLUSD", "sol": "SOLUSD",
    "cardano": "ADAUSD", "ada": "ADAUSD",
    "polkadot": "DOTUSD", "dot": "DOTUSD",
    "xrp": "XRPUSD", "ripple": "XRPUSD",
    "apple": "AAPL", "aapl": "AAPL",
    "google": "GOOGL", "alphabet": "GOOGL", "googl": "GOOGL",
    "microsoft": "MSFT", "msft": "MSFT",
    "amazon": "AMZN", "amzn": "AMZN",
    "tesla": "TSLA", "tsla": "TSLA",
    "nvidia": "NVDA", "nvda": "NVDA",
    "meta": "META", "facebook": "META",
    "euro": "EURUSD", "ecb": "EURUSD", "eurusd": "EURUSD",
    "pound": "GBPUSD", "sterling": "GBPUSD", "gbpusd": "GBPUSD",
    "yen": "USDJPY", "boj": "USDJPY", "usdjpy": "USDJPY",
    "fed": "EURUSD", "federal reserve": "EURUSD",
    "interest rate": "EURUSD",
}

# Seed articles used as fallback when RSS fails
SEED_NEWS = [
    {
        "title": "Bitcoin Holds Above Key Support as Institutional Inflows Continue",
        "content": "On-chain data shows long-term Bitcoin holders continue to accumulate. Exchange reserves have hit multi-year lows, suggesting a supply squeeze. Spot ETF inflows remain strong.",
        "asset_tags": ["BTCUSD", "ETHUSD"],
        "category": "crypto",
        "source": "FxZone Market Desk"
    },
    {
        "title": "Fed Maintains Rates, Signals Data-Dependent Approach",
        "content": "The Federal Reserve held interest rates steady, emphasizing a data-dependent approach to future policy decisions. The US Dollar strengthened broadly following the statement.",
        "asset_tags": ["EURUSD", "GBPUSD", "USDJPY"],
        "category": "forex",
        "source": "FxZone Market Desk"
    },
    {
        "title": "Tech Earnings Beat Expectations, Driving Nasdaq Higher",
        "content": "Major tech companies reported earnings above analyst estimates. AI-related revenue growth continues to be the key driver, with cloud computing demand accelerating across the sector.",
        "asset_tags": ["AAPL", "MSFT", "NVDA", "GOOGL"],
        "category": "stocks",
        "source": "FxZone Market Desk"
    },
]


def _extract_asset_tags(text: str, default_tags: List[str]) -> List[str]:
    """Extract asset tags from article text using keyword matching."""
    text_lower = text.lower()
    tags = set(default_tags)
    for keyword, symbol in ASSET_KEYWORDS.items():
        if keyword in text_lower:
            tags.add(symbol)
    return list(tags)[:6]  # Limit to 6 tags


class NewsIngester:
    """Ingester service that fetches real financial news from RSS feeds."""

    def __init__(self, mongo_db):
        self.mongo_db = mongo_db

    async def ingest_demo_data(self) -> int:
        """Seed initial news articles, then attempt to fetch real RSS news."""
        if self.mongo_db is None:
            logger.warning("MongoDB not initialized. Skipping news ingestion.")
            return 0

        collection = self.mongo_db.news_articles

        # Always try to fetch real news first
        real_count = await self._fetch_rss_feeds()
        if real_count > 0:
            logger.info(f"Ingested {real_count} real news articles from RSS feeds.")
            return real_count

        # Fallback: seed with starter articles if nothing else is available
        count = await collection.count_documents({})
        if count >= 5:
            logger.info("News articles already exist in MongoDB.")
            return 0

        inserted = 0
        now = datetime.utcnow()
        for idx, article in enumerate(SEED_NEWS):
            published_time = now - timedelta(hours=idx * 6)
            sentiment = analyze_sentiment(article["content"])

            doc = {
                "article_id": f"seed_{idx}_{int(published_time.timestamp())}",
                "title": article["title"],
                "content": article["content"],
                "asset_tags": article["asset_tags"],
                "category": article["category"],
                "source": article["source"],
                "sentiment_score": sentiment["score"],
                "sentiment_label": sentiment["label"],
                "published_at": published_time.isoformat(),
                "created_at": now.isoformat(),
            }

            exists = await collection.find_one({"title": doc["title"]})
            if not exists:
                await collection.insert_one(doc)
                inserted += 1

        logger.info(f"Seeded {inserted} fallback news articles.")
        return inserted

    async def _fetch_rss_feeds(self) -> int:
        """Fetch and parse real RSS feeds concurrently from all configured sources."""
        if self.mongo_db is None:
            return 0

        collection = self.mongo_db.news_articles
        total_inserted = 0

        # Fetch all feeds in parallel with individual error isolation
        feed_results = await asyncio.gather(
            *[self._parse_single_feed(feed_config) for feed_config in RSS_FEEDS],
            return_exceptions=True
        )

        for result in feed_results:
            if isinstance(result, list):
                for article in result:
                    try:
                        # Deduplicate by title
                        exists = await collection.find_one({"title": article["title"]})
                        if not exists:
                            await collection.insert_one(article)
                            total_inserted += 1
                    except Exception as e:
                        logger.debug(f"Article insertion notice: {e}")

        return total_inserted

    async def _parse_single_feed(self, feed_config: Dict) -> List[Dict]:
        """Parse a single RSS feed URL and return structured articles."""
        url = feed_config["url"]
        articles = []

        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(url, headers={
                    "User-Agent": "FxZone/1.0 (Financial News Aggregator)"
                })
                resp.raise_for_status()
                content = resp.text
        except Exception as e:
            logger.warning(f"HTTP error fetching {url}: {e}")
            return []

        # Parse with feedparser (runs sync, but is very fast)
        feed = await asyncio.get_event_loop().run_in_executor(
            None, feedparser.parse, content
        )

        now = datetime.utcnow()
        for entry in feed.entries[:10]:  # Limit to 10 most recent per feed
            title = entry.get("title", "").strip()
            if not title:
                continue

            summary = entry.get("summary", entry.get("description", "")).strip()
            # Clean HTML from summary
            if "<" in summary:
                from html.parser import HTMLParser
                class HTMLStripper(HTMLParser):
                    def __init__(self):
                        super().__init__()
                        self.result = []
                    def handle_data(self, data):
                        self.result.append(data)
                stripper = HTMLStripper()
                stripper.feed(summary)
                summary = " ".join(stripper.result).strip()

            if len(summary) < 20:
                summary = title  # Use title as content if summary is too short

            # Extract published date
            published = entry.get("published_parsed") or entry.get("updated_parsed")
            if published:
                from time import mktime
                pub_dt = datetime.utcfromtimestamp(mktime(published))
            else:
                pub_dt = now

            # Auto-tag with asset symbols
            combined_text = f"{title} {summary}"
            asset_tags = _extract_asset_tags(combined_text, feed_config.get("default_tags", []))

            # Run sentiment analysis
            sentiment = analyze_sentiment(combined_text)

            articles.append({
                "article_id": f"rss_{hash(title) % 100000000}_{int(pub_dt.timestamp())}",
                "title": title,
                "content": summary[:1000],  # Limit content length
                "asset_tags": asset_tags,
                "category": feed_config.get("category", "general"),
                "source": feed_config.get("source", "RSS"),
                "url": entry.get("link", ""),
                "sentiment_score": sentiment["score"],
                "sentiment_label": sentiment["label"],
                "published_at": pub_dt.isoformat(),
                "created_at": now.isoformat(),
            })

        logger.info(f"Parsed {len(articles)} articles from {feed_config['source']}")
        return articles

    async def poll_news_feeds(self):
        """Periodic task to refresh news from RSS feeds."""
        logger.info("Polling live financial news feeds...")
        count = await self._fetch_rss_feeds()
        if count > 0:
            logger.info(f"Ingested {count} new articles from RSS feeds.")
        else:
            logger.info("No new articles found in this polling cycle.")

"""FxZone Market Data Service - Real price providers using free public APIs.

Data sources (all free, no API key required):
- Crypto: CoinGecko API (https://api.coingecko.com/api/v3)
- Stocks: Yahoo Finance via yfinance library
- Forex:  Yahoo Finance via yfinance library
"""
import asyncio
import time
import logging
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

# ── Symbol Mapping ──────────────────────────────────────────────────────────

# Map our internal symbols → CoinGecko IDs
CRYPTO_COINGECKO_MAP = {
    "BTCUSD": "bitcoin",
    "ETHUSD": "ethereum",
    "SOLUSD": "solana",
    "ADAUSD": "cardano",
    "DOTUSD": "polkadot",
    "XRPUSD": "ripple",
}

# Map our internal symbols → Yahoo Finance tickers
STOCK_YAHOO_MAP = {
    "AAPL": "AAPL",
    "GOOGL": "GOOGL",
    "MSFT": "MSFT",
    "AMZN": "AMZN",
    "TSLA": "TSLA",
    "NVDA": "NVDA",
    "META": "META",
}

# Forex pairs → Yahoo Finance tickers (e.g. EURUSD=X)
FOREX_YAHOO_MAP = {
    "EURUSD": "EURUSD=X",
    "GBPUSD": "GBPUSD=X",
    "USDJPY": "USDJPY=X",
    "AUDUSD": "AUDUSD=X",
    "USDCAD": "USDCAD=X",
    "NZDUSD": "NZDUSD=X",
    "USDCHF": "USDCHF=X",
    "EURGBP": "EURGBP=X",
}

ALL_SYMBOLS = list(CRYPTO_COINGECKO_MAP.keys()) + list(STOCK_YAHOO_MAP.keys()) + list(FOREX_YAHOO_MAP.keys())


def _get_decimals(symbol: str, price: float = 0) -> int:
    """Return appropriate decimal places for a given symbol/price."""
    if symbol in FOREX_YAHOO_MAP:
        return 5 if price < 2 else 3
    if price > 1000:
        return 2
    elif price > 10:
        return 2
    elif price > 1:
        return 4
    else:
        return 5


# ── Base Provider ───────────────────────────────────────────────────────────

class BaseProvider(ABC):
    """Abstract base class for market data providers."""

    @abstractmethod
    async def get_price(self, symbol: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    async def get_prices(self, symbols: List[str]) -> Dict[str, Dict[str, Any]]:
        pass

    async def get_history(self, symbol: str, timeframe: str = "1d", limit: int = 100) -> List[Dict]:
        return []


# ── CoinGecko Provider (Crypto) ────────────────────────────────────────────

class CoinGeckoProvider:
    """Fetches real-time crypto prices from CoinGecko (free, no key)."""

    BASE_URL = "https://api.coingecko.com/api/v3"

    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._cache_ts: float = 0
        self._cache_ttl: float = 30
        self._history_cache: Dict[str, Dict[str, Any]] = {}

    async def get_all_crypto_prices(self) -> Dict[str, Dict[str, Any]]:
        """Fetch prices for all mapped crypto assets in a single API call."""
        now = time.time()
        if self._cache and (now - self._cache_ts) < self._cache_ttl:
            return self._cache

        ids = ",".join(CRYPTO_COINGECKO_MAP.values())
        url = (
            f"{self.BASE_URL}/simple/price"
            f"?ids={ids}"
            f"&vs_currencies=usd"
            f"&include_24hr_change=true"
            f"&include_24hr_vol=true"
            f"&include_last_updated_at=true"
        )

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()

            result = {}
            for our_symbol, cg_id in CRYPTO_COINGECKO_MAP.items():
                if cg_id in data:
                    info = data[cg_id]
                    price = info.get("usd", 0)
                    change_pct = info.get("usd_24h_change", 0) or 0
                    volume = info.get("usd_24h_vol", 0) or 0
                    decimals = _get_decimals(our_symbol, price)

                    result[our_symbol] = {
                        "symbol": our_symbol,
                        "price": round(price, decimals),
                        "bid": round(price * 0.9999, decimals),
                        "ask": round(price * 1.0001, decimals),
                        "change": round(price * change_pct / 100, decimals),
                        "change_pct": round(change_pct, 4),
                        "daily_change": round(price * change_pct / 100, decimals),
                        "daily_change_pct": round(change_pct, 4),
                        "high": round(price * 1.005, decimals),
                        "low": round(price * 0.995, decimals),
                        "open": round(price - (price * change_pct / 100), decimals),
                        "volume": int(volume),
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }

            self._cache = result
            self._cache_ts = now
            logger.info(f"CoinGecko: fetched {len(result)} crypto prices")
            return result

        except Exception as e:
            logger.error(f"CoinGecko API error: {e}")
            return self._cache if self._cache else {}

    async def get_history(self, symbol: str, days: int = 90) -> List[Dict]:
        """Fetch OHLC history from CoinGecko."""
        cache_key = f"{symbol}_{days}"
        now = time.time()
        if cache_key in self._history_cache:
            entry = self._history_cache[cache_key]
            if now - entry["ts"] < 3600:
                return entry["data"]

        cg_id = CRYPTO_COINGECKO_MAP.get(symbol)
        if not cg_id:
            return []

        try:
            url = f"{self.BASE_URL}/coins/{cg_id}/ohlc?vs_currency=usd&days={days}"
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()

            decimals = _get_decimals(symbol, data[0][1] if data else 100)
            candles = []
            for entry_data in data:
                ts_ms, o, h, l, c = entry_data
                candles.append({
                    "time": int(ts_ms / 1000),
                    "open": round(o, decimals),
                    "high": round(h, decimals),
                    "low": round(l, decimals),
                    "close": round(c, decimals),
                    "volume": 0,
                })

            self._history_cache[cache_key] = {"data": candles, "ts": now}
            logger.info(f"CoinGecko: fetched {len(candles)} OHLC candles for {symbol}")
            return candles

        except Exception as e:
            logger.error(f"CoinGecko OHLC error for {symbol}: {e}")
            return self._history_cache.get(cache_key, {}).get("data", [])


# ── Yahoo Finance Provider (Stocks + Forex) ────────────────────────────────

class YahooFinanceProvider:
    """Fetches real stock and forex prices from Yahoo Finance via yfinance."""

    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._cache_ts: Dict[str, float] = {}
        self._cache_ttl: float = 60
        self._history_cache: Dict[str, Dict[str, Any]] = {}
        self._batch_cache: Dict[str, Dict[str, Any]] = {}
        self._batch_cache_ts: float = 0

    async def get_price(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Fetch a single price from Yahoo Finance."""
        now = time.time()
        if symbol in self._cache and (now - self._cache_ts.get(symbol, 0)) < self._cache_ttl:
            return self._cache[symbol]

        yahoo_ticker = STOCK_YAHOO_MAP.get(symbol) or FOREX_YAHOO_MAP.get(symbol)
        if not yahoo_ticker:
            return None

        try:
            result = await asyncio.get_event_loop().run_in_executor(
                None, self._fetch_yahoo_sync, symbol, yahoo_ticker
            )
            if result:
                self._cache[symbol] = result
                self._cache_ts[symbol] = now
            return result
        except Exception as e:
            logger.error(f"Yahoo Finance error for {symbol}: {e}")
            return self._cache.get(symbol)

    def _fetch_yahoo_sync(self, our_symbol: str, yahoo_ticker: str) -> Optional[Dict[str, Any]]:
        """Synchronous Yahoo Finance fetch (runs in thread pool)."""
        try:
            import yfinance as yf
            ticker = yf.Ticker(yahoo_ticker)
            info = ticker.fast_info

            price = float(info.last_price) if hasattr(info, 'last_price') else 0
            prev_close = float(info.previous_close) if hasattr(info, 'previous_close') else price
            day_high = float(info.day_high) if hasattr(info, 'day_high') else price
            day_low = float(info.day_low) if hasattr(info, 'day_low') else price
            open_price = float(info.open) if hasattr(info, 'open') else price
            volume = int(info.last_volume) if hasattr(info, 'last_volume') else 0

            change = price - prev_close
            change_pct = (change / prev_close * 100) if prev_close else 0
            decimals = _get_decimals(our_symbol, price)
            is_forex = our_symbol in FOREX_YAHOO_MAP
            spread = price * 0.0001 if is_forex else 0.01

            return {
                "symbol": our_symbol,
                "price": round(price, decimals),
                "bid": round(price - spread, decimals),
                "ask": round(price + spread, decimals),
                "change": round(change, decimals),
                "change_pct": round(change_pct, 4),
                "daily_change": round(change, decimals),
                "daily_change_pct": round(change_pct, 4),
                "high": round(day_high, decimals),
                "low": round(day_low, decimals),
                "open": round(open_price, decimals),
                "volume": volume,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as e:
            logger.error(f"yfinance sync fetch error for {our_symbol} ({yahoo_ticker}): {e}")
            return None

    async def get_all_prices(self) -> Dict[str, Dict[str, Any]]:
        """Fetch all stock and forex prices concurrently."""
        now = time.time()
        if self._batch_cache and (now - self._batch_cache_ts) < 60:
            return self._batch_cache

        all_symbols = {**STOCK_YAHOO_MAP, **FOREX_YAHOO_MAP}
        
        async def _fetch_one(our_symbol: str, yahoo_ticker: str):
            try:
                price = await asyncio.wait_for(
                    asyncio.get_event_loop().run_in_executor(
                        None, self._fetch_yahoo_sync, our_symbol, yahoo_ticker
                    ),
                    timeout=10.0
                )
                if price:
                    return our_symbol, price
            except asyncio.TimeoutError:
                logger.warning(f"Yahoo Finance timeout for {our_symbol}")
            except Exception as e:
                logger.warning(f"Failed to fetch {our_symbol}: {e}")
            return our_symbol, None

        fetched = await asyncio.gather(*[_fetch_one(s, t) for s, t in all_symbols.items()])
        result = {sym: price for sym, price in fetched if price is not None}

        if result:
            self._batch_cache = result
            self._batch_cache_ts = now
            for sym, data in result.items():
                self._cache[sym] = data
                self._cache_ts[sym] = now

        logger.info(f"Yahoo Finance: fetched {len(result)} prices concurrently (stocks + forex)")
        return result

    async def get_history(self, symbol: str, period: str = "3mo", interval: str = "1d") -> List[Dict]:
        """Fetch historical OHLCV data from Yahoo Finance."""
        cache_key = f"{symbol}_{period}_{interval}"
        now = time.time()
        if cache_key in self._history_cache:
            entry = self._history_cache[cache_key]
            if now - entry["ts"] < 3600:
                return entry["data"]

        yahoo_ticker = STOCK_YAHOO_MAP.get(symbol) or FOREX_YAHOO_MAP.get(symbol)
        if not yahoo_ticker:
            return []

        try:
            candles = await asyncio.get_event_loop().run_in_executor(
                None, self._fetch_history_sync, symbol, yahoo_ticker, period, interval
            )
            if candles:
                self._history_cache[cache_key] = {"data": candles, "ts": now}
            return candles
        except Exception as e:
            logger.error(f"Yahoo Finance history error for {symbol}: {e}")
            return self._history_cache.get(cache_key, {}).get("data", [])

    def _fetch_history_sync(self, our_symbol: str, yahoo_ticker: str, period: str, interval: str) -> List[Dict]:
        """Synchronous historical data fetch."""
        import yfinance as yf
        ticker = yf.Ticker(yahoo_ticker)
        df = ticker.history(period=period, interval=interval)

        if df.empty:
            return []

        decimals = _get_decimals(our_symbol, float(df['Close'].iloc[-1]))
        candles = []
        for idx, row in df.iterrows():
            ts = int(idx.timestamp())
            candles.append({
                "time": ts,
                "open": round(float(row["Open"]), decimals),
                "high": round(float(row["High"]), decimals),
                "low": round(float(row["Low"]), decimals),
                "close": round(float(row["Close"]), decimals),
                "volume": int(row.get("Volume", 0)),
            })

        logger.info(f"Yahoo Finance: fetched {len(candles)} candles for {our_symbol}")
        return candles


# ── Unified Real Data Provider ──────────────────────────────────────────────

class RealDataProvider(BaseProvider):
    """Unified provider that routes to CoinGecko (crypto) or Yahoo Finance (stocks/forex)."""

    def __init__(self):
        self.coingecko = CoinGeckoProvider()
        self.yahoo = YahooFinanceProvider()
        self._all_prices_cache: Dict[str, Dict[str, Any]] = {}
        self._all_prices_ts: float = 0

    def _classify(self, symbol: str) -> str:
        if symbol in CRYPTO_COINGECKO_MAP:
            return "crypto"
        elif symbol in STOCK_YAHOO_MAP:
            return "stock"
        elif symbol in FOREX_YAHOO_MAP:
            return "forex"
        return "unknown"

    async def get_price(self, symbol: str) -> Optional[Dict[str, Any]]:
        kind = self._classify(symbol)
        if kind == "crypto":
            prices = await self.coingecko.get_all_crypto_prices()
            return prices.get(symbol)
        elif kind in ("stock", "forex"):
            return await self.yahoo.get_price(symbol)
        return None

    async def get_prices(self, symbols: List[str]) -> Dict[str, Dict[str, Any]]:
        result = {}
        crypto_syms = [s for s in symbols if s in CRYPTO_COINGECKO_MAP]
        yahoo_syms = [s for s in symbols if s in STOCK_YAHOO_MAP or s in FOREX_YAHOO_MAP]

        if crypto_syms:
            crypto_prices = await self.coingecko.get_all_crypto_prices()
            for sym in crypto_syms:
                if sym in crypto_prices:
                    result[sym] = crypto_prices[sym]

        if yahoo_syms:
            # Parallelize requests to Yahoo Finance to avoid sequential read timeouts
            yahoo_results = await asyncio.gather(*[self.yahoo.get_price(sym) for sym in yahoo_syms])
            for price in yahoo_results:
                if price:
                    result[price["symbol"]] = price

        return result

    async def get_all_prices(self) -> Dict[str, Dict[str, Any]]:
        now = time.time()
        if self._all_prices_cache and (now - self._all_prices_ts) < 30:
            return self._all_prices_cache

        result = {}

        # Fetch crypto and stocks/forex concurrently with a global 15s timeout
        async def _fetch_crypto():
            try:
                return await self.coingecko.get_all_crypto_prices()
            except Exception as e:
                logger.error(f"Failed to fetch crypto prices: {e}")
                return {}

        async def _fetch_yahoo():
            try:
                return await self.yahoo.get_all_prices()
            except Exception as e:
                logger.error(f"Failed to fetch stock/forex prices: {e}")
                return {}

        try:
            crypto_result, yahoo_result = await asyncio.wait_for(
                asyncio.gather(_fetch_crypto(), _fetch_yahoo()),
                timeout=15.0
            )
            result.update(crypto_result)
            result.update(yahoo_result)
        except asyncio.TimeoutError:
            logger.warning("Global market data fetch timed out after 15s, using stale cache")
            return self._all_prices_cache if self._all_prices_cache else result

        if result:
            self._all_prices_cache = result
            self._all_prices_ts = now

        # Always return something — stale data is better than empty
        return result if result else self._all_prices_cache

    async def get_history(self, symbol: str, timeframe: str = "1d", limit: int = 100) -> List[Dict]:
        kind = self._classify(symbol)

        tf_map = {
            "1m": ("1d", "1m"),
            "5m": ("5d", "5m"),
            "15m": ("5d", "15m"),
            "1h": ("1mo", "1h"),
            "4h": ("3mo", "1d"),
            "1d": ("1y", "1d"),
        }
        period, interval = tf_map.get(timeframe, ("3mo", "1d"))

        if kind == "crypto":
            days_map = {"1d": 1, "5d": 7, "1mo": 30, "3mo": 90, "1y": 365}
            days = days_map.get(period, 90)
            return await self.coingecko.get_history(symbol, days=days)
        elif kind in ("stock", "forex"):
            return await self.yahoo.get_history(symbol, period=period, interval=interval)

        return []


# ── Price Engine (Main Entry Point) ────────────────────────────────────────

class PriceEngine:
    """Main engine that orchestrates real data fetching."""

    def __init__(self):
        logger.info("Initializing PriceEngine with RealDataProvider (Live Market Data).")
        self.provider = RealDataProvider()

    async def get_price(self, symbol: str) -> Optional[Dict]:
        return await self.provider.get_price(symbol)

    async def get_prices(self, symbols: List[str]) -> Dict:
        return await self.provider.get_prices(symbols)

    async def get_all_prices(self) -> Dict:
        return await self.provider.get_all_prices()

    async def get_history(self, symbol: str, timeframe: str = "1d", limit: int = 100) -> List[Dict]:
        return await self.provider.get_history(symbol, timeframe, limit)


# Global engine instance
price_engine = PriceEngine()

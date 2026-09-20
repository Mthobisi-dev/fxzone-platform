"""The tradable-asset catalogue (single source of truth; synced into public.assets at startup).

`legacy_id` are the placeholder ids the old Next.js routes exposed ('asset-btc'); the frontend may
still hold them, so they resolve to the same asset.  `yahoo` is the Yahoo Finance ticker used for
candles/quotes; `coingecko` is the CoinGecko coin id used for crypto spot quotes.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class AssetDef:
    symbol: str
    name: str
    asset_type: str
    description: str
    legacy_id: str
    yahoo: str
    coingecko: str | None = None


def _c(sym, name, desc, cg, yahoo):  # crypto
    return AssetDef(sym, name, "crypto", desc, f"asset-{sym[:-3].lower()}", yahoo, cg)


def _s(sym, name, desc):  # stock
    return AssetDef(sym, name, "stock", desc, f"asset-{sym.lower()}", sym)


def _f(sym, name, desc):  # forex
    return AssetDef(sym, name, "forex", desc, f"asset-{sym.lower()}", f"{sym}=X")


CATALOG: list[AssetDef] = [
    _c("BTCUSD", "Bitcoin", "Digital Gold - Premier Cryptocurrency", "bitcoin", "BTC-USD"),
    _c("ETHUSD", "Ethereum", "Smart Contract & Layer-1 Platform", "ethereum", "ETH-USD"),
    _c("SOLUSD", "Solana", "High Performance Layer-1 Blockchain", "solana", "SOL-USD"),
    _c("XRPUSD", "XRP Ledger", "Cross-Border Digital Payment Asset", "ripple", "XRP-USD"),
    _c("ADAUSD", "Cardano", "Proof-of-Stake Blockchain Protocol", "cardano", "ADA-USD"),
    _c("DOTUSD", "Polkadot", "Interoperable Multi-Chain Network", "polkadot", "DOT-USD"),
    _c("LINKUSD", "Chainlink", "Decentralized Oracle Network", "chainlink", "LINK-USD"),
    _c("UNIUSD", "Uniswap", "Decentralized AMM Exchange Protocol", "uniswap", "UNI7083-USD"),
    _c("DOGEUSD", "Dogecoin", "Peer-to-Peer Memetic Currency", "dogecoin", "DOGE-USD"),
    _c("AVAXUSD", "Avalanche", "Scalable Subnet Blockchain", "avalanche-2", "AVAX-USD"),
    _s("NVDA", "NVIDIA Corporation", "AI GPU Computing Leader"),
    _s("AAPL", "Apple Inc.", "Consumer Hardware & Services Giant"),
    _s("MSFT", "Microsoft Corporation", "Enterprise Cloud & AI Leader"),
    _s("GOOGL", "Alphabet Inc.", "Search & Cloud AI Powerhouse"),
    _s("AMZN", "Amazon.com Inc.", "E-Commerce & AWS Cloud Leader"),
    _s("TSLA", "Tesla Inc.", "Electric Vehicles & Clean Energy"),
    _s("META", "Meta Platforms Inc.", "Social Media & AI Ecosystem"),
    _s("AVGO", "Broadcom Inc.", "Semiconductors & Infrastructure Software"),
    _s("INTC", "Intel Corporation", "Semiconductor Microprocessors"),
    _s("QCOM", "Qualcomm Inc.", "Wireless Telecommunications Tech"),
    _s("AMD", "Advanced Micro Devices", "CPUs & Data Center Accelerators"),
    _s("LLY", "Eli Lilly and Company", "Pharmaceutical & Biotechs"),
    _s("JNJ", "Johnson & Johnson", "Healthcare & Pharmaceuticals"),
    _s("WMT", "Walmart Inc.", "Global Hypermarket Retail"),
    _s("CAT", "Caterpillar Inc.", "Heavy Industrial Machinery"),
    _s("GE", "General Electric Aerospace", "Aerospace & Power Systems"),
    _f("EURUSD", "Euro / US Dollar", "Eurozone vs United States Currency Pair"),
    _f("GBPUSD", "British Pound / US Dollar", "Great Britain Pound vs US Dollar Pair"),
    _f("USDJPY", "US Dollar / Japanese Yen", "US Dollar vs Japanese Yen Pair"),
    _f("AUDUSD", "Australian Dollar / US Dollar", "Australian Dollar vs US Dollar Pair"),
    _f("USDCAD", "US Dollar / Canadian Dollar", "US Dollar vs Canadian Dollar Pair"),
    _f("NZDUSD", "New Zealand Dollar / US Dollar", "New Zealand Dollar vs US Dollar Pair"),
    _f("USDCHF", "US Dollar / Swiss Franc", "US Dollar vs Swiss Franc Pair"),
    _f("EURGBP", "Euro / British Pound", "Eurozone vs Great Britain Currency Cross"),
    AssetDef("SPX", "S&P 500 Index", "index", "US Large Cap Stock Index", "asset-spx", "^GSPC"),
    AssetDef("XAUUSD", "Gold Spot / US Dollar", "commodity", "Gold Bullion Spot Price per Ounce",
             "asset-xauusd", "GC=F"),
    AssetDef("XAGUSD", "Silver Spot / US Dollar", "commodity", "Silver Bullion Spot Price per Ounce",
             "asset-xagusd", "SI=F"),
]

BY_SYMBOL: dict[str, AssetDef] = {a.symbol: a for a in CATALOG}
BY_LEGACY_ID: dict[str, AssetDef] = {a.legacy_id: a for a in CATALOG}

# Extra words people use in chat / headlines. Matching is token-based (no substring hits).
_ALIASES: dict[str, str] = {
    "btc": "BTCUSD", "bitcoin": "BTCUSD", "eth": "ETHUSD", "ethereum": "ETHUSD", "ether": "ETHUSD",
    "sol": "SOLUSD", "solana": "SOLUSD", "xrp": "XRPUSD", "ripple": "XRPUSD", "cardano": "ADAUSD",
    "polkadot": "DOTUSD", "chainlink": "LINKUSD", "uniswap": "UNIUSD", "dogecoin": "DOGEUSD",
    "doge": "DOGEUSD", "avalanche": "AVAXUSD", "nvidia": "NVDA", "apple": "AAPL", "microsoft": "MSFT",
    "google": "GOOGL", "alphabet": "GOOGL", "amazon": "AMZN", "tesla": "TSLA", "broadcom": "AVGO",
    "intel": "INTC", "qualcomm": "QCOM", "walmart": "WMT", "caterpillar": "CAT",
    "spx": "SPX", "s&p": "SPX", "gold": "XAUUSD", "xau": "XAUUSD", "silver": "XAGUSD", "xag": "XAGUSD",
    "euro": "EURUSD", "eurusd": "EURUSD", "cable": "GBPUSD", "sterling": "GBPUSD", "yen": "USDJPY",
    "loonie": "USDCAD", "aussie": "AUDUSD", "kiwi": "NZDUSD", "swissie": "USDCHF",
}
_TOKEN_TO_SYMBOL: dict[str, str] = {**{a.symbol.lower(): a.symbol for a in CATALOG}, **_ALIASES}
# "EUR/USD" style pairs -> "eurusd"
_PAIR_RE = re.compile(r"\b([a-z]{3})\s*/\s*([a-z]{3})\b")
_TOKEN_RE = re.compile(r"[a-z0-9]+")
# Tickers that are also everyday words: only count them when written as a cashtag ($META, $CAT ...)
_NEEDS_CASHTAG = {"cat", "ge", "meta", "link", "uni", "dot"}


def detect_symbols(text: str, limit: int = 3) -> list[str]:
    """Return catalogue symbols mentioned in free text (order of appearance, unique)."""
    lower = text.lower()
    found: list[str] = []

    def add(sym: str | None) -> None:
        if sym and sym not in found and sym in BY_SYMBOL:
            found.append(sym)

    for m in _PAIR_RE.finditer(lower):
        add(_TOKEN_TO_SYMBOL.get(m.group(1) + m.group(2)))
    for raw in re.finditer(r"(\$?)([a-z0-9]+)", lower):
        cashtag, token = raw.group(1) == "$", raw.group(2)
        sym = _TOKEN_TO_SYMBOL.get(token)
        if not sym:
            continue
        if token in _NEEDS_CASHTAG and not cashtag:
            continue
        add(sym)
    return found[:limit]


def resolve_asset(symbol_or_id: str) -> AssetDef | None:
    key = symbol_or_id.strip()
    return BY_SYMBOL.get(key.upper()) or BY_LEGACY_ID.get(key.lower())

"""Asynchronous client wrapper for OpenAI, Google Gemini, and a smart Mock LLM for FxZone."""
import json
import logging
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, Any, Optional
import httpx
from config import settings

logger = logging.getLogger(__name__)


class LLMClient(ABC):
    """Abstract Base Class for LLM API integration."""

    @abstractmethod
    async def generate(self, prompt: str, system_prompt: str = "") -> str:
        """Generate a complete text response from the model."""
        pass

    @abstractmethod
    async def stream(self, prompt: str, system_prompt: str = "") -> AsyncGenerator[str, None]:
        """Stream the text response from the model chunk by chunk."""
        pass


class OpenAIClient(LLMClient):
    """OpenAI API wrapper using httpx."""

    def __init__(self, api_key: str, model: str = "gpt-4o"):
        self.api_key = api_key
        self.model = model
        self.api_url = "https://api.openai.com/v1/chat/completions"

    @property
    def headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    async def generate(self, prompt: str, system_prompt: str = "") -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.3
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(self.api_url, headers=self.headers, json=payload)
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
            except Exception as e:
                logger.error(f"OpenAI generate error: {e}")
                raise e

    async def stream(self, prompt: str, system_prompt: str = "") -> AsyncGenerator[str, None]:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.3,
            "stream": True
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                async with client.stream("POST", self.api_url, headers=self.headers, json=payload) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            if data_str == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data_str)
                                content = chunk["choices"][0]["delta"].get("content", "")
                                if content:
                                    yield content
                            except json.JSONDecodeError:
                                continue
            except Exception as e:
                logger.error(f"OpenAI stream error: {e}")
                raise e


class GeminiClient(LLMClient):
    """Google Gemini API wrapper using httpx — supports gemini-1.5-flash with auto-retry."""

    def __init__(self, api_key: str, model: str = "gemini-1.5-flash"):
        self.api_key = api_key
        self.model = model
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        self._max_retries = 3

    async def _retry_request(self, client: httpx.AsyncClient, url: str, payload: dict) -> httpx.Response:
        """Execute a POST request with automatic retry on 429 rate limit errors."""
        import asyncio
        for attempt in range(self._max_retries):
            response = await client.post(url, json=payload)
            if response.status_code == 429 and attempt < self._max_retries - 1:
                # Parse retry delay from response or use exponential backoff
                retry_delay = 2 ** (attempt + 1)  # 2s, 4s, 8s
                try:
                    error_data = response.json()
                    details = error_data.get("error", {}).get("details", [])
                    for d in details:
                        if d.get("@type", "").endswith("RetryInfo"):
                            delay_str = d.get("retryDelay", "")
                            if delay_str.endswith("s"):
                                retry_delay = float(delay_str[:-1]) + 0.5
                except Exception:
                    pass
                logger.warning(f"Gemini API rate limited (429). Retrying in {retry_delay:.1f}s (attempt {attempt + 1}/{self._max_retries})")
                await asyncio.sleep(retry_delay)
                continue
            return response
        return response  # Return last response even if still 429

    async def generate(self, prompt: str, system_prompt: str = "") -> str:
        url = f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}"

        payload: Dict[str, Any] = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 4096},
        }
        if system_prompt:
            payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}

        async with httpx.AsyncClient(timeout=90.0) as client:
            try:
                response = await self._retry_request(client, url, payload)
                response.raise_for_status()
                data = response.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    return "".join(p.get("text", "") for p in parts)
                return "I couldn't generate a response. Please try again."
            except httpx.HTTPStatusError as e:
                logger.error(f"Gemini API HTTP error: {e.response.status_code} - {e.response.text[:300]}")
                raise e
            except Exception as e:
                logger.error(f"Gemini generate error: {e}")
                raise e

    async def stream(self, prompt: str, system_prompt: str = "") -> AsyncGenerator[str, None]:
        url = f"{self.base_url}/models/{self.model}:streamGenerateContent?key={self.api_key}&alt=sse"

        payload: Dict[str, Any] = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 4096},
        }
        if system_prompt:
            payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}

        async with httpx.AsyncClient(timeout=90.0) as client:
            try:
                async with client.stream("POST", url, json=payload) as response:
                    if response.status_code == 429:
                        error_text = ""
                        async for chunk in response.aiter_text():
                            error_text += chunk
                        logger.warning(f"Gemini stream rate limited (429): {error_text[:200]}")
                        raise httpx.HTTPStatusError(
                            "Rate limited", request=response.request, response=response
                        )
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line or not line.startswith("data: "):
                            continue
                        json_str = line[6:].strip()
                        if not json_str:
                            continue
                        try:
                            chunk = json.loads(json_str)
                            candidates = chunk.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                for p in parts:
                                    text = p.get("text", "")
                                    if text:
                                        yield text
                        except json.JSONDecodeError:
                            continue
            except httpx.HTTPStatusError as e:
                logger.error(f"Gemini stream HTTP error: {e.response.status_code}")
                raise e  # Let FallbackClient catch this and switch to MockClient
            except Exception as e:
                logger.error(f"Gemini stream error: {e}")
                raise e  # Let FallbackClient catch this too



class MockClient(LLMClient):
    """Smart mock LLM client that fetches REAL prices and injects them into responses."""

    async def _get_real_prices(self) -> Dict[str, Any]:
        """Fetch current real prices from the PriceEngine to use in responses."""
        try:
            from services.market_data.providers import price_engine
            prices = await price_engine.get_all_prices()
            return prices
        except Exception as e:
            logger.warning(f"MockClient: couldn't fetch real prices: {e}")
            return {}

    def _format_price(self, price_data: Dict) -> str:
        """Format price data into a readable string."""
        price = price_data.get("price", 0)
        change_pct = price_data.get("daily_change_pct", 0)
        direction = "📈" if change_pct >= 0 else "📉"
        return f"${price:,.2f}" if price > 10 else f"${price:,.4f}", f"{direction} {change_pct:+.2f}%"

    async def generate(self, prompt: str, system_prompt: str = "") -> str:
        import asyncio
        await asyncio.sleep(0.3)

        prices = await self._get_real_prices()
        prompt_lower = prompt.lower()

        # ── Sentiment JSON request ──
        if "sentiment" in prompt_lower and "json" in prompt_lower:
            return self._sentiment_json(prompt_lower, prices)

        # ── Detailed analysis ──
        if "comprehensive" in prompt_lower or "analysis" in prompt_lower:
            return self._detailed_analysis(prompt_lower, prices)

        # ── General chat ──
        return self._general_chat(prompt_lower, prices)

    async def stream(self, prompt: str, system_prompt: str = "") -> AsyncGenerator[str, None]:
        import asyncio
        response_text = await self.generate(prompt, system_prompt)
        chunk_size = 20
        for i in range(0, len(response_text), chunk_size):
            yield response_text[i:i + chunk_size]
            await asyncio.sleep(0.03)

    def _detect_symbol(self, text: str) -> str:
        """Detect which asset the user is asking about."""
        symbol_keywords = {
            "BTCUSD": ["btc", "bitcoin"],
            "ETHUSD": ["eth", "ethereum"],
            "SOLUSD": ["sol", "solana"],
            "XRPUSD": ["xrp", "ripple"],
            "ADAUSD": ["ada", "cardano"],
            "DOTUSD": ["dot", "polkadot"],
            "AAPL": ["aapl", "apple"],
            "GOOGL": ["googl", "google", "alphabet"],
            "MSFT": ["msft", "microsoft"],
            "AMZN": ["amzn", "amazon"],
            "TSLA": ["tsla", "tesla"],
            "NVDA": ["nvda", "nvidia"],
            "META": ["meta", "facebook"],
            "EURUSD": ["eurusd", "eur/usd", "euro"],
            "GBPUSD": ["gbpusd", "gbp/usd", "pound", "sterling"],
            "USDJPY": ["usdjpy", "usd/jpy", "yen"],
        }
        for symbol, keywords in symbol_keywords.items():
            for kw in keywords:
                if kw in text:
                    return symbol
        return "BTCUSD"

    def _sentiment_json(self, prompt_lower: str, prices: Dict) -> str:
        symbol = self._detect_symbol(prompt_lower)
        pd = prices.get(symbol, {})
        price = pd.get("price", 0)
        change = pd.get("daily_change_pct", 0)

        if change > 1:
            sentiment, confidence = "Bullish", 0.78
        elif change < -1:
            sentiment, confidence = "Bearish", 0.72
        else:
            sentiment, confidence = "Neutral", 0.60

        price_str = f"${price:,.2f}" if price > 10 else f"${price:,.4f}"
        return json.dumps({
            "sentiment": sentiment,
            "confidence": confidence,
            "reasoning": f"{symbol} is currently trading at {price_str} with a {change:+.2f}% daily move. "
                         f"Price action and volume suggest a {sentiment.lower()} near-term bias."
        })

    def _detailed_analysis(self, prompt_lower: str, prices: Dict) -> str:
        symbol = self._detect_symbol(prompt_lower)
        pd = prices.get(symbol, {})
        price = pd.get("price", 0)
        change = pd.get("daily_change_pct", 0)
        high = pd.get("high", price)
        low = pd.get("low", price)
        volume = pd.get("volume", 0)
        price_str = f"${price:,.2f}" if price > 10 else f"${price:,.4f}"
        high_str = f"${high:,.2f}" if high > 10 else f"${high:,.4f}"
        low_str = f"${low:,.2f}" if low > 10 else f"${low:,.4f}"

        if change > 1:
            sentiment, outlook = "Bullish", "positive momentum suggests continuation"
        elif change < -1:
            sentiment, outlook = "Bearish", "selling pressure indicates further downside risk"
        else:
            sentiment, outlook = "Neutral", "sideways consolidation expected in the near term"

        return f"""# Market Analysis: {symbol}

## Current Price
**{price_str}** ({change:+.2f}% today)
- Day Range: {low_str} — {high_str}
- Volume: {volume:,}

## Technical Overview
The price is currently trading {'above' if change > 0 else 'below'} the daily open. {'Buyers are in control with higher highs forming.' if change > 0.5 else 'Sellers are pressuring price toward support levels.' if change < -0.5 else 'Price is consolidating near the daily pivot.'}

**Key Levels:**
- Support: {low_str}
- Resistance: {high_str}

## Sentiment
**{sentiment}** — {outlook}.

## Risk Notice
⚠️ This is AI-generated analysis based on current market data. It does not constitute financial advice. Always conduct your own research and manage risk appropriately.
"""

    def _general_chat(self, prompt_lower: str, prices: Dict) -> str:
        import re

        # Extract user message from structured prompt
        user_msg = prompt_lower
        if "user:" in prompt_lower:
            parts = prompt_lower.split("user:")
            user_msg = parts[-1].split("assistant:")[0].strip()

        def has_word(word: str) -> bool:
            return bool(re.search(rf"\b{re.escape(word)}\b", user_msg))

        # Greeting
        if has_word("hello") or has_word("hi") or user_msg.strip() in ["hi", "hello", "hey"]:
            # Build a quick market snapshot
            snapshot_lines = []
            for sym in ["BTCUSD", "EURUSD", "AAPL"]:
                pd = prices.get(sym, {})
                if pd:
                    p = pd.get("price", 0)
                    c = pd.get("daily_change_pct", 0)
                    icon = "🟢" if c >= 0 else "🔴"
                    p_str = f"${p:,.2f}" if p > 10 else f"${p:,.4f}"
                    snapshot_lines.append(f"  {icon} **{sym}**: {p_str} ({c:+.2f}%)")

            snapshot = "\n".join(snapshot_lines) if snapshot_lines else "  Market data loading..."
            return (
                f"Hello! I'm your FxZone AI Assistant. Here's a quick market snapshot:\n\n"
                f"{snapshot}\n\n"
                f"Ask me about any asset for a detailed analysis, or ask about risk management, market trends, or trading strategies!"
            )

        # Detect specific asset queries
        symbol = self._detect_symbol(user_msg)
        pd = prices.get(symbol, {})
        if pd and any(kw in user_msg for kw in ["price", "how", "what", "outlook", "analysis", "tell me about",
                                                   symbol.lower()]):
            price = pd.get("price", 0)
            change = pd.get("daily_change_pct", 0)
            high = pd.get("high", price)
            low = pd.get("low", price)
            p_str = f"${price:,.2f}" if price > 10 else f"${price:,.4f}"
            h_str = f"${high:,.2f}" if high > 10 else f"${high:,.4f}"
            l_str = f"${low:,.2f}" if low > 10 else f"${low:,.4f}"

            direction = "up" if change > 0 else "down" if change < 0 else "flat"
            emoji = "📈" if change > 0 else "📉" if change < 0 else "➡️"

            return (
                f"**{symbol}** — Live Market Data {emoji}\n\n"
                f"**Price:** {p_str} ({change:+.2f}% today)\n"
                f"**Day Range:** {l_str} — {h_str}\n\n"
                f"The price is currently {direction} for the day. "
                f"{'Momentum looks constructive with buyers defending support.' if change > 0.5 else 'Selling pressure is evident, watch key support levels.' if change < -0.5 else 'Price is consolidating in a tight range.'}\n\n"
                f"Would you like a full technical analysis or sentiment check?"
            )

        # Watchlist overview
        if "watchlist" in user_msg or "portfolio" in user_msg:
            lines = []
            for sym in ["BTCUSD", "ETHUSD", "AAPL", "TSLA", "EURUSD"]:
                pd2 = prices.get(sym, {})
                if pd2:
                    p = pd2.get("price", 0)
                    c = pd2.get("daily_change_pct", 0)
                    icon = "🟢" if c >= 0 else "🔴"
                    p_str = f"${p:,.2f}" if p > 10 else f"${p:,.4f}"
                    lines.append(f"  {icon} **{sym}**: {p_str} ({c:+.2f}%)")
            overview = "\n".join(lines) if lines else "  Loading prices..."
            return f"Here's your watchlist overview with live prices:\n\n{overview}\n\nWant a detailed analysis on any of these?"

        # Risk management
        if "risk" in user_msg:
            return (
                "**Risk Management Essentials:**\n\n"
                "1. **Position Sizing**: Never risk more than 1-2% of capital per trade\n"
                "2. **Stop Loss**: Always set stops before entering — no exceptions\n"
                "3. **Risk/Reward**: Target minimum 1:2 ratio\n"
                "4. **Diversification**: Don't concentrate in one asset class\n"
                "5. **Leverage**: Use cautiously — it amplifies losses too\n\n"
                "Would you like me to calculate position sizes for a specific trade?"
            )

        # Default response with market overview
        overview_lines = []
        for sym in ["BTCUSD", "AAPL", "EURUSD"]:
            pd3 = prices.get(sym, {})
            if pd3:
                p = pd3.get("price", 0)
                c = pd3.get("daily_change_pct", 0)
                p_str = f"${p:,.2f}" if p > 10 else f"${p:,.4f}"
                overview_lines.append(f"  • **{sym}**: {p_str} ({c:+.2f}%)")
        overview = "\n".join(overview_lines) if overview_lines else ""

        return (
            f"Here's what I can help with:\n\n"
            f"📊 **Live Market Data:**\n{overview}\n\n"
            f"Try asking:\n"
            f"• *\"What's the outlook for Bitcoin?\"*\n"
            f"• *\"Analyze EURUSD\"*\n"
            f"• *\"How is Tesla doing?\"*\n"
            f"• *\"Risk management tips\"*"
        )


class FallbackClient(LLMClient):
    """Wraps a primary LLM client and falls back to a secondary client if the primary fails."""

    def __init__(self, primary: LLMClient, fallback: LLMClient):
        self.primary = primary
        self.fallback = fallback

    async def generate(self, prompt: str, system_prompt: str = "") -> str:
        try:
            return await self.primary.generate(prompt, system_prompt)
        except Exception as e:
            logger.warning(f"Primary LLM client generate failed, falling back to MockClient: {e}")
            return await self.fallback.generate(prompt, system_prompt)

    async def stream(self, prompt: str, system_prompt: str = "") -> AsyncGenerator[str, None]:
        has_yielded = False
        try:
            async for chunk in self.primary.stream(prompt, system_prompt):
                has_yielded = True
                yield chunk
        except Exception as e:
            logger.warning(f"Primary LLM client stream failed (has_yielded={has_yielded}): {e}")
            if not has_yielded:
                async for chunk in self.fallback.stream(prompt, system_prompt):
                    yield chunk
            else:
                yield "\n\n*(AI Stream connection interrupted)*"


def get_llm_client() -> LLMClient:
    """Factory function returning the appropriate LLM client based on configuration with automatic mock fallback."""
    mock = MockClient()
    if settings.OPENAI_API_KEY:
        logger.info("Using OpenAIClient with MockClient fallback for AI services.")
        primary = OpenAIClient(api_key=settings.OPENAI_API_KEY)
        return FallbackClient(primary, mock)
    elif settings.GEMINI_API_KEY:
        logger.info("Using GeminiClient (gemini-3.5-flash) with MockClient fallback for AI services.")
        primary = GeminiClient(api_key=settings.GEMINI_API_KEY)
        return FallbackClient(primary, mock)
    else:
        logger.info("No LLM API keys configured. Using MockClient with real price data injection.")
        return mock


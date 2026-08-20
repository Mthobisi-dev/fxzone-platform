import asyncio
import logging
import random
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from shared.database import AsyncSessionLocal
from shared.models import User, Post, Asset
from services.ai_assistant.llm_client import get_llm_client

logger = logging.getLogger(__name__)

SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60  # Strict 7 days = 604,800 seconds

# Distinct weekly market themes for high-variety, expert analysis
WEEKLY_THEMES = [
    {
        "category": "Crypto Market Pulse",
        "symbols": ["BTCUSD", "ETHUSD", "SOLUSD"],
        "prompt": (
            "Generate a high-impact, institutional-grade weekly crypto market update. "
            "Focus on Bitcoin (BTCUSD), Ethereum (ETHUSD), and Solana (SOLUSD). "
            "Highlight on-chain volume trends, support/resistance zones, ETF flow sentiment, and near-term price targets. "
            "Format cleanly with emojis, bold headers, and key actionable levels. Max 250 words."
        )
    },
    {
        "category": "Global Forex & Central Bank Outlook",
        "symbols": ["EURUSD", "GBPUSD", "USDJPY"],
        "prompt": (
            "Generate a professional weekly Forex market intelligence report. "
            "Focus on EUR/USD, GBP/USD, and USD/JPY. "
            "Discuss interest rate trajectories, Fed/ECB/BoJ monetary policy, Dollar Index (DXY) momentum, and critical pivot points. "
            "Format cleanly with emojis, bullet points, and key technical levels. Max 250 words."
        )
    },
    {
        "category": "Precious Metals & Safe-Haven Analysis",
        "symbols": ["XAUUSD", "XAGUSD"],
        "prompt": (
            "Generate an elite weekly commodities & precious metals technical breakdown. "
            "Focus on Gold (XAUUSD) and Silver (XAGUSD). "
            "Analyze real bond yields, geopolitical safe-haven demand, inflation hedging, and major multi-timeframe support/resistance zones. "
            "Format cleanly with emojis, clear bullet points, and key levels. Max 250 words."
        )
    },
    {
        "category": "US Mega-Cap Tech & Equity Momentum",
        "symbols": ["NVDA", "AAPL", "TSLA", "MSFT"],
        "prompt": (
            "Generate an institutional weekly US Equities market analysis. "
            "Focus on AI market leaders (NVDA, MSFT), Apple (AAPL), and Tesla (TSLA). "
            "Highlight Nasdaq tech momentum, earnings valuation dynamics, trendline support, and volume profile. "
            "Format cleanly with emojis, structured sections, and key price levels. Max 250 words."
        )
    },
    {
        "category": "Cross-Asset Macro Strategy & Risk Regime",
        "symbols": ["BTCUSD", "EURUSD", "XAUUSD", "NVDA"],
        "prompt": (
            "Generate a comprehensive cross-asset macro strategy briefing for active traders. "
            "Connect the dots across Crypto (BTC), Forex (EURUSD), Gold (XAUUSD), and US Tech (NVDA). "
            "Highlight liquidity cycles, risk-on vs. risk-off sentiment, volatility regimes, and disciplined position sizing tips. "
            "Format cleanly with emojis, high-value bullet points, and key levels. Max 250 words."
        )
    }
]


async def start_bot_poster():
    """Background task running on a strict 1-week cadence to post diverse market analyses as FxZone Bot."""
    llm = get_llm_client()

    while True:
        try:
            async with AsyncSessionLocal() as db:
                # Find FxZone Bot user
                res = await db.execute(select(User).where(User.username == 'fxzone_bot'))
                bot_user = res.scalar_one_or_none()

                if bot_user:
                    # Count existing bot posts to determine next rotating theme index
                    count_res = await db.execute(
                        select(Post).where(Post.user_id == bot_user.id).order_by(Post.created_at.desc())
                    )
                    bot_posts = count_res.scalars().all()
                    last_post = bot_posts[0] if bot_posts else None

                    should_post = False
                    if not last_post:
                        should_post = True
                    else:
                        time_since_last_post = (datetime.utcnow() - last_post.created_at).total_seconds()
                        if time_since_last_post >= SEVEN_DAYS_SECONDS:
                            should_post = True
                        else:
                            logger.info(
                                f"FxZone Bot weekly post on schedule — last post was {int(time_since_last_post / 3600)}h ago. "
                                f"Next weekly analysis in {int((SEVEN_DAYS_SECONDS - time_since_last_post) / 3600)}h."
                            )

                    if should_post:
                        # Pick next rotating theme to ensure every single weekly post is unique
                        theme_idx = len(bot_posts) % len(WEEKLY_THEMES)
                        theme = WEEKLY_THEMES[theme_idx]

                        # Fetch live market data to inject into LLM prompt
                        live_prices_str = ""
                        try:
                            from services.market_data.providers import price_engine
                            all_prices = await price_engine.get_all_prices()
                            price_snippets = []
                            for sym in theme["symbols"]:
                                if sym in all_prices:
                                    pd = all_prices[sym]
                                    price_snippets.append(
                                        f"{sym}: ${pd.get('price', 0):,.2f} ({pd.get('daily_change_pct', 0):+.2f}%)"
                                    )
                            if price_snippets:
                                live_prices_str = "\nLive Market Quotes: " + ", ".join(price_snippets)
                        except Exception as pe:
                            logger.warning(f"Price injection for bot poster notice: {pe}")

                        full_prompt = f"{theme['prompt']}\n{live_prices_str}"
                        system_prompt = (
                            f"You are FxZone Bot, an elite AI financial market analyst. "
                            f"Publishing official weekly market update for theme: {theme['category']}."
                        )

                        content = await llm.generate(full_prompt, system_prompt=system_prompt)

                        if content and len(content) > 30:
                            # Resolve tagged assets
                            stmt = select(Asset).where(Asset.symbol.in_(theme["symbols"]))
                            tag_res = await db.execute(stmt)
                            tagged = list(tag_res.scalars().all())

                            new_post = Post(
                                user_id=bot_user.id,
                                content=content,
                                image_url=None,
                                likes_count=0,
                                comments_count=0,
                                reposts_count=0,
                                tagged_assets=tagged
                            )
                            db.add(new_post)
                            await db.commit()
                            logger.info(
                                f"FxZone Bot published weekly market analysis on '{theme['category']}' "
                                f"(Post ID: {new_post.id})."
                            )
        except Exception as e:
            logger.error(f"Error in FxZone Bot weekly poster: {e}")

        # Check every 1 hour if a week has elapsed
        await asyncio.sleep(3600)

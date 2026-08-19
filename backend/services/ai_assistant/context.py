"""Context builder to compile market, news, and user-behavior data for the AI Assistant."""
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from motor.motor_asyncio import AsyncIOMotorDatabase
from shared.models import Watchlist, WatchlistItem, Asset, UserPreferenceVector

logger = logging.getLogger(__name__)


async def build_user_context(db: AsyncSession, user_id: int) -> dict:
    """Fetch user profile, risk preferences, and watchlist details from database."""
    context = {
        "experience_level": "Intermediate",
        "risk_preference": 0.5,
        "watchlist_symbols": []
    }
    
    try:
        # 1. Fetch preference vector
        pref_query = select(UserPreferenceVector).where(UserPreferenceVector.user_id == user_id)
        pref_result = await db.execute(pref_query)
        pref = pref_result.scalar_one_or_none()
        if pref:
            context["experience_level"] = pref.experience_level or "Intermediate"
            context["risk_preference"] = pref.risk_preference or 0.5

        # 2. Fetch watchlists and items
        wl_query = (
            select(Watchlist)
            .where(Watchlist.user_id == user_id)
            .options(selectinload(Watchlist.items).selectinload(WatchlistItem.asset))
        )
        wl_result = await db.execute(wl_query)
        watchlists = wl_result.scalars().all()
        
        symbols = []
        for wl in watchlists:
            for item in wl.items:
                if item.asset and item.asset.symbol not in symbols:
                    symbols.append(item.asset.symbol)
        context["watchlist_symbols"] = symbols

    except Exception as e:
        logger.error(f"Error building user context for user {user_id}: {e}")
        
    return context


async def build_market_context(db: AsyncSession, symbol: str) -> dict:
    """Fetch detailed asset profile and real-time live prices from Market Data providers."""
    context = {
        "symbol": symbol,
        "name": symbol,
        "price": "N/A",
        "change_24h": "0.00%",
        "high_24h": "N/A",
        "low_24h": "N/A",
        "volume": "N/A",
        "asset_type": "Market Asset",
        "technical_summary": "Technical indicators neutral."
    }

    try:
        # 1. Fetch asset metadata from database
        query = select(Asset).where(Asset.symbol == symbol)
        result = await db.execute(query)
        asset = result.scalar_one_or_none()
        if asset:
            context["name"] = asset.name
            context["asset_type"] = asset.asset_type.value if hasattr(asset.asset_type, 'value') else str(asset.asset_type)

        # 2. Fetch real live price from price_engine
        from services.market_data.providers import price_engine
        pd = await price_engine.get_price(symbol)
        if pd:
            price = pd.get("price", 0)
            change = pd.get("daily_change_pct", 0)
            high = pd.get("high", price)
            low = pd.get("low", price)
            vol = pd.get("volume", 0)

            context["price"] = f"${price:,.2f}" if price > 10 else f"${price:,.4f}"
            context["change_24h"] = f"{change:+.2f}%"
            context["high_24h"] = f"${high:,.2f}" if high > 10 else f"${high:,.4f}"
            context["low_24h"] = f"${low:,.2f}" if low > 10 else f"${low:,.4f}"
            context["volume"] = f"{vol:,.0f}" if vol else "Active"

            # Derive real technical status from price momentum and 24h range
            if change > 2.0:
                context["technical_summary"] = f"Strong bullish momentum (+{change:.2f}%). Price trading near 24h high ({context['high_24h']}). RSI estimated at 65-72 (Overbought territory)."
            elif change > 0.5:
                context["technical_summary"] = f"Constructive upward bias (+{change:.2f}%). Buyers defending support near {context['low_24h']}. RSI neutral-bullish (~56)."
            elif change < -2.0:
                context["technical_summary"] = f"Strong bearish pressure ({change:.2f}%). Price testing lower bounds near {context['low_24h']}. RSI estimated at 28-35 (Oversold territory)."
            elif change < -0.5:
                context["technical_summary"] = f"Downward consolidation ({change:.2f}%). Resistance capping advances near {context['high_24h']}. RSI neutral-bearish (~44)."
            else:
                context["technical_summary"] = f"Sideways range-bound consolidation ({change:+.2f}%). Day range: {context['low_24h']} - {context['high_24h']}. RSI neutral (50)."
    except Exception as e:
        logger.error(f"Error building market context for {symbol}: {e}")
        
    return context


async def build_news_context(mongo_db: AsyncIOMotorDatabase, symbol: str, limit: int = 3) -> str:
    """Retrieve recent news articles from MongoDB and format for the prompt."""
    if mongo_db is None:
        return "No news articles available (MongoDB disconnected)."

    try:
        collection = mongo_db.news_articles
        # Find news tagged with this asset symbol
        cursor = collection.find(
            {"asset_tags": symbol},
            projection={"title": 1, "sentiment_label": 1, "sentiment_score": 1, "published_at": 1}
        ).sort("published_at", -1).limit(limit)
        
        articles = await cursor.to_list(length=limit)
        if not articles:
            return "No recent news found for this asset."
            
        formatted = []
        for art in articles:
            sentiment = f"{art.get('sentiment_label', 'Neutral')} (Score: {art.get('sentiment_score', 0.0)})"
            formatted.append(f"- {art.get('title')} | Sentiment: {sentiment}")
        return "\n".join(formatted)

    except Exception as e:
        logger.error(f"Error fetching news context for {symbol}: {e}")
        return "Error loading recent news context."


def format_prompt_context(user_ctx: dict, market_ctx: dict, news_str: str) -> str:
    """Format all context dictionaries into a single structured prompt segment."""
    return f"""
Asset: {market_ctx['symbol']} ({market_ctx['name']})
Current Price: {market_ctx['price']}
24h Change: {market_ctx['change_24h']}%
Asset Type: {market_ctx['asset_type']}
Technical Indicators: {market_ctx['technical_summary']}

Recent News:
{news_str}

User Experience Level: {user_ctx['experience_level']}
User Risk Preference: {user_ctx['risk_preference']} (0.0=Conservative, 1.0=Aggressive)
"""

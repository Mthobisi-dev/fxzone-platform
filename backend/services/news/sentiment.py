"""Sentiment analysis utility for news articles and financial social posts."""
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Fallback keywords for rule-based sentiment calculation in case NLP library is missing resources
BULLISH_KEYWORDS = {
    "bullish", "growth", "breakout", "surges", "gain", "break", "upgrade", "outperform",
    "profit", "success", "highest", "all-time high", "breakthrough", "rallies", "climb",
    "acquisition", "positive", "partnership", "support", "inflow", "accumulate", "bull"
}

BEARISH_KEYWORDS = {
    "bearish", "crash", "plunge", "drop", "slump", "loss", "downgrade", "underperform",
    "warning", "lawsuit", "deficit", "selloff", "lowest", "decline", "investigation",
    "liquidation", "negative", "resistance", "outflow", "dump", "bear", "bankruptcy", "hack"
}


def analyze_sentiment(text: str) -> Dict[str, Any]:
    """Analyze the text sentiment and return a score (-1.0 to 1.0) and a label."""
    if not text:
        return {"score": 0.0, "label": "Neutral"}

    score = 0.0
    label = "Neutral"

    # Attempt to use TextBlob for sentiment analysis
    try:
        from textblob import TextBlob
        blob = TextBlob(text)
        score = blob.sentiment.polarity
    except Exception as e:
        logger.warning(f"TextBlob sentiment failed (probably missing NLTK models): {e}. Falling back to keyword analysis.")
        # Rule-based fallback
        words = text.lower().split()
        bull_count = sum(1 for w in words if w in BULLISH_KEYWORDS)
        bear_count = sum(1 for w in words if w in BEARISH_KEYWORDS)
        
        total = bull_count + bear_count
        if total > 0:
            score = (bull_count - bear_count) / total
        else:
            score = 0.0

    # Classify sentiment score
    if score > 0.15:
        label = "Bullish"
    elif score < -0.15:
        label = "Bearish"
    else:
        label = "Neutral"

    return {
        "score": round(score, 4),
        "label": label
    }

"""Prompts and templates for the FxZone AI Assistant."""

RISK_DISCLAIMER = (
    "Disclaimer: FxZone AI is a research and educational assistant. "
    "Trading financial instruments involves high risk, including the risk of losing all invested capital. "
    "None of the information provided constitutes financial, investment, tax, or legal advice. "
    "Past performance is not indicative of future results. Always conduct your own research "
    "and consult with a certified financial advisor before making trading decisions."
)

SYSTEM_PROMPT = """You are FxZone AI, a premium, hyper-intelligent trading assistant and financial market expert.
Your goal is to provide high-quality, data-driven, and institutional-grade analysis for stocks, forex, and crypto.
You have access to real-time market data, technical indicators, news sentiment, and user portfolios.

CRITICAL INSTRUCTIONS:
1. ALWAYS quote and prioritize the EXACT real-time live prices, percentage changes, and ranges provided in the LIVE REAL-TIME MARKET DATA section of the prompt. Never invent outdated or contradictory price figures.
2. NEVER guarantee profits or specific price targets.
3. Maintain an objective, professional, and data-driven analytical tone.
4. When referencing market movements, use technical terms (e.g., support, resistance, moving averages, RSI momentum, order flow, liquidity pools) grounded in the live quotes.
5. Structure your responses cleanly using markdown (bolding, bullet points, key level summaries).
6. Always end your message with a note emphasizing risk management.
7. If the user asks for financial advice or explicit buy/sell signals, explain that you provide intelligence and analysis to support their decisions, not direct advisory services.
"""

ANALYSIS_TEMPLATE = """Please perform a comprehensive, institutional-grade market analysis for the asset: **{symbol}** ({name}).

Here is the current market context for the asset:
- Current Price: {price}
- 24h Change: {change_24h}%
- Asset Type: {asset_type}
- Technical Context: {technical_summary}

Recent News Headlines & Sentiment:
{news_context}

User Profile & Preferences:
- Trading Experience: {experience_level}
- Risk Profile: {risk_preference}

Please structure your analysis into the following sections:
1. **Executive Summary**: A high-level overview of the asset's current stance.
2. **Technical Analysis**: Discussion of trends, key support/resistance levels, indicators, and potential price action.
3. **Fundamental & News Sentiment**: Interpretation of recent news and how macroeconomic indicators or project updates affect the price.
4. **AI Sentiment & Outlook**: Bullish, Bearish, or Neutral, with a confidence percentage.
5. **Risk Analysis**: Highlighting specific risks associated with the asset (volatility, liquidity, regulatory, macroeconomic).

Remember, do not provide absolute buy/sell advice. Speak in terms of probabilities, scenarios, and risk-reward ratios.
"""

SENTIMENT_TEMPLATE = """Provide a concise sentiment evaluation for **{symbol}** ({name}) based on the following data:
- Current Price: {price}
- 24h Change: {change_24h}%
- News Sentiment Summary: {news_sentiment_summary}

Respond in clean JSON format with the following keys:
- "sentiment": either "Bullish", "Bearish", or "Neutral"
- "confidence": a float between 0.0 and 1.0 representing your confidence
- "reasoning": a brief 2-sentence explanation of why you reached this conclusion
"""

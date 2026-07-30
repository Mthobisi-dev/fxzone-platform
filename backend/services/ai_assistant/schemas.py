"""Pydantic schemas for the AI Assistant service."""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class AIChatRequest(BaseModel):
    """Schema for AI chat requests."""
    message: str = Field(..., description="The user's message to the AI assistant.")
    conversation_id: Optional[str] = Field(None, description="The ID of the conversation for history retrieval. If None, a new conversation is created.")


class AIChatResponse(BaseModel):
    """Schema for AI chat responses."""
    message: str = Field(..., description="The AI assistant's response.")
    conversation_id: str = Field(..., description="The ID of the conversation.")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    risk_disclaimer: str = Field(..., description="Mandatory trading risk disclaimer.")


class AIAnalysisRequest(BaseModel):
    """Schema for asset analysis requests."""
    symbol: str = Field(..., description="The ticker symbol of the asset to analyze.")


class AIAnalysisResponse(BaseModel):
    """Schema for asset analysis responses."""
    symbol: str = Field(..., description="The ticker symbol of the analyzed asset.")
    name: str = Field(..., description="The name of the analyzed asset.")
    sentiment: str = Field(..., description="Bullish, Bearish, or Neutral.")
    confidence: float = Field(..., description="Confidence score between 0.0 and 1.0.")
    analysis: str = Field(..., description="Detailed markdown analysis.")
    risk_disclaimer: str = Field(..., description="Mandatory trading risk disclaimer.")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AISentimentResponse(BaseModel):
    """Schema for quick asset sentiment checks."""
    symbol: str = Field(..., description="The ticker symbol of the asset.")
    sentiment: str = Field(..., description="Bullish, Bearish, or Neutral.")
    confidence: float = Field(..., description="Confidence score between 0.0 and 1.0.")
    reasoning: str = Field(..., description="Short explanation of the sentiment.")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AIInsightItem(BaseModel):
    """Schema for a single AI insight item."""
    symbol: str
    name: str
    sentiment: str
    confidence: float
    summary: str
    timestamp: datetime


class AIInsightsResponse(BaseModel):
    """Schema for list of AI insights."""
    insights: List[AIInsightItem]
    timestamp: datetime = Field(default_factory=datetime.utcnow)

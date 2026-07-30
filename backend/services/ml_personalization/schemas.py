"""Pydantic schemas for FxZone ML Personalization service."""
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from datetime import datetime


class BehaviorEventCreate(BaseModel):
    """Schema to submit user dashboard interactions."""
    event_type: str = Field(..., description="Action: 'asset_view', 'chart_view', 'news_click', 'post_engage', 'trade_action'.")
    target_type: str = Field(..., description="Entity class: 'asset', 'news', 'post', 'trader'.")
    target_id: str = Field(..., description="The unique key of the entity, e.g. symbol or post ID.")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Context properties like duration_sec, device, etc.")


class PreferenceVectorResponse(BaseModel):
    """Schema representing the compiled user preferences profile."""
    user_id: str
    vector: Dict[str, float] = Field(..., description="Features representing interest scores per asset type.")
    risk_preference: float = Field(..., description="Risk score from 0.0 (conservative) to 1.0 (aggressive).")
    experience_level: str = Field(..., description="Level: 'beginner', 'intermediate', 'advanced', 'expert'.")
    updated_at: datetime

    class Config:
        from_attributes = True

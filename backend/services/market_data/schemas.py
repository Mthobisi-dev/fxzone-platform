"""FxZone Market Data Service - Schemas."""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class AssetResponse(BaseModel):
    id: str
    symbol: str
    name: str
    asset_type: str
    description: Optional[str] = None
    is_active: bool = True

    class Config:
        from_attributes = True


class PriceData(BaseModel):
    symbol: str
    price: float
    bid: float
    ask: float
    change: float
    change_pct: float
    daily_change: float
    daily_change_pct: float
    high: float
    low: float
    open: float
    volume: int
    timestamp: str


class CandlestickData(BaseModel):
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: int


class WatchlistCreate(BaseModel):
    name: str = "My Watchlist"


class WatchlistItemAdd(BaseModel):
    asset_id: str


class WatchlistResponse(BaseModel):
    id: str
    name: str
    items: List[AssetResponse] = []
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

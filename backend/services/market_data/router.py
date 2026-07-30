"""FxZone Market Data Service - API Router."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from shared.database import get_db
from shared.security import get_current_user
from services.market_data import service
from services.market_data.schemas import AssetResponse, PriceData, WatchlistCreate, WatchlistItemAdd, WatchlistResponse
from services.market_data.providers import price_engine

router = APIRouter(prefix="/api/market", tags=["Market Data"])


@router.get("/assets", response_model=List[AssetResponse])
async def list_assets(
    asset_type: Optional[str] = Query(None, description="Filter: forex, stock, crypto"),
    db: AsyncSession = Depends(get_db),
):
    """List all available assets."""
    assets = await service.get_all_assets(db, asset_type)
    return [AssetResponse(
        id=str(a.id), symbol=a.symbol, name=a.name,
        asset_type=a.asset_type.value if hasattr(a.asset_type, 'value') else a.asset_type,
        description=a.description, is_active=a.is_active,
    ) for a in assets]


@router.get("/assets/{symbol}", response_model=AssetResponse)
async def get_asset(symbol: str, db: AsyncSession = Depends(get_db)):
    """Get asset details by symbol."""
    a = await service.get_asset_by_symbol(db, symbol)
    return AssetResponse(
        id=str(a.id), symbol=a.symbol, name=a.name,
        asset_type=a.asset_type.value if hasattr(a.asset_type, 'value') else a.asset_type,
        description=a.description, is_active=a.is_active,
    )


@router.get("/prices")
async def get_all_prices():
    """Get current prices for all assets."""
    return await price_engine.get_all_prices()


@router.get("/prices/{symbol}")
async def get_price(symbol: str):
    """Get current price for a specific symbol."""
    price = await price_engine.get_price(symbol.upper())
    if not price:
        return {"error": f"Symbol {symbol} not found"}
    return price


@router.get("/prices/{symbol}/history")
async def get_price_history(
    symbol: str,
    timeframe: str = Query("1h", description="Timeframe: 1m, 5m, 15m, 1h, 4h, 1d"),
    limit: int = Query(100, le=500),
):
    """Get historical candlestick data."""
    return await price_engine.get_history(symbol.upper(), timeframe, limit)


@router.get("/watchlist")
async def get_watchlists(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user's watchlists."""
    watchlists = await service.get_user_watchlists(db, current_user["user_id"])
    result = []
    for wl in watchlists:
        items = []
        for item in wl.items:
            a = item.asset
            items.append(AssetResponse(
                id=str(a.id), symbol=a.symbol, name=a.name,
                asset_type=a.asset_type.value if hasattr(a.asset_type, 'value') else a.asset_type,
                description=a.description, is_active=a.is_active,
            ))
        result.append(WatchlistResponse(
            id=str(wl.id), name=wl.name, items=items, created_at=wl.created_at,
        ))
    return result


@router.post("/watchlist", status_code=201)
async def create_watchlist(
    data: WatchlistCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new watchlist."""
    wl = await service.create_watchlist(db, current_user["user_id"], data.name)
    return {"id": str(wl.id), "name": wl.name}


@router.post("/watchlist/{watchlist_id}/items", status_code=201)
async def add_watchlist_item(
    watchlist_id: str,
    data: WatchlistItemAdd,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add an asset to a watchlist."""
    await service.add_to_watchlist(db, watchlist_id, data.asset_id, current_user["user_id"])
    return {"status": "added"}


@router.delete("/watchlist/{watchlist_id}/items/{asset_id}")
async def remove_watchlist_item(
    watchlist_id: str,
    asset_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove an asset from a watchlist."""
    await service.remove_from_watchlist(db, watchlist_id, asset_id, current_user["user_id"])
    return {"status": "removed"}

"""FxZone Market Data Service - Business logic."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from fastapi import HTTPException
from shared.models import Asset, Watchlist, WatchlistItem
from services.market_data.providers import price_engine


async def get_all_assets(db: AsyncSession, asset_type: Optional[str] = None) -> List[Asset]:
    """Get all assets, optionally filtered by type."""
    query = select(Asset).where(Asset.is_active == True)
    if asset_type:
        query = query.where(Asset.asset_type == asset_type)
    query = query.order_by(Asset.symbol)
    result = await db.execute(query)
    return result.scalars().all()


async def get_asset_by_symbol(db: AsyncSession, symbol: str) -> Asset:
    """Get a single asset by symbol."""
    result = await db.execute(select(Asset).where(Asset.symbol == symbol.upper()))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset {symbol} not found")
    return asset


async def get_user_watchlists(db: AsyncSession, user_id: str) -> List[Watchlist]:
    """Get all watchlists for a user with their items."""
    result = await db.execute(
        select(Watchlist)
        .where(Watchlist.user_id == user_id)
        .options(selectinload(Watchlist.items).selectinload(WatchlistItem.asset))
    )
    return result.scalars().all()


async def create_watchlist(db: AsyncSession, user_id: str, name: str) -> Watchlist:
    """Create a new watchlist."""
    watchlist = Watchlist(user_id=user_id, name=name)
    db.add(watchlist)
    await db.flush()
    await db.refresh(watchlist)
    return watchlist


async def add_to_watchlist(db: AsyncSession, watchlist_id: str, asset_id: str, user_id: str) -> WatchlistItem:
    """Add an asset to a watchlist."""
    # Verify watchlist belongs to user
    result = await db.execute(
        select(Watchlist).where(Watchlist.id == watchlist_id, Watchlist.user_id == user_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Watchlist not found")

    # Check if already in watchlist
    result = await db.execute(
        select(WatchlistItem).where(
            WatchlistItem.watchlist_id == watchlist_id,
            WatchlistItem.asset_id == asset_id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Asset already in watchlist")

    item = WatchlistItem(watchlist_id=watchlist_id, asset_id=asset_id)
    db.add(item)
    await db.flush()
    return item


async def remove_from_watchlist(db: AsyncSession, watchlist_id: str, asset_id: str, user_id: str):
    """Remove an asset from a watchlist."""
    result = await db.execute(
        select(Watchlist).where(Watchlist.id == watchlist_id, Watchlist.user_id == user_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Watchlist not found")

    result = await db.execute(
        select(WatchlistItem).where(
            WatchlistItem.watchlist_id == watchlist_id,
            WatchlistItem.asset_id == asset_id,
        )
    )
    item = result.scalar_one_or_none()
    if item:
        await db.delete(item)
        await db.flush()

"""FxZone Market Data Service - Business logic."""
import uuid
from typing import List, Optional, Any
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from shared.models import Asset, Watchlist, WatchlistItem
from services.market_data.providers import price_engine


def to_uuid(val: Any) -> Any:
    """Helper to convert string/int/UUID to Python UUID object."""
    if val is None or isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except (ValueError, AttributeError, TypeError):
        return str(val)


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


async def get_user_watchlists(db: AsyncSession, user_id: Any) -> List[Watchlist]:
    """Get all watchlists for a user with their items."""
    u_uuid = to_uuid(user_id)
    result = await db.execute(
        select(Watchlist)
        .where(Watchlist.user_id == u_uuid)
        .options(selectinload(Watchlist.items).selectinload(WatchlistItem.asset))
    )
    return result.scalars().all()


async def create_watchlist(db: AsyncSession, user_id: Any, name: str) -> Watchlist:
    """Create a new watchlist."""
    u_uuid = to_uuid(user_id)
    watchlist = Watchlist(user_id=u_uuid, name=name)
    db.add(watchlist)
    await db.commit()
    await db.refresh(watchlist)
    return watchlist


async def add_to_watchlist(db: AsyncSession, watchlist_id: Any, asset_id: Any, user_id: Any) -> WatchlistItem:
    """Add an asset to a watchlist."""
    w_uuid = to_uuid(watchlist_id)
    a_uuid = to_uuid(asset_id)
    u_uuid = to_uuid(user_id)

    # Verify watchlist belongs to user
    result = await db.execute(
        select(Watchlist).where(Watchlist.id == w_uuid, Watchlist.user_id == u_uuid)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Watchlist not found")

    # Check if already in watchlist
    result = await db.execute(
        select(WatchlistItem).where(
            WatchlistItem.watchlist_id == w_uuid,
            WatchlistItem.asset_id == a_uuid,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Asset already in watchlist")

    item = WatchlistItem(watchlist_id=w_uuid, asset_id=a_uuid)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def remove_from_watchlist(db: AsyncSession, watchlist_id: Any, asset_id: Any, user_id: Any):
    """Remove an asset from a watchlist."""
    w_uuid = to_uuid(watchlist_id)
    a_uuid = to_uuid(asset_id)
    u_uuid = to_uuid(user_id)

    result = await db.execute(
        select(Watchlist).where(Watchlist.id == w_uuid, Watchlist.user_id == u_uuid)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Watchlist not found")

    result = await db.execute(
        select(WatchlistItem).where(
            WatchlistItem.watchlist_id == w_uuid,
            WatchlistItem.asset_id == a_uuid,
        )
    )
    item = result.scalar_one_or_none()
    if item:
        await db.delete(item)
        await db.commit()

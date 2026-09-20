from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, Response

from ..db import Database
from ..deps import get_db
from ..errors import BadRequest, NotFound
from ..ratelimit import rate_limit
from ..schemas import WatchlistBody, WatchlistItemBody
from ..security import CurrentUser, require_user
from ..services.market.catalog import BY_SYMBOL, resolve_asset
from ..services.market.service import MarketService
from ..services.posts import is_uuid

router = APIRouter(prefix="/api/market", tags=["market"])
MAX_WATCHLISTS, MAX_ITEMS = 20, 100
_ASSET_COLS = "id, symbol, name, asset_type::text AS asset_type, description, is_active"


def _market(request: Request) -> MarketService:
    return request.app.state.market


def _asset(r: dict[str, Any]) -> dict[str, Any]:
    return {"id": str(r["id"]), "symbol": r["symbol"], "name": r["name"], "asset_type": r["asset_type"],
            "description": r["description"], "is_active": r["is_active"]}


def _parse_symbols(raw: str | None) -> list[str]:
    return [s.strip().upper() for s in (raw or "").split(",") if s.strip()][:60]


@router.get("/assets", dependencies=[Depends(rate_limit("market_read", 240))])
async def assets(response: Response, asset_type: str | None = Query(None, max_length=20), q: str | None = Query(None, max_length=30),
                 db: Database = Depends(get_db)):
    rows = await db.fetch(
        f"""SELECT {_ASSET_COLS} FROM assets WHERE is_active AND ($1::text IS NULL OR asset_type::text = $1)
            AND ($2::text IS NULL OR symbol ILIKE $2 OR name ILIKE $2) ORDER BY asset_type, symbol""",
        asset_type, f"%{q}%" if q else None)
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=120"
    return [_asset(r) for r in rows]


@router.get("/prices", dependencies=[Depends(rate_limit("market_read", 240))])
async def prices(request: Request, symbols: str | None = None):
    """No `symbols` -> array of all quotes; with `symbols` -> {SYMBOL: quote} (shapes the UI already relies on)."""
    wanted = _parse_symbols(symbols)
    quotes = await _market(request).get_quotes(wanted or None)
    return quotes if wanted else list(quotes.values())


@router.get("/quotes", dependencies=[Depends(rate_limit("market_read", 240))])
async def quotes(request: Request):
    """Array of quotes (the feed page does `Array.isArray(...)` and reads change_percent)."""
    return list((await _market(request).get_quotes()).values())


@router.get("/prices/{symbol}/history", dependencies=[Depends(rate_limit("market_history", 120))])
async def history(symbol: str, request: Request, timeframe: str = Query("1h", max_length=4), limit: int = Query(300, ge=10, le=2000)):
    return await _market(request).get_history(symbol, timeframe, limit)


# ───────────────────────────── watchlists (owner-scoped) ─────────────────────────────
_WL_SELECT = """
SELECT w.id, w.name, w.created_at,
  COALESCE(json_agg(json_build_object('id', a.id, 'symbol', a.symbol, 'name', a.name, 'asset_type', a.asset_type::text,
           'description', a.description, 'is_active', a.is_active) ORDER BY wi.added_at) FILTER (WHERE a.id IS NOT NULL), '[]'::json) AS items
FROM watchlists w LEFT JOIN watchlist_items wi ON wi.watchlist_id = w.id LEFT JOIN assets a ON a.id = wi.asset_id
WHERE w.user_id = $1 {extra} GROUP BY w.id ORDER BY w.created_at, w.id"""


def _wl(r: dict[str, Any]) -> dict[str, Any]:
    return {"id": str(r["id"]), "name": r["name"], "created_at": r["created_at"], "items": r["items"]}


async def _default_watchlist(db: Database, user: CurrentUser) -> uuid.UUID:
    wid = await db.fetchval("SELECT id FROM watchlists WHERE user_id = $1 ORDER BY created_at, id LIMIT 1", user.id)
    if wid is None:
        wid = await db.fetchval("INSERT INTO watchlists (user_id, name) VALUES ($1, 'My Watchlist') RETURNING id", user.id)
    return wid


async def _resolve_watchlist(db: Database, user: CurrentUser, raw: str) -> uuid.UUID:
    """The UI may hold a placeholder id ('watchlist-default') before the first fetch completes -> the user's default list."""
    if not is_uuid(raw):
        return await _default_watchlist(db, user)
    wid = await db.fetchval("SELECT id FROM watchlists WHERE id = $1 AND user_id = $2", uuid.UUID(raw), user.id)
    if wid is None:
        raise NotFound("Watchlist not found")  # also the answer for someone else's list: existence is not revealed
    return wid


async def _resolve_asset_id(db: Database, asset_id: str | None, symbol: str | None) -> tuple[uuid.UUID, str]:
    for cand in (asset_id, symbol):
        if not cand:
            continue
        if is_uuid(cand):
            row = await db.fetchrow("SELECT id, symbol FROM assets WHERE id = $1 AND is_active", uuid.UUID(cand))
        else:
            known = resolve_asset(cand)
            row = await db.fetchrow("SELECT id, symbol FROM assets WHERE symbol = $1 AND is_active", (known.symbol if known else cand.upper()))
        if row:
            return row["id"], row["symbol"]
    raise NotFound("Asset not found")


@router.get("/watchlist")
async def get_watchlists(user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    await _default_watchlist(db, user)  # every user always has at least one, so the UI gets a real id
    return [_wl(r) for r in await db.fetch(_WL_SELECT.format(extra=""), user.id)]


@router.post("/watchlist", status_code=201, dependencies=[Depends(rate_limit("watchlist_write", 30))])
async def create_watchlist(body: WatchlistBody, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    if await db.fetchval("SELECT count(*) FROM watchlists WHERE user_id = $1", user.id) >= MAX_WATCHLISTS:
        raise BadRequest(f"You can have at most {MAX_WATCHLISTS} watchlists")
    row = await db.fetchrow("INSERT INTO watchlists (user_id, name) VALUES ($1,$2) RETURNING id, name, created_at", user.id, body.name)
    return {"id": str(row["id"]), "name": row["name"], "created_at": row["created_at"], "items": []}


@router.patch("/watchlist/{watchlist_id}")
async def rename_watchlist(watchlist_id: str, body: WatchlistBody, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    wid = await _resolve_watchlist(db, user, watchlist_id)
    await db.execute("UPDATE watchlists SET name = $2 WHERE id = $1", wid, body.name)
    return _wl((await db.fetch(_WL_SELECT.format(extra="AND w.id = $2"), user.id, wid))[0])


@router.delete("/watchlist/{watchlist_id}")
async def delete_watchlist(watchlist_id: str, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    if is_uuid(watchlist_id):
        await db.execute("DELETE FROM watchlists WHERE id = $1 AND user_id = $2", uuid.UUID(watchlist_id), user.id)
    return {"success": True}


@router.post("/watchlist/{watchlist_id}/items", dependencies=[Depends(rate_limit("watchlist_write", 60))])
async def add_item(watchlist_id: str, body: WatchlistItemBody, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    wid = await _resolve_watchlist(db, user, watchlist_id)
    asset_id, symbol = await _resolve_asset_id(db, body.asset_id, body.symbol)
    if await db.fetchval("SELECT count(*) FROM watchlist_items WHERE watchlist_id = $1", wid) >= MAX_ITEMS:
        raise BadRequest(f"A watchlist can hold at most {MAX_ITEMS} assets")
    await db.execute("INSERT INTO watchlist_items (watchlist_id, asset_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", wid, asset_id)
    return {"success": True, "watchlist_id": str(wid), "symbol": symbol, "asset_id": str(asset_id)}


async def _remove(db: Database, user: CurrentUser, watchlist_id: str, asset_id: str | None, symbol: str | None) -> dict:
    wid = await _resolve_watchlist(db, user, watchlist_id)
    try:
        aid, _ = await _resolve_asset_id(db, asset_id, symbol)
    except NotFound:
        return {"success": True}  # removing something that does not exist is a no-op
    await db.execute("DELETE FROM watchlist_items WHERE watchlist_id = $1 AND asset_id = $2", wid, aid)
    return {"success": True}


@router.delete("/watchlist/{watchlist_id}/items/{asset}")
async def remove_item(watchlist_id: str, asset: str, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    return await _remove(db, user, watchlist_id, asset, asset)


@router.delete("/watchlist/{watchlist_id}/items")
async def remove_item_body(watchlist_id: str, body: WatchlistItemBody, user: CurrentUser = Depends(require_user), db: Database = Depends(get_db)):
    return await _remove(db, user, watchlist_id, body.asset_id, body.symbol)

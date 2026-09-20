from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(tags=["health"])


@router.get("/health")
@router.get("/api/health")
async def liveness():
    return {"status": "ok"}


@router.get("/health/ready")
async def readiness(request: Request):
    st = request.app.state
    db_ok = await st.db.ping()
    redis_ok = await st.cache.ping()  # None => not configured
    quotes = await st.cache.get_json("market:quotes") or {}
    body = {
        "status": "ok" if db_ok and redis_ok is not False else "degraded",
        "checks": {"database": db_ok, "redis": "disabled" if redis_ok is None else redis_ok},
        "features": {"realtime_broadcast": st.realtime.enabled, "gemini": st.ai.gemini_enabled,
                     "storage": st.settings.storage_backend, "market_symbols_cached": len(quotes),
                     "state_backend": st.cache.backend},
    }
    return JSONResponse(body, status_code=200 if db_ok else 503)

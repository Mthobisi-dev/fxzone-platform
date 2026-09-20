"""Fixed-window rate limiting as a FastAPI dependency factory."""
from __future__ import annotations

from fastapi import Depends, Request, Response

from .cache import Cache
from .config import Settings
from .deps import get_cache, get_settings_dep
from .errors import TooManyRequests
from .security import CurrentUser, optional_user


def client_ip(request: Request, settings: Settings) -> str:
    if settings.trust_proxy_headers:
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(name: str, limit: int | None = None, window: int = 60):
    """Limit per authenticated user (or per IP for anonymous callers).
    Place AFTER require_user in a route's dependencies so auth errors come first."""

    async def dependency(request: Request, response: Response, user: CurrentUser | None = Depends(optional_user),
                         cache: Cache = Depends(get_cache), settings: Settings = Depends(get_settings_dep)) -> None:
        max_calls = limit if limit is not None else (
            settings.rate_limit_default_per_minute if user else settings.rate_limit_anonymous_per_minute)
        identity = f"u:{user.sid}" if user else f"ip:{client_ip(request, settings)}"
        count, ttl = await cache.hit(f"rl:{name}:{identity}", window)
        remaining = max(max_calls - count, 0)
        response.headers["X-RateLimit-Limit"] = str(max_calls)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        if count > max_calls:
            raise TooManyRequests("Rate limit exceeded. Please slow down.", headers={
                "Retry-After": str(ttl), "X-RateLimit-Limit": str(max_calls), "X-RateLimit-Remaining": "0"})

    return dependency

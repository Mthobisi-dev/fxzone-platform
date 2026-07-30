"""FxZone middleware - rate limiting and request logging."""
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from shared.database import get_redis

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Redis-based sliding window rate limiter."""

    def __init__(self, app, max_requests: int = 100, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for WebSocket upgrades and health checks
        if request.url.path in ("/health", "/docs", "/openapi.json") or request.url.path.startswith("/ws"):
            return await call_next(request)

        redis = get_redis()
        if not redis:
            return await call_next(request)

        # Use IP + path as rate limit key
        client_ip = request.client.host if request.client else "unknown"
        auth_header = request.headers.get("authorization", "")
        identifier = auth_header[-8:] if auth_header else client_ip
        key = f"rate_limit:{identifier}"

        try:
            current = await redis.get(key)
            if current and int(current) >= self.max_requests:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded. Please try again later."},
                )
            pipe = redis.pipeline()
            pipe.incr(key)
            pipe.expire(key, self.window_seconds)
            await pipe.execute()
        except Exception:
            pass  # Don't block requests if Redis is down

        return await call_next(request)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log request method, path, and response time."""

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000

        if not request.url.path.startswith("/ws"):
            logger.info(
                f"{request.method} {request.url.path} - {response.status_code} - {process_time:.1f}ms"
            )

        response.headers["X-Process-Time"] = f"{process_time:.1f}ms"
        return response

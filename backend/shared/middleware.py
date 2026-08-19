"""FxZone middleware - rate limiting and request logging."""
import time
import hashlib
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from shared.database import get_redis

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Redis-based fixed window rate limiter with atomic counter."""

    def __init__(self, app, max_requests: int = 180, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for CORS preflight, health checks, docs, uploads, and WebSocket upgrades
        if (
            request.method == "OPTIONS"
            or request.url.path in ("/health", "/docs", "/openapi.json", "/")
            or request.url.path.startswith("/ws")
            or request.url.path.startswith("/uploads")
        ):
            return await call_next(request)

        redis = get_redis()
        if not redis:
            return await call_next(request)

        # Build stable rate limit key using client IP or hashed Authorization token
        client_ip = request.client.host if request.client else "unknown"
        auth_header = request.headers.get("authorization", "")
        if auth_header:
            token_hash = hashlib.sha256(auth_header.encode("utf-8")).hexdigest()[:16]
            identifier = f"user_{token_hash}"
        else:
            identifier = f"ip_{client_ip}"

        key = f"rate_limit:{identifier}"

        try:
            current = await redis.incr(key)
            if current == 1:
                await redis.expire(key, self.window_seconds)

            if current > self.max_requests:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded. Please try again later."},
                    headers={"Retry-After": str(self.window_seconds)}
                )
        except Exception as e:
            logger.debug(f"Rate limiter bypass notice: {e}")

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
        # Strictly prevent caching of dynamic API responses across all browsers and edge CDNs
        if not request.url.path.startswith("/uploads"):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response

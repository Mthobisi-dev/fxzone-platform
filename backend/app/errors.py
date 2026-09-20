"""Error types and handlers. The frontend reads `detail`, so every error body carries it."""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("fxzone.errors")


class AppError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, detail: str, *, status_code: int | None = None, code: str | None = None,
                 headers: dict[str, str] | None = None):
        super().__init__(detail)
        self.detail = detail
        if status_code is not None:
            self.status_code = status_code
        if code is not None:
            self.code = code
        self.headers = headers or {}


class BadRequest(AppError):
    status_code, code = 400, "bad_request"


class Unauthorized(AppError):
    status_code, code = 401, "unauthorized"

    def __init__(self, detail: str = "Not authenticated"):
        super().__init__(detail, headers={"WWW-Authenticate": "Bearer"})


class Forbidden(AppError):
    status_code, code = 403, "forbidden"


class NotFound(AppError):
    status_code, code = 404, "not_found"


class Conflict(AppError):
    status_code, code = 409, "conflict"


class TooManyRequests(AppError):
    status_code, code = 429, "rate_limited"


class UpstreamUnavailable(AppError):
    status_code, code = 503, "upstream_unavailable"


def _body(request: Request, detail: str, code: str, **extra) -> dict:
    return {"detail": detail, "code": code, "request_id": getattr(request.state, "request_id", None), **extra}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError):
        return JSONResponse(_body(request, exc.detail, exc.code), status_code=exc.status_code, headers=exc.headers)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(request: Request, exc: StarletteHTTPException):
        detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
        return JSONResponse(_body(request, detail, "http_error"), status_code=exc.status_code,
                            headers=getattr(exc, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError):
        errors = []
        for e in exc.errors():
            loc = ".".join(str(p) for p in e.get("loc", []) if p not in ("body", "query", "path"))
            errors.append({"field": loc, "message": e.get("msg", "invalid")})
        first = errors[0] if errors else {"field": "", "message": "invalid request"}
        detail = f"{first['field']}: {first['message']}" if first["field"] else first["message"]
        return JSONResponse(_body(request, detail, "validation_error", errors=errors), status_code=422)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        # Never leak internals to clients; the request id ties the response to the log line.
        log.exception("unhandled error", extra={"request_id": getattr(request.state, "request_id", None)})
        return JSONResponse(_body(request, "Internal server error", "internal_error"), status_code=500)

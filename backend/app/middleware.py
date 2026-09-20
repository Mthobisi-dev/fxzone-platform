"""Pure-ASGI middleware: request ids, security headers, body-size limits, access logging."""
from __future__ import annotations

import logging
import time
import uuid

from starlette.exceptions import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

log = logging.getLogger("fxzone.access")

UPLOAD_PATH = "/api/social/posts/upload"


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp, *, max_json_bytes: int, max_upload_bytes: int, hsts: bool) -> None:
        self.app = app
        self.max_json = max_json_bytes
        self.max_upload = max_upload_bytes + 64 * 1024  # multipart envelope overhead
        self.hsts = hsts

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope["headers"]}
        incoming = headers.get("x-request-id", "")
        request_id = incoming if 8 <= len(incoming) <= 64 and incoming.replace("-", "").isalnum() else uuid.uuid4().hex
        scope.setdefault("state", {})["request_id"] = request_id

        path = scope["path"]
        limit = self.max_upload if path == UPLOAD_PATH else self.max_json
        declared = headers.get("content-length")
        if declared and declared.isdigit() and int(declared) > limit:
            await self._reject(send, request_id, 413, "Request body too large")
            return

        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise HTTPException(status_code=413, detail="Request body too large")
            return message

        started = time.perf_counter()
        status_holder = {"status": 500}

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                status_holder["status"] = message["status"]
                hdrs = list(message.get("headers", []))
                existing = {k.lower() for k, _ in hdrs}

                def add(name: bytes, value: str) -> None:
                    if name not in existing:
                        hdrs.append((name, value.encode("latin-1")))

                add(b"x-request-id", request_id)
                add(b"x-content-type-options", "nosniff")
                add(b"x-frame-options", "DENY")
                add(b"referrer-policy", "no-referrer")
                add(b"content-security-policy", "default-src 'none'; frame-ancestors 'none'")
                if path.startswith("/api/"):
                    add(b"cache-control", "no-store")
                if self.hsts:
                    add(b"strict-transport-security", "max-age=31536000; includeSubDomains")
                message["headers"] = hdrs
            await send(message)

        try:
            await self.app(scope, limited_receive, send_wrapper)
        finally:
            state = scope.get("state", {})
            log.info("%s %s -> %s", scope["method"], path, status_holder["status"], extra={
                "request_id": request_id,
                "duration_ms": round((time.perf_counter() - started) * 1000, 1),
                "user_id": state.get("user_id"),
            })

    @staticmethod
    async def _reject(send: Send, request_id: str, status: int, detail: str) -> None:
        import json
        body = json.dumps({"detail": detail, "code": "payload_too_large", "request_id": request_id}).encode()
        await send({"type": "http.response.start", "status": status, "headers": [
            (b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()),
            (b"x-request-id", request_id.encode())]})
        await send({"type": "http.response.body", "body": body})

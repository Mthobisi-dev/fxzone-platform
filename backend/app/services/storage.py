"""Upload validation (magic bytes, never the client-declared type/extension) and storage back-ends."""
from __future__ import annotations

import logging
import uuid
from pathlib import Path

import httpx

from ..config import Settings
from ..errors import BadRequest, UpstreamUnavailable

log = logging.getLogger("fxzone.storage")


def detect_media(head: bytes, declared: str | None = None) -> tuple[str, str] | None:
    """(mime, extension) from file signature, or None if not an allowed type. SVG/HTML are deliberately not allowed."""
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif", "gif"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp", "webp"
    if head[:4] == b"RIFF" and head[8:12] == b"WAVE":
        return "audio/wav", "wav"
    if head.startswith(b"%PDF-"):
        return "application/pdf", "pdf"
    if head.startswith(b"\x1a\x45\xdf\xa3"):  # EBML: WebM (voice notes / screen recordings)
        return ("audio/webm", "webm") if (declared or "").startswith("audio/") else ("video/webm", "webm")
    if head[4:8] == b"ftyp":
        brand = head[8:12]
        if brand in (b"M4A ", b"M4B "):
            return "audio/mp4", "m4a"
        if brand == b"qt  ":
            return "video/quicktime", "mov"
        return "video/mp4", "mp4"
    if head.startswith(b"OggS"):
        return "audio/ogg", "ogg"
    if head.startswith(b"ID3") or (len(head) > 1 and head[0] == 0xFF and (head[1] & 0xE0) == 0xE0):
        return "audio/mpeg", "mp3"
    return None


class StorageService:
    def __init__(self, settings: Settings, http: httpx.AsyncClient) -> None:
        self.s, self.http = settings, http

    async def save(self, user_id: str, data: bytes, mime: str, ext: str) -> str:
        name = f"{user_id}/{uuid.uuid4().hex}.{ext}"
        if self.s.storage_backend == "local":
            path = Path(self.s.upload_dir) / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            base = (self.s.public_base_url or "").rstrip("/")
            return f"{base}/uploads/{name}"

        if not (self.s.supabase_url and self.s.supabase_service_role_key):
            raise UpstreamUnavailable("File storage is not configured")
        url = f"{self.s.supabase_url}/storage/v1/object/{self.s.storage_bucket}/{name}"
        try:
            r = await self.http.post(url, content=data, timeout=60, headers={
                "Authorization": f"Bearer {self.s.supabase_service_role_key}",
                "apikey": self.s.supabase_service_role_key, "Content-Type": mime, "x-upsert": "false"})
        except httpx.HTTPError as e:
            log.error("storage upload transport error: %s", e)
            raise UpstreamUnavailable("File storage temporarily unavailable") from None
        if r.status_code >= 300:
            log.error("storage upload failed: %s %s", r.status_code, r.text[:200])
            raise UpstreamUnavailable("File storage rejected the upload")
        return f"{self.s.supabase_url}/storage/v1/object/public/{self.s.storage_bucket}/{name}"


async def read_limited(upload, max_bytes: int) -> bytes:
    """Stream an UploadFile into memory, aborting as soon as the limit is exceeded."""
    chunks, size = [], 0
    while True:
        chunk = await upload.read(256 * 1024)
        if not chunk:
            break
        size += len(chunk)
        if size > max_bytes:
            raise BadRequest(f"File too large (max {max_bytes // (1024 * 1024)} MB)")
        chunks.append(chunk)
    if not size:
        raise BadRequest("Empty file")
    return b"".join(chunks)

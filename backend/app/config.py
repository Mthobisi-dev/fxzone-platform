"""Typed, validated configuration. Everything comes from environment variables / .env."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── runtime ────────────────────────────────────────────────────────────
    environment: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:3000"  # comma separated
    trust_proxy_headers: bool = False  # honour X-Forwarded-For (only behind a proxy YOU control)

    # ── database (Supabase Postgres: use the pooler or direct connection string) ──
    database_url: str = "postgresql://postgres:postgres@localhost:5432/fxzone"
    database_ssl: Literal["disable", "require", "verify-full"] = "disable"
    database_ssl_root_cert: str | None = None  # path to the Supabase CA cert for verify-full
    db_pool_min: int = 1
    db_pool_max: int = 10
    db_statement_timeout_ms: int = 15000

    # ── Supabase (auth, storage, realtime) ─────────────────────────────────
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    supabase_jwt_secret: str | None = None  # legacy HS256 projects; leave empty for asymmetric JWKS
    supabase_jwt_audience: str = "authenticated"

    # ── redis (rate-limits, price cache, leader lock) ──────────────────────
    redis_url: str | None = None
    allow_in_memory_state: bool = False  # production may run WITHOUT redis only if this is explicit

    # ── uploads ────────────────────────────────────────────────────────────
    storage_backend: Literal["supabase", "local"] = "supabase"
    storage_bucket: str = "post-media"
    upload_dir: str = "./uploads"  # storage_backend=local only (dev/test)
    max_upload_bytes: int = 25 * 1024 * 1024
    public_base_url: str | None = None  # used to build URLs for local storage

    # ── market data / AI / news ────────────────────────────────────────────
    market_refresh_seconds: int = 15
    market_stale_after_seconds: int = 180
    enable_background_tasks: bool = True
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    news_feeds: str = (
        "Yahoo Finance|https://finance.yahoo.com/news/rssindex,"
        "CoinDesk|https://www.coindesk.com/arc/outboundfeeds/rss/"
    )
    news_refresh_seconds: int = 600
    asset_sync_on_startup: bool = True

    # ── limits ─────────────────────────────────────────────────────────────
    rate_limit_default_per_minute: int = 240
    rate_limit_anonymous_per_minute: int = 120
    max_json_body_bytes: int = 1_000_000

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def news_feed_list(self) -> list[tuple[str, str]]:
        feeds: list[tuple[str, str]] = []
        for chunk in self.news_feeds.split(","):
            if "|" in chunk:
                name, url = chunk.split("|", 1)
                if name.strip() and url.strip():
                    feeds.append((name.strip(), url.strip()))
        return feeds

    @property
    def supabase_auth_issuer(self) -> str | None:
        return f"{self.supabase_url.rstrip('/')}/auth/v1" if self.supabase_url else None

    @model_validator(mode="after")
    def _validate(self) -> "Settings":
        if self.supabase_url:
            self.supabase_url = self.supabase_url.rstrip("/")
        if self.database_ssl == "verify-full" and self.database_ssl_root_cert and not Path(self.database_ssl_root_cert).is_file():
            raise ValueError("DATABASE_SSL_ROOT_CERT does not point to a readable certificate file")
        if self.is_production:
            problems: list[str] = []
            if not (self.supabase_jwt_secret or self.supabase_url):
                problems.append("SUPABASE_JWT_SECRET or SUPABASE_URL (for JWKS) is required to verify tokens")
            if not self.supabase_url or not self.supabase_service_role_key:
                problems.append("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (storage, realtime, account deletion)")
            if self.database_ssl == "disable":
                problems.append("DATABASE_SSL must be 'require' or 'verify-full' in production")
            if self.database_ssl == "verify-full" and not self.database_ssl_root_cert:
                # system CA bundle is used when no root cert is supplied; Supabase certs need theirs
                pass
            if not self.redis_url and not self.allow_in_memory_state:
                problems.append("REDIS_URL is required in production (or set ALLOW_IN_MEMORY_STATE=true for a single instance)")
            if self.storage_backend == "local":
                problems.append("STORAGE_BACKEND=local is for development only")
            if "*" in self.cors_origin_list:
                problems.append("CORS_ORIGINS must not contain '*'")
            if problems:
                raise ValueError("Unsafe production configuration:\n  - " + "\n  - ".join(problems))
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]

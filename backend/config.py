"""FxZone Backend Configuration."""
import json
from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://fxzone:fxzone@localhost:5432/fxzone"
    REDIS_URL: str = "redis://localhost:6379"
    MONGODB_URL: str = "mongodb://localhost:27017"

    # Supabase
    SUPABASE_URL: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None

    # Auth
    SECRET_KEY: str = "fxzone-dev-secret-key-change-in-production-2024"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    SUPABASE_JWT_SECRET: Optional[str] = None

    # AI (optional)
    OPENAI_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None

    # Market Data (optional)
    ALPHA_VANTAGE_KEY: Optional[str] = None
    FINNHUB_KEY: Optional[str] = None

    # App
    CORS_ORIGINS: str = '["http://localhost:3000","https://fxzone-platform-4dqe.vercel.app","https://fxzone-platform.vercel.app"]'
    APP_ENV: str = "development"

    @property
    def cors_origins_list(self) -> List[str]:
        try:
            origins = json.loads(self.CORS_ORIGINS)
        except (json.JSONDecodeError, TypeError):
            origins = ["http://localhost:3000"]
        return origins

    @property
    def async_database_url(self) -> str:
        """Ensure the DATABASE_URL uses the asyncpg driver dialect for SQLAlchemy and sanitize query parameters."""
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

        # asyncpg does not accept ?sslmode= in the connection query string
        if "?" in url:
            base_url, query_str = url.split("?", 1)
            params = [p for p in query_str.split("&") if not p.startswith("sslmode=")]
            if params:
                url = f"{base_url}?{'&'.join(params)}"
            else:
                url = base_url
        return url

    @property
    def use_supabase(self) -> bool:
        """Check if Supabase credentials are configured."""
        return bool(self.SUPABASE_URL and self.SUPABASE_ANON_KEY)

    class Config:
        env_file = "../.env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()

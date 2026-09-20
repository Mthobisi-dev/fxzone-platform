"""FastAPI dependency accessors for objects living on app.state."""
from __future__ import annotations

from fastapi import Request

from .cache import Cache
from .config import Settings
from .db import Database
from .realtime import RealtimePublisher


def get_settings_dep(request: Request) -> Settings:
    return request.app.state.settings


def get_db(request: Request) -> Database:
    return request.app.state.db


def get_cache(request: Request) -> Cache:
    return request.app.state.cache


def get_realtime(request: Request) -> RealtimePublisher:
    return request.app.state.realtime

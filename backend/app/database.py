"""Async and sync SQLAlchemy engine, session factories, and declarative base."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# ── Async (FastAPI) ───────────────────────────────────────────────────────
engine = create_async_engine(settings.DATABASE_URL, echo=False, future=True)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ── Sync (Celery tasks) ──────────────────────────────────────────────────
# Lazy-initialised so that psycopg2 is only imported inside the Celery worker,
# not in the FastAPI backend container where it may not be installed.
_sync_engine = None
_sync_session_factory = None


def _init_sync():
    global _sync_engine, _sync_session_factory
    if _sync_engine is None:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker

        _sync_url = settings.DATABASE_URL.replace("+asyncpg", "+psycopg2")
        _sync_engine = create_engine(_sync_url, echo=False, future=True)
        _sync_session_factory = sessionmaker(bind=_sync_engine, expire_on_commit=False)


def SyncSessionLocal():
    """Return a new synchronous DB session (initialises engine on first call)."""
    _init_sync()
    return _sync_session_factory()


class Base(DeclarativeBase):
    """Base class for all ORM models."""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

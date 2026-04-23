import logging
from collections.abc import AsyncGenerator

from sqlalchemy import event, inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import src.models.orm.study_room  # noqa: F401 — ensures ORM mappers are registered before create_all
import src.models.orm.user_role  # noqa: F401 — ensures ORM mappers are registered before create_all
from src.config.app_settings import AppSettings
from src.db.base import Base

_logger = logging.getLogger(__name__)

_engine = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def init_engine(settings: AppSettings) -> None:
    global _engine, _session_factory
    _engine = create_async_engine(
        settings.database_url,
        echo=False,
    )
    if settings.database_url.startswith("sqlite"):
        @event.listens_for(_engine.sync_engine, "connect")
        def _sqlite_fk(dbapi_connection: object, connection_record: object) -> None:
            cur = dbapi_connection.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.close()
    _session_factory = async_sessionmaker(
        _engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
        autobegin=False,
    )


# Lightweight idempotent schema patches, applied after `create_all`, for columns
# that were added to existing tables. `create_all` only creates missing *tables*
# — it never touches existing ones — so any additive column must be repaired
# here. Each entry is (table, column, DDL fragment). Order matters: entries are
# applied top-to-bottom.
_ADDITIVE_COLUMN_PATCHES: list[tuple[str, str, str]] = [
    (
        "bookings",
        "paid_amount",
        "ALTER TABLE bookings ADD COLUMN paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0",
    ),
    (
        "seats",
        "is_enabled",
        # Use TRUE not 1 — PostgreSQL rejects integer default on BOOLEAN columns.
        "ALTER TABLE seats ADD COLUMN is_enabled BOOLEAN NOT NULL DEFAULT TRUE",
    ),
    (
        "bookings",
        "reversion_snapshot",
        "ALTER TABLE bookings ADD COLUMN reversion_snapshot TEXT",
    ),
]


async def create_tables() -> None:
    assert _engine is not None
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_apply_additive_column_patches)


def _apply_additive_column_patches(sync_conn: object) -> None:
    """Add columns that were introduced after tables were originally created.

    Scope is intentionally narrow: only *additive* DDL, never destructive. Runs
    on every startup but is idempotent — we check the live schema first and
    only emit ALTER TABLE when the column is actually missing.
    """
    inspector = inspect(sync_conn)
    existing_tables = set(inspector.get_table_names())
    for table, column, ddl in _ADDITIVE_COLUMN_PATCHES:
        if table not in existing_tables:
            continue
        cols = {c["name"] for c in inspector.get_columns(table)}
        if column in cols:
            continue
        _logger.info("Applying additive schema patch: %s.%s", table, column)
        sync_conn.execute(text(ddl))


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """One transaction per HTTP request (commit on success, rollback on error)."""
    assert _session_factory is not None
    async with _session_factory() as session:
        async with session.begin():
            yield session


def get_async_session_maker() -> async_sessionmaker[AsyncSession]:
    assert _session_factory is not None
    return _session_factory


def get_engine():
    return _engine

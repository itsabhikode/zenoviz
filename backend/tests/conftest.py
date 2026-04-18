"""Pytest hooks: force SQLite for tests so DATABASE_URL from .env never points at missing Postgres."""

import os


def pytest_configure(config: object) -> None:
    os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
    try:
        from src.dependencies import get_app_settings

        get_app_settings.cache_clear()
    except ImportError:
        pass

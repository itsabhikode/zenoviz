from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from src.config.app_settings import AppSettings
from src.db.session import get_async_session_maker
from src.repositories.impl.study_repository_sqlalchemy import SqlAlchemyStudyRepository

logger = logging.getLogger(__name__)


async def run_expire_reserved_once() -> int:
    factory = get_async_session_maker()
    now = datetime.now(timezone.utc)
    async with factory() as session:
        async with session.begin():
            repo = SqlAlchemyStudyRepository(session)
            return await repo.expire_reserved_past(now)


async def expiry_background_loop(settings: AppSettings) -> None:
    while True:
        try:
            n = await run_expire_reserved_once()
            if n:
                logger.info("Marked %d booking(s) as EXPIRED and released seats", n)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Reservation expiry job failed")
        await asyncio.sleep(float(settings.booking_expiry_interval_seconds))

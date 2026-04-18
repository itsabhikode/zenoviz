from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.orm.user_role import UserRole
from src.repositories.role_repository import AbstractRoleRepository


class SqlAlchemyRoleRepository(AbstractRoleRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_roles_for_user(self, user_id: str) -> set[str]:
        rows = await self._session.scalars(
            select(UserRole.role).where(UserRole.user_id == user_id)
        )
        return set(rows)

    async def list_users_with_role(self, role: str) -> list[str]:
        rows = await self._session.scalars(
            select(UserRole.user_id).where(UserRole.role == role).order_by(UserRole.granted_at)
        )
        return list(rows)

    async def grant_role(self, user_id: str, role: str) -> bool:
        existing = await self._session.scalar(
            select(UserRole.id).where(
                UserRole.user_id == user_id, UserRole.role == role
            )
        )
        if existing is not None:
            return False
        self._session.add(
            UserRole(
                id=uuid.uuid4(),
                user_id=user_id,
                role=role,
                granted_at=datetime.now(timezone.utc),
            )
        )
        await self._session.flush()
        return True

    async def revoke_role(self, user_id: str, role: str) -> bool:
        result = await self._session.execute(
            delete(UserRole).where(
                UserRole.user_id == user_id, UserRole.role == role
            )
        )
        return (result.rowcount or 0) > 0

    async def flush(self) -> None:
        await self._session.flush()

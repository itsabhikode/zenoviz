from __future__ import annotations

from typing import Literal

from src.clients.base import AbstractCognitoClient
from src.repositories.role_repository import AbstractRoleRepository

RoleName = Literal["admin"]
ALLOWED_ROLES: frozenset[str] = frozenset({"admin"})


class RoleService:
    """Thin orchestration layer over the role repository + Cognito lookup."""

    def __init__(
        self,
        repo: AbstractRoleRepository,
        cognito: AbstractCognitoClient,
    ) -> None:
        self._repo = repo
        self._cognito = cognito

    def _validate_role(self, role: str) -> None:
        if role not in ALLOWED_ROLES:
            raise ValueError(
                f"Unknown role '{role}'. Allowed: {sorted(ALLOWED_ROLES)}"
            )

    async def _resolve_target_user_id(
        self, user_id: str | None, email: str | None
    ) -> str:
        if (user_id is None) == (email is None):
            raise ValueError("Exactly one of user_id or email must be provided")
        if user_id is not None:
            return user_id
        assert email is not None
        sub = await self._cognito.resolve_sub_by_email(email)
        if sub is None:
            raise LookupError(f"No Cognito user found for email '{email}'")
        return sub

    async def grant(
        self,
        *,
        role: str,
        user_id: str | None = None,
        email: str | None = None,
    ) -> tuple[str, bool]:
        self._validate_role(role)
        target = await self._resolve_target_user_id(user_id, email)
        created = await self._repo.grant_role(target, role)
        return target, created

    async def revoke(
        self,
        *,
        role: str,
        actor_user_id: str,
        user_id: str | None = None,
        email: str | None = None,
    ) -> tuple[str, bool]:
        self._validate_role(role)
        target = await self._resolve_target_user_id(user_id, email)
        if role == "admin" and target == actor_user_id:
            raise PermissionError("Cannot revoke your own admin role")
        removed = await self._repo.revoke_role(target, role)
        return target, removed

    async def list_user_roles(self, user_id: str) -> list[str]:
        return sorted(await self._repo.list_roles_for_user(user_id))

    async def list_users_with_role(self, role: str) -> list[str]:
        self._validate_role(role)
        return await self._repo.list_users_with_role(role)

from __future__ import annotations

from typing import Literal

from src.clients.base import AbstractCognitoClient
from src.config.app_settings import AppSettings

RoleName = Literal["admin"]
ALLOWED_ROLES: frozenset[str] = frozenset({"admin"})


class RoleService:
    """Grant/revoke admin via Cognito user groups (no database roles)."""

    def __init__(
        self,
        cognito: AbstractCognitoClient,
        settings: AppSettings,
    ) -> None:
        self._cognito = cognito
        self._settings = settings

    def _validate_role(self, role: str) -> None:
        if role not in ALLOWED_ROLES:
            raise ValueError(
                f"Unknown role '{role}'. Allowed: {sorted(ALLOWED_ROLES)}"
            )

    def _cognito_group_for_api_role(self, role: str) -> str:
        self._validate_role(role)
        return self._settings.cognito_admin_group

    async def _resolve_target_user_id(
        self,
        user_id: str | None,
        email: str | None,
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
        group = self._cognito_group_for_api_role(role)
        target = await self._resolve_target_user_id(user_id, email)
        existing = await self._cognito.admin_list_groups_for_user(target)
        if group in existing:
            return target, False
        await self._cognito.admin_add_user_to_group(target, group)
        return target, True

    async def revoke(
        self,
        *,
        role: str,
        actor_user_id: str,
        user_id: str | None = None,
        email: str | None = None,
    ) -> tuple[str, bool]:
        group = self._cognito_group_for_api_role(role)
        target = await self._resolve_target_user_id(user_id, email)
        if role == "admin" and target == actor_user_id:
            raise PermissionError("Cannot revoke your own admin role")
        existing = await self._cognito.admin_list_groups_for_user(target)
        if group not in existing:
            return target, False
        await self._cognito.admin_remove_user_from_group(target, group)
        return target, True

    async def list_user_roles(self, user_id: str) -> list[str]:
        groups = await self._cognito.admin_list_groups_for_user(user_id)
        if self._settings.cognito_admin_group in groups:
            return ["admin"]
        return []

    async def list_users_with_role(self, role: str) -> list[str]:
        self._validate_role(role)
        group = self._cognito_group_for_api_role(role)
        user_ids: list[str] = []
        token: str | None = None
        while True:
            batch, token = await self._cognito.admin_list_users_in_group(
                group,
                limit=60,
                pagination_token=token,
            )
            user_ids.extend(batch)
            if not token:
                break
        return sorted(set(user_ids))

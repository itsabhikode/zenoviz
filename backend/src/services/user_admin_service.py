from __future__ import annotations

import asyncio
from dataclasses import dataclass

from src.clients.base import AbstractCognitoClient, CognitoUserSummary
from src.config.app_settings import AppSettings


@dataclass(frozen=True, slots=True)
class UserWithRoles:
    user: CognitoUserSummary
    roles: list[str]


@dataclass(frozen=True, slots=True)
class UsersPage:
    users: list[UserWithRoles]
    next_pagination_token: str | None


class UserAdminService:
    """Cognito users with roles derived from Cognito groups."""

    def __init__(
        self,
        cognito: AbstractCognitoClient,
        settings: AppSettings,
    ) -> None:
        self._cognito = cognito
        self._settings = settings

    async def list_users(
        self,
        *,
        limit: int = 50,
        pagination_token: str | None = None,
        email_prefix: str | None = None,
    ) -> UsersPage:
        page = await self._cognito.list_users(
            limit=limit,
            pagination_token=pagination_token,
            email_prefix=email_prefix,
        )

        async def roles_for(uid: str) -> list[str]:
            groups = await self._cognito.admin_list_groups_for_user(uid)
            if self._settings.cognito_admin_group in groups:
                return ["admin"]
            return []

        roles_lists = await asyncio.gather(*(roles_for(u.user_id) for u in page.users))
        enriched = [
            UserWithRoles(user=u, roles=sorted(r))
            for u, r in zip(page.users, roles_lists, strict=True)
        ]
        return UsersPage(users=enriched, next_pagination_token=page.next_pagination_token)

    async def get_user(self, user_id: str) -> UserWithRoles | None:
        user = await self._cognito.get_user_by_sub(user_id)
        if user is None:
            return None
        groups = await self._cognito.admin_list_groups_for_user(user.user_id)
        roles = ["admin"] if self._settings.cognito_admin_group in groups else []
        return UserWithRoles(user=user, roles=sorted(roles))

from __future__ import annotations

from dataclasses import dataclass

from src.clients.base import AbstractCognitoClient, CognitoUserSummary
from src.repositories.role_repository import AbstractRoleRepository


@dataclass(frozen=True, slots=True)
class UserWithRoles:
    user: CognitoUserSummary
    roles: list[str]


@dataclass(frozen=True, slots=True)
class UsersPage:
    users: list[UserWithRoles]
    next_pagination_token: str | None


class UserAdminService:
    """Join Cognito user records with their locally-stored roles."""

    def __init__(
        self,
        cognito: AbstractCognitoClient,
        role_repo: AbstractRoleRepository,
    ) -> None:
        self._cognito = cognito
        self._role_repo = role_repo

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
        enriched: list[UserWithRoles] = []
        for u in page.users:
            roles = sorted(await self._role_repo.list_roles_for_user(u.user_id))
            enriched.append(UserWithRoles(user=u, roles=roles))
        return UsersPage(users=enriched, next_pagination_token=page.next_pagination_token)

    async def get_user(self, user_id: str) -> UserWithRoles | None:
        user = await self._cognito.get_user_by_sub(user_id)
        if user is None:
            return None
        roles = sorted(await self._role_repo.list_roles_for_user(user.user_id))
        return UserWithRoles(user=user, roles=roles)

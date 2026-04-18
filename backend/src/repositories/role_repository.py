from __future__ import annotations

from abc import ABC, abstractmethod


class AbstractRoleRepository(ABC):
    @abstractmethod
    async def list_roles_for_user(self, user_id: str) -> set[str]: ...

    @abstractmethod
    async def list_users_with_role(self, role: str) -> list[str]: ...

    @abstractmethod
    async def grant_role(self, user_id: str, role: str) -> bool:
        """Return True if a new row was created, False if the pair already existed."""

    @abstractmethod
    async def revoke_role(self, user_id: str, role: str) -> bool:
        """Return True if a row was removed, False if nothing existed."""

    @abstractmethod
    async def flush(self) -> None: ...

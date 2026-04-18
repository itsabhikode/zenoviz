from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True, slots=True)
class CognitoRegisterResult:
    """Subset of cognito-idp `sign_up` used by the API layer."""

    user_sub: str
    user_confirmed: bool
    verification_destination: str | None = None
    delivery_medium: str | None = None


@dataclass(frozen=True, slots=True)
class CognitoUserSummary:
    """Normalised snapshot of a Cognito user record."""

    user_id: str  # Cognito `sub`
    username: str
    email: str | None
    email_verified: bool
    given_name: str | None
    family_name: str | None
    phone_number: str | None
    status: str  # e.g. CONFIRMED, UNCONFIRMED, FORCE_CHANGE_PASSWORD
    enabled: bool
    created_at: datetime | None


@dataclass(frozen=True, slots=True)
class CognitoUserPage:
    users: list[CognitoUserSummary]
    next_pagination_token: str | None


class AbstractCognitoClient(ABC):
    @abstractmethod
    async def register(
        self,
        email: str,
        password: str,
        *,
        given_name: str,
        family_name: str,
        phone_number: str,
        gender: str,
    ) -> CognitoRegisterResult: ...

    @abstractmethod
    async def login(self, email: str, password: str) -> dict[str, str]: ...

    @abstractmethod
    async def logout(self, access_token: str) -> None: ...

    @abstractmethod
    async def refresh_token(self, refresh_token: str) -> dict[str, str]: ...

    @abstractmethod
    async def resolve_sub_by_email(self, email: str) -> str | None:
        """Return the Cognito `sub` for the given email, or None if not found."""

    @abstractmethod
    async def list_users(
        self,
        *,
        limit: int = 50,
        pagination_token: str | None = None,
        email_prefix: str | None = None,
    ) -> CognitoUserPage:
        """Page through Cognito users. `email_prefix` maps to an `email ^= "..."` filter."""

    @abstractmethod
    async def get_user_by_sub(self, user_id: str) -> CognitoUserSummary | None:
        """Fetch a user by Cognito `sub`. Returns None if absent."""

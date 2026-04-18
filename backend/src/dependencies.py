from functools import lru_cache
from typing import Any

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError, jwt
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from src.clients.impl.cognito import CognitoClient
from src.config.app_settings import AppSettings
from src.db.session import get_session
from src.domain.user import CurrentUser
from src.repositories.impl.role_repository_sqlalchemy import SqlAlchemyRoleRepository
from src.repositories.impl.study_repository_sqlalchemy import SqlAlchemyStudyRepository
from src.repositories.role_repository import AbstractRoleRepository
from src.services.auth_service import AuthService
from src.services.booking_service import BookingService
from src.services.role_service import RoleService
from src.services.user_admin_service import UserAdminService

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

class CognitoSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    cognito_user_pool_id: str
    cognito_app_client_id: str
    cognito_region: str
    cognito_jwks_url: str


@lru_cache
def get_cognito_settings() -> CognitoSettings:
    return CognitoSettings()


# ---------------------------------------------------------------------------
# JWKS cache (module-level; replaced in tests via patch)
# ---------------------------------------------------------------------------

_jwks_cache: dict[str, Any] | None = None


def _fetch_jwks() -> dict[str, Any]:
    settings = get_cognito_settings()
    response = httpx.get(settings.cognito_jwks_url)
    response.raise_for_status()
    return response.json()


def _get_jwks() -> dict[str, Any]:
    global _jwks_cache
    if _jwks_cache is None:
        _jwks_cache = _fetch_jwks()
    return _jwks_cache


def _decode_token(token: str, jwks: dict[str, Any]) -> dict[str, Any]:
    settings = get_cognito_settings()
    issuer = (
        f"https://cognito-idp.{settings.cognito_region}.amazonaws.com/"
        f"{settings.cognito_user_pool_id}"
    )
    return jwt.decode(
        token,
        jwks,
        algorithms=["RS256"],
        audience=settings.cognito_app_client_id,
        issuer=issuer,
        options={"verify_aud": False},  # Cognito access tokens use client_id, not aud
    )


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    jwks = _get_jwks()

    try:
        payload = _decode_token(token, jwks)
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError:
        global _jwks_cache
        new_jwks = _fetch_jwks()
        _jwks_cache = new_jwks
        try:
            payload = _decode_token(token, new_jwks)
        except ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )

    return CurrentUser(user_id=payload["sub"], email=payload.get("email", ""))


def get_cognito_client() -> CognitoClient:
    settings = get_cognito_settings()
    return CognitoClient(
        user_pool_id=settings.cognito_user_pool_id,
        app_client_id=settings.cognito_app_client_id,
        region=settings.cognito_region,
    )


def get_auth_service(
    cognito: CognitoClient = Depends(get_cognito_client),
) -> AuthService:
    return AuthService(cognito=cognito)


# ---------------------------------------------------------------------------
# Study room / bookings
# ---------------------------------------------------------------------------


@lru_cache
def get_app_settings() -> AppSettings:
    return AppSettings()


def get_study_repo(session: AsyncSession = Depends(get_session)) -> SqlAlchemyStudyRepository:
    return SqlAlchemyStudyRepository(session)


def get_booking_service(
    repo: SqlAlchemyStudyRepository = Depends(get_study_repo),
    settings: AppSettings = Depends(get_app_settings),
) -> BookingService:
    return BookingService(repo, settings)


# ---------------------------------------------------------------------------
# RBAC
# ---------------------------------------------------------------------------


def get_role_repo(session: AsyncSession = Depends(get_session)) -> AbstractRoleRepository:
    return SqlAlchemyRoleRepository(session)


async def get_user_roles(
    user: CurrentUser = Depends(get_current_user),
    repo: AbstractRoleRepository = Depends(get_role_repo),
    settings: AppSettings = Depends(get_app_settings),
) -> frozenset[str]:
    roles = await repo.list_roles_for_user(user.user_id)
    bootstrap = settings.bootstrap_admin_identities()
    if bootstrap and "admin" not in roles:
        candidates = {user.user_id.lower(), (user.email or "").lower()}
        if candidates & bootstrap:
            await repo.grant_role(user.user_id, "admin")
            roles = roles | {"admin"}
    return frozenset(roles)


async def require_admin(roles: frozenset[str] = Depends(get_user_roles)) -> None:
    if "admin" not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )


def get_role_service(  # noqa: D401 - FastAPI dep factory, sync by design
    repo: AbstractRoleRepository = Depends(get_role_repo),
    cognito: CognitoClient = Depends(get_cognito_client),
) -> RoleService:
    return RoleService(repo=repo, cognito=cognito)


def get_user_admin_service(  # noqa: D401 - FastAPI dep factory, sync by design
    cognito: CognitoClient = Depends(get_cognito_client),
    repo: AbstractRoleRepository = Depends(get_role_repo),
) -> UserAdminService:
    return UserAdminService(cognito=cognito, role_repo=repo)

from functools import lru_cache
from typing import Any

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError, jwt
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from src.clients.base import AbstractCognitoClient
from src.clients.impl.cognito import CognitoClient
from src.config.app_settings import AppSettings
from src.db.session import get_session
from src.domain.user import CurrentUser
from src.repositories.impl.local_storage_repository import LocalStorageRepository
from src.repositories.impl.s3_storage_repository import S3StorageRepository
from src.repositories.impl.study_repository_sqlalchemy import SqlAlchemyStudyRepository
from src.repositories.storage_repository import AbstractStorageRepository
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

    # Passed into boto3.Session so keys in `.env` work (boto does not read `.env` itself).
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_session_token: str | None = None


@lru_cache
def get_cognito_settings() -> CognitoSettings:
    return CognitoSettings()


# ---------------------------------------------------------------------------
# JWKS cache — encapsulated in a class to avoid global mutable state
# ---------------------------------------------------------------------------


class JWKSCache:
    """Lazily fetches and caches the Cognito JWKS document.

    Calling ``invalidate()`` forces a re-fetch on the next ``get()`` call,
    which is used by ``get_current_user`` to recover from key-rotation events.
    """

    def __init__(self) -> None:
        self._cache: dict[str, Any] | None = None

    def get(self, jwks_url: str) -> dict[str, Any]:
        if self._cache is None:
            response = httpx.get(jwks_url)
            response.raise_for_status()
            self._cache = response.json()
        return self._cache

    def invalidate(self) -> None:
        self._cache = None


_jwks_cache = JWKSCache()


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
    settings = get_cognito_settings()
    jwks = _jwks_cache.get(settings.cognito_jwks_url)

    try:
        payload = _decode_token(token, jwks)
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError:
        _jwks_cache.invalidate()
        new_jwks = _jwks_cache.get(settings.cognito_jwks_url)
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

    raw_groups = payload.get("cognito:groups")
    if isinstance(raw_groups, str):
        group_set = frozenset({raw_groups})
    elif isinstance(raw_groups, list):
        group_set = frozenset(str(g) for g in raw_groups)
    else:
        group_set = frozenset()

    return CurrentUser(
        user_id=payload["sub"],
        email=payload.get("email", ""),
        groups=group_set,
    )


def get_cognito_client() -> AbstractCognitoClient:
    settings = get_cognito_settings()
    return CognitoClient(
        user_pool_id=settings.cognito_user_pool_id,
        app_client_id=settings.cognito_app_client_id,
        region=settings.cognito_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        aws_session_token=settings.aws_session_token,
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


def get_storage_repo(
    settings: AppSettings = Depends(get_app_settings),
    cognito_cfg: CognitoSettings = Depends(get_cognito_settings),
) -> AbstractStorageRepository:
    if settings.s3_uploads_bucket:
        return S3StorageRepository(
            bucket=settings.s3_uploads_bucket,
            prefix=settings.s3_uploads_prefix,
            region=cognito_cfg.cognito_region,
            aws_access_key_id=cognito_cfg.aws_access_key_id,
            aws_secret_access_key=cognito_cfg.aws_secret_access_key,
            aws_session_token=cognito_cfg.aws_session_token,
            zonal_endpoint_override=settings.s3_zonal_endpoint,
        )
    return LocalStorageRepository(
        upload_dir=settings.payment_upload_dir,
        qr_dir=settings.payment_qr_dir,
    )


def get_booking_service(
    repo: SqlAlchemyStudyRepository = Depends(get_study_repo),
    settings: AppSettings = Depends(get_app_settings),
    storage: AbstractStorageRepository = Depends(get_storage_repo),
) -> BookingService:
    return BookingService(repo, settings, storage)


# ---------------------------------------------------------------------------
# RBAC (admin from Cognito group only — no DB roles)
# ---------------------------------------------------------------------------


def _map_cognito_groups_to_roles(groups: frozenset[str], admin_group: str) -> frozenset[str]:
    if admin_group in groups:
        return frozenset({"admin"})
    return frozenset()


async def get_user_roles(
    user: CurrentUser = Depends(get_current_user),
    settings: AppSettings = Depends(get_app_settings),
) -> frozenset[str]:
    return _map_cognito_groups_to_roles(user.groups, settings.cognito_admin_group)


async def require_admin(
    user: CurrentUser = Depends(get_current_user),
    settings: AppSettings = Depends(get_app_settings),
) -> None:
    if settings.cognito_admin_group not in user.groups:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required (Cognito group)",
        )


def get_role_service(  # noqa: D401 - FastAPI dep factory, sync by design
    cognito: CognitoClient = Depends(get_cognito_client),
    settings: AppSettings = Depends(get_app_settings),
) -> RoleService:
    return RoleService(cognito=cognito, settings=settings)


def get_user_admin_service(  # noqa: D401 - FastAPI dep factory, sync by design
    cognito: CognitoClient = Depends(get_cognito_client),
    settings: AppSettings = Depends(get_app_settings),
) -> UserAdminService:
    return UserAdminService(cognito=cognito, settings=settings)

from functools import lru_cache
from typing import Any

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError, jwt
from pydantic_settings import BaseSettings, SettingsConfigDict

from src.domain.user import CurrentUser

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

class CognitoSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

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
# FastAPI dependency
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
        # Attempt JWKS re-fetch in case of key rotation
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


# ---------------------------------------------------------------------------
# DI providers
# ---------------------------------------------------------------------------

def get_cognito_client() -> Any:
    from src.clients.impl.cognito import CognitoClient

    settings = get_cognito_settings()
    return CognitoClient(
        user_pool_id=settings.cognito_user_pool_id,
        app_client_id=settings.cognito_app_client_id,
        region=settings.cognito_region,
    )


def get_auth_service(
    cognito: Any = Depends(get_cognito_client),
) -> Any:
    from src.services.auth_service import AuthService

    return AuthService(cognito=cognito)

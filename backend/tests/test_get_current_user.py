"""Unit tests for get_current_user FastAPI dependency."""
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

import src.dependencies
from src.dependencies import get_current_user


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_credentials(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def _mock_jwks(kid: str = "key1") -> dict[str, Any]:
    return {"keys": [{"kid": kid, "kty": "RSA"}]}


# ---------------------------------------------------------------------------
# Valid token
# ---------------------------------------------------------------------------

def test_valid_token_returns_current_user() -> None:
    creds = _make_credentials("valid.token.here")
    payload = {"sub": "user-123", "email": "user@example.com", "token_use": "access"}

    with (
        patch.object(src.dependencies._jwks_cache, "get", return_value=_mock_jwks()),
        patch("src.dependencies._decode_token", return_value=payload),
    ):
        user = get_current_user(credentials=creds)

    assert user.user_id == "user-123"
    assert user.email == "user@example.com"


# ---------------------------------------------------------------------------
# Missing credentials
# ---------------------------------------------------------------------------

def test_missing_credentials_raises_401() -> None:
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(credentials=None)  # type: ignore[arg-type]

    assert exc_info.value.status_code == 401


# ---------------------------------------------------------------------------
# Expired token
# ---------------------------------------------------------------------------

def test_expired_token_raises_401() -> None:
    from jose import ExpiredSignatureError

    creds = _make_credentials("expired.token")
    with (
        patch.object(src.dependencies._jwks_cache, "get", return_value=_mock_jwks()),
        patch("src.dependencies._decode_token", side_effect=ExpiredSignatureError("expired")),
    ):
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(credentials=creds)

    assert exc_info.value.status_code == 401
    assert "expired" in exc_info.value.detail.lower()


# ---------------------------------------------------------------------------
# Invalid / wrong-issuer token — JWTError on both attempts
# ---------------------------------------------------------------------------

def test_invalid_token_raises_401() -> None:
    from jose import JWTError

    creds = _make_credentials("bad.token")
    with (
        patch.object(src.dependencies._jwks_cache, "get", return_value=_mock_jwks()),
        patch.object(src.dependencies._jwks_cache, "invalidate"),
        patch("src.dependencies._decode_token", side_effect=JWTError("invalid")),
    ):
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(credentials=creds)

    assert exc_info.value.status_code == 401
    assert "invalid" in exc_info.value.detail.lower()


def test_wrong_issuer_raises_401() -> None:
    from jose import JWTError

    creds = _make_credentials("wrong.issuer.token")
    with (
        patch.object(src.dependencies._jwks_cache, "get", return_value=_mock_jwks()),
        patch.object(src.dependencies._jwks_cache, "invalidate"),
        patch("src.dependencies._decode_token", side_effect=JWTError("issuer")),
    ):
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(credentials=creds)

    assert exc_info.value.status_code == 401


# ---------------------------------------------------------------------------
# JWKS kid-rotation recovery
# ---------------------------------------------------------------------------

def test_kid_rotation_retries_jwks_and_succeeds() -> None:
    """First decode fails (kid not found); second succeeds after JWKS invalidation + re-fetch."""
    from jose import JWTError

    creds = _make_credentials("rotated.key.token")
    payload = {"sub": "user-456", "email": "other@example.com", "token_use": "access"}
    old_jwks = _mock_jwks("key1")
    new_jwks = _mock_jwks("key2")

    call_count = 0

    def decode_side_effect(*args: Any, **kwargs: Any) -> dict[str, Any]:
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise JWTError("kid not found")
        return payload

    mock_cache_get = MagicMock(side_effect=[old_jwks, new_jwks])

    with (
        patch.object(src.dependencies._jwks_cache, "get", mock_cache_get),
        patch.object(src.dependencies._jwks_cache, "invalidate"),
        patch("src.dependencies._decode_token", side_effect=decode_side_effect),
    ):
        user = get_current_user(credentials=creds)

    assert user.user_id == "user-456"
    assert call_count == 2
    assert mock_cache_get.call_count == 2

"""Tests for domain objects and Pydantic request/response schemas."""
import pytest
from pydantic import ValidationError

from src.domain.user import CurrentUser
from src.models.auth import (
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
)


# ---------------------------------------------------------------------------
# CurrentUser domain object
# ---------------------------------------------------------------------------

def test_current_user_holds_id_and_email() -> None:
    user = CurrentUser(user_id="abc-123", email="user@example.com")
    assert user.user_id == "abc-123"
    assert user.email == "user@example.com"


def test_current_user_is_immutable() -> None:
    user = CurrentUser(user_id="abc-123", email="user@example.com")
    with pytest.raises((AttributeError, TypeError)):
        user.user_id = "other"  # type: ignore[misc]


# ---------------------------------------------------------------------------
# RegisterRequest
# ---------------------------------------------------------------------------

def test_register_request_valid() -> None:
    req = RegisterRequest(email="user@example.com", password="SecurePass1!")
    assert req.email == "user@example.com"


def test_register_request_rejects_missing_email() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(password="SecurePass1!")  # type: ignore[call-arg]


def test_register_request_rejects_invalid_email() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(email="not-an-email", password="SecurePass1!")


def test_register_request_rejects_missing_password() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(email="user@example.com")  # type: ignore[call-arg]


# ---------------------------------------------------------------------------
# LoginRequest
# ---------------------------------------------------------------------------

def test_login_request_valid() -> None:
    req = LoginRequest(email="user@example.com", password="SecurePass1!")
    assert req.email == "user@example.com"


def test_login_request_rejects_missing_fields() -> None:
    with pytest.raises(ValidationError):
        LoginRequest(email="user@example.com")  # type: ignore[call-arg]


# ---------------------------------------------------------------------------
# RefreshRequest
# ---------------------------------------------------------------------------

def test_refresh_request_valid() -> None:
    req = RefreshRequest(refresh_token="tok")
    assert req.refresh_token == "tok"


def test_refresh_request_rejects_missing_token() -> None:
    with pytest.raises(ValidationError):
        RefreshRequest()  # type: ignore[call-arg]


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

def test_login_response_fields() -> None:
    resp = LoginResponse(access_token="acc", refresh_token="ref", token_type="bearer")
    assert resp.token_type == "bearer"


def test_refresh_response_fields() -> None:
    resp = RefreshResponse(access_token="new_acc", token_type="bearer")
    assert resp.access_token == "new_acc"


def test_message_response_field() -> None:
    resp = MessageResponse(message="ok")
    assert resp.message == "ok"

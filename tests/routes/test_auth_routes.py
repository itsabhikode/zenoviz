"""Integration tests for auth routes using TestClient and dependency overrides."""
from collections.abc import Generator
from typing import Any
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from src.clients.base import AbstractCognitoClient
from src.main import app
from src.dependencies import get_cognito_client, get_current_user
from src.domain.user import CurrentUser


# ---------------------------------------------------------------------------
# FakeCognitoClient
# ---------------------------------------------------------------------------

class FakeCognitoClient(AbstractCognitoClient):
    def __init__(self) -> None:
        self.register_error: Exception | None = None
        self.login_tokens: dict[str, str] = {
            "access_token": "fake_access",
            "refresh_token": "fake_refresh",
        }
        self.login_error: Exception | None = None
        self.refresh_tokens: dict[str, str] = {"access_token": "new_fake_access"}
        self.refresh_error: Exception | None = None

    async def register(self, email: str, password: str) -> None:
        if self.register_error:
            raise self.register_error

    async def login(self, email: str, password: str) -> dict[str, str]:
        if self.login_error:
            raise self.login_error
        return self.login_tokens

    async def logout(self, access_token: str) -> None:
        pass

    async def refresh_token(self, refresh_token: str) -> dict[str, str]:
        if self.refresh_error:
            raise self.refresh_error
        return self.refresh_tokens


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def fake_cognito() -> FakeCognitoClient:
    return FakeCognitoClient()


@pytest.fixture()
def client(fake_cognito: FakeCognitoClient) -> Generator[TestClient, None, None]:
    app.dependency_overrides[get_cognito_client] = lambda: fake_cognito
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _authed_client(fake_cognito: FakeCognitoClient) -> Generator[TestClient, None, None]:
    """Client with both cognito AND get_current_user overridden."""
    fake_user = CurrentUser(user_id="u-1", email="user@example.com")
    app.dependency_overrides[get_cognito_client] = lambda: fake_cognito
    app.dependency_overrides[get_current_user] = lambda: fake_user
    c = TestClient(app, raise_server_exceptions=True)
    return c


# ---------------------------------------------------------------------------
# POST /auth/register
# ---------------------------------------------------------------------------

def test_register_success(client: TestClient) -> None:
    resp = client.post("/auth/register", json={"email": "u@example.com", "password": "Pass1!"})
    assert resp.status_code == 201
    assert "successful" in resp.json()["message"].lower()


def test_register_duplicate_returns_409(client: TestClient, fake_cognito: FakeCognitoClient) -> None:
    fake_cognito.register_error = ValueError("Email already registered")
    resp = client.post("/auth/register", json={"email": "u@example.com", "password": "Pass1!"})
    assert resp.status_code == 409


def test_register_weak_password_returns_400(client: TestClient, fake_cognito: FakeCognitoClient) -> None:
    fake_cognito.register_error = ValueError("Invalid password: too short")
    resp = client.post("/auth/register", json={"email": "u@example.com", "password": "short"})
    assert resp.status_code == 400


def test_register_invalid_email_returns_422(client: TestClient) -> None:
    resp = client.post("/auth/register", json={"email": "not-an-email", "password": "Pass1!"})
    assert resp.status_code == 422


def test_register_missing_fields_returns_422(client: TestClient) -> None:
    resp = client.post("/auth/register", json={"email": "u@example.com"})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------

def test_login_success(client: TestClient) -> None:
    resp = client.post("/auth/login", json={"email": "u@example.com", "password": "Pass1!"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"] == "fake_access"
    assert body["refresh_token"] == "fake_refresh"
    assert body["token_type"] == "bearer"


def test_login_wrong_password_returns_401(client: TestClient, fake_cognito: FakeCognitoClient) -> None:
    fake_cognito.login_error = ValueError("Invalid credentials")
    resp = client.post("/auth/login", json={"email": "u@example.com", "password": "wrong"})
    assert resp.status_code == 401


def test_login_unregistered_returns_401(client: TestClient, fake_cognito: FakeCognitoClient) -> None:
    fake_cognito.login_error = ValueError("Invalid credentials")
    resp = client.post("/auth/login", json={"email": "nobody@example.com", "password": "Pass1!"})
    assert resp.status_code == 401
    assert "Invalid credentials" in resp.json()["detail"]


def test_login_unverified_returns_403(client: TestClient, fake_cognito: FakeCognitoClient) -> None:
    fake_cognito.login_error = PermissionError("Account not verified")
    resp = client.post("/auth/login", json={"email": "u@example.com", "password": "Pass1!"})
    assert resp.status_code == 403


def test_login_missing_fields_returns_422(client: TestClient) -> None:
    resp = client.post("/auth/login", json={"email": "u@example.com"})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /auth/logout
# ---------------------------------------------------------------------------

def test_logout_success(fake_cognito: FakeCognitoClient) -> None:
    fake_user = CurrentUser(user_id="u-1", email="user@example.com")
    app.dependency_overrides[get_cognito_client] = lambda: fake_cognito
    app.dependency_overrides[get_current_user] = lambda: fake_user
    with TestClient(app) as c:
        resp = c.post("/auth/logout", headers={"Authorization": "Bearer fake_tok"})
    app.dependency_overrides.clear()
    assert resp.status_code == 200
    assert "success" in resp.json()["message"].lower()


def test_logout_missing_token_returns_401(client: TestClient) -> None:
    resp = client.post("/auth/logout")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /auth/refresh
# ---------------------------------------------------------------------------

def test_refresh_success(client: TestClient) -> None:
    resp = client.post("/auth/refresh", json={"refresh_token": "ref_tok"})
    assert resp.status_code == 200
    assert resp.json()["access_token"] == "new_fake_access"


def test_refresh_invalid_token_returns_401(client: TestClient, fake_cognito: FakeCognitoClient) -> None:
    fake_cognito.refresh_error = ValueError("Invalid or expired refresh token")
    resp = client.post("/auth/refresh", json={"refresh_token": "bad"})
    assert resp.status_code == 401


def test_refresh_missing_field_returns_422(client: TestClient) -> None:
    resp = client.post("/auth/refresh", json={})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Unprotected route remains accessible without a token
# ---------------------------------------------------------------------------

def test_health_check_accessible_without_token(client: TestClient) -> None:
    resp = client.get("/health")
    assert resp.status_code == 200

"""RBAC: admin-only route guard, /auth/me, and bootstrap auto-promotion."""
from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from src.dependencies import get_app_settings, get_cognito_client, get_current_user
from src.domain.user import CurrentUser
from src.main import app


@pytest.fixture()
def fake_cognito() -> AsyncMock:
    client = AsyncMock()
    # /auth/me enriches the profile; return None so it falls back to token email.
    client.get_user_by_sub = AsyncMock(return_value=None)
    return client


@pytest.fixture()
def non_admin_client(fake_cognito: AsyncMock) -> Iterator[TestClient]:
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        user_id="non-admin-sub", email="user@example.com"
    )
    app.dependency_overrides[get_cognito_client] = lambda: fake_cognito
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_admin_route_rejects_non_admin(non_admin_client: TestClient) -> None:
    r = non_admin_client.get("/admin/study-room/bookings/pending-payments")
    assert r.status_code == 403
    assert "admin" in r.json()["detail"].lower()


def test_auth_me_returns_identity_and_no_roles_for_fresh_user(non_admin_client: TestClient) -> None:
    r = non_admin_client.get("/auth/me")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user_id"] == "non-admin-sub"
    assert body["email"] == "user@example.com"
    assert body["roles"] == []


def test_bootstrap_promotes_configured_email_on_first_call(fake_cognito: AsyncMock) -> None:
    settings = get_app_settings()
    original = settings.bootstrap_admins
    settings.bootstrap_admins = "boot@example.com"
    try:
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            user_id="boot-sub", email="boot@example.com"
        )
        app.dependency_overrides[get_cognito_client] = lambda: fake_cognito
        with TestClient(app) as c:
            me = c.get("/auth/me")
            assert me.status_code == 200
            assert me.json()["roles"] == ["admin"]

            listed = c.get("/admin/study-room/bookings/pending-payments")
            assert listed.status_code == 200
    finally:
        settings.bootstrap_admins = original
        app.dependency_overrides.clear()

"""Admin user-listing API: list/get/grant/revoke with mocked Cognito."""
from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from src.clients.base import CognitoUserPage, CognitoUserSummary
from src.dependencies import (
    get_cognito_client,
    get_current_user,
    get_user_roles,
    require_admin,
)
from src.domain.user import CurrentUser
from src.main import app

ADMIN_SUB = "admin-sub-1"


def _mk_user(sub: str, email: str, status: str = "CONFIRMED") -> CognitoUserSummary:
    return CognitoUserSummary(
        user_id=sub,
        username=sub,
        email=email,
        email_verified=True,
        given_name="First",
        family_name="Last",
        phone_number="+14155552671",
        status=status,
        enabled=True,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )


@pytest.fixture()
def fake_cognito() -> AsyncMock:
    client = AsyncMock()
    client.list_users = AsyncMock(
        return_value=CognitoUserPage(
            users=[
                _mk_user("sub-1", "alice@example.com"),
                _mk_user("sub-2", "bob@example.com"),
            ],
            next_pagination_token="next-token-xyz",
        )
    )
    client.get_user_by_sub = AsyncMock(
        side_effect=lambda sub: _mk_user(sub, f"{sub}@example.com") if sub == "sub-1" else None
    )
    client.resolve_sub_by_email = AsyncMock(return_value=None)
    return client


@pytest.fixture()
def admin_client(fake_cognito: AsyncMock) -> Iterator[TestClient]:
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        user_id=ADMIN_SUB, email="admin@example.com"
    )
    app.dependency_overrides[require_admin] = lambda: None
    app.dependency_overrides[get_user_roles] = lambda: frozenset({"admin"})
    app.dependency_overrides[get_cognito_client] = lambda: fake_cognito
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_list_users_returns_users_with_empty_roles(
    admin_client: TestClient, fake_cognito: AsyncMock
) -> None:
    r = admin_client.get("/admin/users")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["next_pagination_token"] == "next-token-xyz"
    assert len(body["users"]) == 2
    first = body["users"][0]
    assert first["user_id"] == "sub-1"
    assert first["email"] == "alice@example.com"
    assert first["status"] == "CONFIRMED"
    assert first["roles"] == []
    fake_cognito.list_users.assert_awaited_once()


def test_list_users_propagates_pagination_and_filter(
    admin_client: TestClient, fake_cognito: AsyncMock
) -> None:
    admin_client.get(
        "/admin/users",
        params={"limit": 25, "pagination_token": "tok", "email_prefix": "al"},
    )
    call = fake_cognito.list_users.await_args
    assert call.kwargs == {
        "limit": 25,
        "pagination_token": "tok",
        "email_prefix": "al",
    }


def test_list_users_reflects_granted_role(admin_client: TestClient) -> None:
    grant = admin_client.post(
        "/admin/roles/grant", json={"user_id": "sub-2", "role": "admin"}
    )
    assert grant.status_code == 200

    r = admin_client.get("/admin/users")
    assert r.status_code == 200
    users = {u["user_id"]: u for u in r.json()["users"]}
    assert users["sub-2"]["roles"] == ["admin"]
    assert users["sub-1"]["roles"] == []


def test_get_user_detail(admin_client: TestClient) -> None:
    r = admin_client.get("/admin/users/sub-1")
    assert r.status_code == 200
    assert r.json()["email"] == "sub-1@example.com"


def test_get_user_detail_404_when_missing(admin_client: TestClient) -> None:
    r = admin_client.get("/admin/users/sub-unknown")
    assert r.status_code == 404


def test_grant_role_via_user_subresource(admin_client: TestClient) -> None:
    r = admin_client.post("/admin/users/sub-1/roles", json={"role": "admin"})
    assert r.status_code == 200, r.text
    assert r.json() == {"user_id": "sub-1", "role": "admin", "changed": True}

    r2 = admin_client.post("/admin/users/sub-1/roles", json={"role": "admin"})
    assert r2.json()["changed"] is False


def test_revoke_role_via_user_subresource(admin_client: TestClient) -> None:
    admin_client.post("/admin/users/sub-1/roles", json={"role": "admin"})

    r = admin_client.delete("/admin/users/sub-1/roles/admin")
    assert r.status_code == 200
    assert r.json()["changed"] is True

    r2 = admin_client.delete("/admin/users/sub-1/roles/admin")
    assert r2.json()["changed"] is False


def test_revoke_self_admin_is_blocked(admin_client: TestClient) -> None:
    r = admin_client.delete(f"/admin/users/{ADMIN_SUB}/roles/admin")
    assert r.status_code == 403
    assert "own admin" in r.json()["detail"].lower()


def test_grant_rejects_unknown_role(admin_client: TestClient) -> None:
    r = admin_client.post("/admin/users/sub-1/roles", json={"role": "ghost"})
    assert r.status_code == 400


def test_non_admin_cannot_list_users() -> None:
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        user_id="someone", email="x@example.com"
    )
    try:
        with TestClient(app) as c:
            r = c.get("/admin/users")
            assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()

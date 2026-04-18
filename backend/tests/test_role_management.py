"""Role management admin API: grant, revoke, list, self-demotion guard."""
from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from src.dependencies import (
    get_cognito_client,
    get_current_user,
    get_user_roles,
    require_admin,
)
from src.domain.user import CurrentUser
from src.main import app

ADMIN_SUB = "admin-sub-1"
ADMIN_EMAIL = "admin@example.com"


@pytest.fixture()
def fake_cognito() -> AsyncMock:
    client = AsyncMock()
    client.resolve_sub_by_email = AsyncMock(return_value="resolved-sub-xyz")
    return client


@pytest.fixture()
def admin_client(fake_cognito: AsyncMock) -> Iterator[TestClient]:
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        user_id=ADMIN_SUB, email=ADMIN_EMAIL
    )
    app.dependency_overrides[require_admin] = lambda: None
    app.dependency_overrides[get_user_roles] = lambda: frozenset({"admin"})
    app.dependency_overrides[get_cognito_client] = lambda: fake_cognito
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_grant_by_user_id(admin_client: TestClient) -> None:
    r = admin_client.post(
        "/admin/roles/grant", json={"user_id": "target-sub", "role": "admin"}
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body == {"user_id": "target-sub", "role": "admin", "changed": True}

    # idempotent
    r2 = admin_client.post(
        "/admin/roles/grant", json={"user_id": "target-sub", "role": "admin"}
    )
    assert r2.status_code == 200
    assert r2.json()["changed"] is False


def test_grant_by_email_resolves_via_cognito(
    admin_client: TestClient, fake_cognito: AsyncMock
) -> None:
    r = admin_client.post(
        "/admin/roles/grant", json={"email": "new@example.com", "role": "admin"}
    )
    assert r.status_code == 200, r.text
    assert r.json()["user_id"] == "resolved-sub-xyz"
    fake_cognito.resolve_sub_by_email.assert_awaited_with("new@example.com")


def test_grant_requires_exactly_one_target(admin_client: TestClient) -> None:
    both = admin_client.post(
        "/admin/roles/grant",
        json={"user_id": "a", "email": "b@example.com", "role": "admin"},
    )
    assert both.status_code == 422  # pydantic model_validator fails

    neither = admin_client.post("/admin/roles/grant", json={"role": "admin"})
    assert neither.status_code == 422


def test_grant_unknown_role_rejected(admin_client: TestClient) -> None:
    r = admin_client.post(
        "/admin/roles/grant", json={"user_id": "x", "role": "superuser"}
    )
    assert r.status_code == 400
    assert "unknown role" in r.json()["detail"].lower()


def test_grant_by_email_not_found_returns_404(
    admin_client: TestClient, fake_cognito: AsyncMock
) -> None:
    fake_cognito.resolve_sub_by_email = AsyncMock(return_value=None)
    r = admin_client.post(
        "/admin/roles/grant", json={"email": "ghost@example.com", "role": "admin"}
    )
    assert r.status_code == 404


def test_revoke_removes_role(admin_client: TestClient) -> None:
    admin_client.post(
        "/admin/roles/grant", json={"user_id": "victim-sub", "role": "admin"}
    )
    r = admin_client.post(
        "/admin/roles/revoke", json={"user_id": "victim-sub", "role": "admin"}
    )
    assert r.status_code == 200, r.text
    assert r.json()["changed"] is True

    r2 = admin_client.post(
        "/admin/roles/revoke", json={"user_id": "victim-sub", "role": "admin"}
    )
    assert r2.status_code == 200
    assert r2.json()["changed"] is False


def test_cannot_revoke_own_admin_role(admin_client: TestClient) -> None:
    r = admin_client.post(
        "/admin/roles/revoke", json={"user_id": ADMIN_SUB, "role": "admin"}
    )
    assert r.status_code == 400
    assert "own admin" in r.json()["detail"].lower()


def test_list_user_roles_and_list_role_members(admin_client: TestClient) -> None:
    admin_client.post(
        "/admin/roles/grant", json={"user_id": "u1", "role": "admin"}
    )
    admin_client.post(
        "/admin/roles/grant", json={"user_id": "u2", "role": "admin"}
    )

    r = admin_client.get("/admin/roles/users/u1")
    assert r.status_code == 200
    assert r.json() == {"user_id": "u1", "roles": ["admin"]}

    r2 = admin_client.get("/admin/roles", params={"role": "admin"})
    assert r2.status_code == 200
    body = r2.json()
    assert body["role"] == "admin"
    assert set(body["user_ids"]) >= {"u1", "u2"}


def test_non_admin_cannot_touch_role_api() -> None:
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        user_id="someone", email="s@example.com"
    )
    try:
        with TestClient(app) as c:
            r = c.post("/admin/roles/grant", json={"user_id": "x", "role": "admin"})
            assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()

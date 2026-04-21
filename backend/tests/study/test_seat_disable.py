"""Admin-disabled seats: availability, booking rules, and admin API."""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from src.dependencies import get_current_user, get_user_roles, require_admin
from src.domain.user import CurrentUser
from src.main import app


def _dates() -> tuple[date, date]:
    start = date.today() + timedelta(days=3)
    end = start + timedelta(days=1)
    return start, end


@pytest.fixture()
def study_client() -> TestClient:
    user = CurrentUser(user_id="study-seat-user", email="seat@example.com")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[require_admin] = lambda: None
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def non_admin_client() -> TestClient:
    user = CurrentUser(user_id="plain-user", email="plain@example.com")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_user_roles] = lambda: frozenset()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_list_seats_all_enabled_initially(study_client: TestClient) -> None:
    r = study_client.get("/admin/study-room/seats")
    assert r.status_code == 200, r.text
    seats = r.json()
    assert len(seats) == 65
    assert all(s["is_enabled"] for s in seats)


def test_non_admin_cannot_list_seats(non_admin_client: TestClient) -> None:
    r = non_admin_client.get("/admin/study-room/seats")
    assert r.status_code == 403


def test_disable_seat_appears_in_batch_availability(study_client: TestClient) -> None:
    start, end = _dates()
    d = study_client.patch("/admin/study-room/seats/14", json={"is_enabled": False})
    assert d.status_code == 200, d.text
    assert d.json()["is_enabled"] is False

    r = study_client.post(
        "/study-room/seats/availability",
        json={
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "anytime",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert 14 in body["unavailable_seat_ids"]
    assert 14 in body["disabled_seat_ids"]


def test_create_booking_rejects_disabled_seat(study_client: TestClient) -> None:
    study_client.patch("/admin/study-room/seats/15", json={"is_enabled": False})
    start, end = _dates()
    r = study_client.post(
        "/study-room/bookings",
        json={
            "seat_id": 15,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "anytime",
        },
    )
    assert r.status_code == 400
    assert "not available" in r.json()["detail"].lower()


def test_check_availability_rejects_disabled_seat(study_client: TestClient) -> None:
    study_client.patch("/admin/study-room/seats/16", json={"is_enabled": False})
    start, end = _dates()
    r = study_client.post(
        "/study-room/availability",
        json={
            "seat_id": 16,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "anytime",
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["available"] is False
    assert "not available" in (r.json().get("reason") or "").lower()


def test_edit_may_keep_disabled_seat_change_dates_only(study_client: TestClient) -> None:
    start, end = _dates()
    cr = study_client.post(
        "/study-room/bookings",
        json={
            "seat_id": 17,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "anytime",
        },
    )
    assert cr.status_code == 201, cr.text
    bid = cr.json()["id"]

    study_client.patch("/admin/study-room/seats/17", json={"is_enabled": False})

    new_start = start + timedelta(days=30)
    new_end = new_start + timedelta(days=1)
    up = study_client.put(
        f"/study-room/bookings/{bid}",
        json={
            "seat_id": 17,
            "start_date": new_start.isoformat(),
            "end_date": new_end.isoformat(),
            "access_type": "anytime",
        },
    )
    assert up.status_code == 200, up.text
    assert up.json()["seat_id"] == 17


def test_edit_cannot_move_to_disabled_seat(study_client: TestClient) -> None:
    start, end = _dates()
    cr = study_client.post(
        "/study-room/bookings",
        json={
            "seat_id": 18,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "anytime",
        },
    )
    assert cr.status_code == 201, cr.text
    bid = cr.json()["id"]

    study_client.patch("/admin/study-room/seats/19", json={"is_enabled": False})

    up = study_client.put(
        f"/study-room/bookings/{bid}",
        json={
            "seat_id": 19,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "anytime",
        },
    )
    assert up.status_code == 400
    assert "not available" in up.json()["detail"].lower()

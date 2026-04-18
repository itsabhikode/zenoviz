"""HTTP flow for study-room booking (SQLite in-memory via tests/conftest)."""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from src.dependencies import get_current_user, require_admin
from src.domain.user import CurrentUser
from src.jobs.expiry import run_expire_reserved_once
from src.main import app

MIN_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06"
    b"\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
    b"\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _dates() -> tuple[date, date]:
    start = date.today() + timedelta(days=2)
    end = start + timedelta(days=2)
    return start, end


@pytest.fixture()
def study_client() -> TestClient:
    user = CurrentUser(user_id="study-user-1", email="study@example.com")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[require_admin] = lambda: None
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_availability_then_booking(study_client: TestClient) -> None:
    start, end = _dates()
    r = study_client.post(
        "/study-room/availability",
        json={
            "seat_id": 5,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "timeslot",
            "start_time": "09:00",
            "end_time": "12:00",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["available"] is True
    assert body["category"] == "daily"
    assert "final_price" in body

    r2 = study_client.post(
        "/study-room/bookings",
        json={
            "seat_id": 5,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "timeslot",
            "start_time": "09:00",
            "end_time": "12:00",
        },
    )
    assert r2.status_code == 201, r2.text
    b = r2.json()
    assert b["status"] == "RESERVED"
    assert b["seat_id"] == 5
    assert b["start_time"] == "09:00:00"
    assert b["end_time"] == "12:00:00"
    assert b["breakdown"]["category"] == "daily"
    assert Decimal(b["final_price"]) > 0


def test_anytime_blocks_any_timeslot(study_client: TestClient) -> None:
    start, end = _dates()
    r1 = study_client.post(
        "/study-room/bookings",
        json={
            "seat_id": 10,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "anytime",
        },
    )
    assert r1.status_code == 201, r1.text

    r2 = study_client.post(
        "/study-room/availability",
        json={
            "seat_id": 10,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "timeslot",
            "start_time": "09:00",
            "end_time": "12:00",
        },
    )
    assert r2.status_code == 200
    assert r2.json()["available"] is False


def test_overlapping_timeslots_conflict(study_client: TestClient) -> None:
    start, end = _dates()
    r1 = study_client.post(
        "/study-room/bookings",
        json={
            "seat_id": 11,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "timeslot",
            "start_time": "09:00",
            "end_time": "12:00",
        },
    )
    assert r1.status_code == 201, r1.text

    r2 = study_client.post(
        "/study-room/availability",
        json={
            "seat_id": 11,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "timeslot",
            "start_time": "11:00",
            "end_time": "14:00",
        },
    )
    assert r2.status_code == 200
    assert r2.json()["available"] is False


def test_adjacent_timeslots_both_allowed(study_client: TestClient) -> None:
    start, end = _dates()
    r1 = study_client.post(
        "/study-room/bookings",
        json={
            "seat_id": 12,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "timeslot",
            "start_time": "09:00",
            "end_time": "12:00",
        },
    )
    assert r1.status_code == 201, r1.text

    r2 = study_client.post(
        "/study-room/bookings",
        json={
            "seat_id": 12,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "timeslot",
            "start_time": "12:00",
            "end_time": "15:00",
        },
    )
    assert r2.status_code == 201, r2.text


def test_timeslot_validation_missing_times(study_client: TestClient) -> None:
    start, end = _dates()
    r = study_client.post(
        "/study-room/availability",
        json={
            "seat_id": 1,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "timeslot",
        },
    )
    assert r.status_code == 400


def test_timeslot_validation_wrong_duration(study_client: TestClient) -> None:
    start, end = _dates()
    r = study_client.post(
        "/study-room/availability",
        json={
            "seat_id": 1,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "timeslot",
            "start_time": "09:00",
            "end_time": "11:00",
        },
    )
    assert r.status_code == 400


def test_timeslot_validation_outside_business_hours(study_client: TestClient) -> None:
    start, end = _dates()
    r = study_client.post(
        "/study-room/availability",
        json={
            "seat_id": 1,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "timeslot",
            "start_time": "05:00",
            "end_time": "08:00",
        },
    )
    assert r.status_code == 400


def test_payment_and_admin(study_client: TestClient) -> None:
    start, end = _dates()
    r = study_client.post(
        "/study-room/bookings",
        json={
            "seat_id": 7,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "anytime",
        },
    )
    assert r.status_code == 201
    bid = r.json()["id"]

    up = study_client.post(
        f"/study-room/bookings/{bid}/payment-proof",
        files={"file": ("proof.png", MIN_PNG, "image/png")},
    )
    assert up.status_code == 200, up.text
    assert up.json()["status"] == "PAYMENT_PENDING"

    pend = study_client.get("/admin/study-room/bookings/pending-payments")
    assert pend.status_code == 200
    assert any(x["id"] == bid for x in pend.json())

    ap = study_client.post(f"/admin/study-room/bookings/{bid}/approve")
    assert ap.status_code == 200
    assert ap.json()["status"] == "COMPLETED"


def test_admin_reject_releases_seat(study_client: TestClient) -> None:
    start, end = _dates()
    r = study_client.post(
        "/study-room/bookings",
        json={
            "seat_id": 8,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "anytime",
        },
    )
    bid = r.json()["id"]
    study_client.post(
        f"/study-room/bookings/{bid}/payment-proof",
        files={"file": ("proof.png", MIN_PNG, "image/png")},
    )
    study_client.post(f"/admin/study-room/bookings/{bid}/reject")

    chk = study_client.post(
        "/study-room/availability",
        json={
            "seat_id": 8,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "anytime",
        },
    )
    assert chk.json()["available"] is True


def test_expiry_job(study_client: TestClient) -> None:
    import asyncio
    from datetime import datetime, timezone

    from sqlalchemy import update

    from src.db.session import get_async_session_maker
    from src.models.orm.study_room import Booking

    start, end = _dates()
    r = study_client.post(
        "/study-room/bookings",
        json={
            "seat_id": 9,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "timeslot",
            "start_time": "12:00",
            "end_time": "15:00",
        },
    )
    assert r.status_code == 201
    bid = r.json()["id"]

    factory = get_async_session_maker()

    async def _past_and_expire() -> int:
        async with factory() as session:
            async with session.begin():
                await session.execute(
                    update(Booking)
                    .where(Booking.id == UUID(bid))
                    .values(reserved_until=datetime(2020, 1, 1, tzinfo=timezone.utc))
                )
        return await run_expire_reserved_once()

    n = asyncio.run(_past_and_expire())
    assert n >= 1

    lst = study_client.get("/study-room/bookings")
    assert any(x["id"] == bid and x["status"] == "EXPIRED" for x in lst.json())


def test_update_pricing(study_client: TestClient) -> None:
    r = study_client.put(
        "/admin/study-room/pricing",
        json={
            "daily_base_price": "20.00",
            "weekly_base_price": "90.00",
            "monthly_base_price": "300.00",
            "daily_discount_percent": "0",
            "weekly_discount_percent": "0",
            "monthly_discount_percent": "0",
            "anytime_surcharge_percent": "10",
            "reservation_timeout_minutes": 45,
            "business_open_time": "08:00",
            "business_close_time": "22:00",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["reservation_timeout_minutes"] == 45
    assert body["business_open_time"] == "08:00:00"
    assert body["business_close_time"] == "22:00:00"

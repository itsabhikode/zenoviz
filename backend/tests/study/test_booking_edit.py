"""Edit-booking flows: delta pricing rules across statuses.

Rules being exercised:
- RESERVED / PAYMENT_PENDING: any change allowed, even cheaper plans.
  Booking resets to RESERVED with a fresh expiry and the old proof (if any)
  is discarded.
- COMPLETED (admin-approved): only upgrades or same-price edits accepted.
  Upgrades flip the booking back to RESERVED so the user can upload proof
  for the top-up (amount_due = final_price - paid_amount). If that timer
  expires, the job restores the last fully paid plan instead of EXPIRED.
  Cheaper edits are rejected with a 400.
"""
from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update

from src.dependencies import get_current_user, require_admin
from src.db.session import get_async_session_maker
from src.domain.user import CurrentUser
from src.jobs.expiry import run_expire_reserved_once
from src.main import app
from src.models.orm.study_room import Booking

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
    # Unique user per test so the shared in-memory DB does not see prior bookings.
    user = CurrentUser(
        user_id=f"study-editor-{uuid.uuid4().hex[:12]}",
        email="editor@example.com",
    )
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[require_admin] = lambda: None
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _create(client: TestClient, seat_id: int, access: str = "timeslot", start: str = "09:00", end: str = "12:00") -> dict:
    s, e = _dates()
    body = {
        "seat_id": seat_id,
        "start_date": s.isoformat(),
        "end_date": e.isoformat(),
        "access_type": access,
    }
    if access == "timeslot":
        body["start_time"] = start
        body["end_time"] = end
    r = client.post("/study-room/bookings", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_edit_reserved_to_cheaper_allowed(study_client: TestClient) -> None:
    """RESERVED bookings can be edited to any plan (incl. cheaper) before paying."""
    b = _create(study_client, seat_id=20, access="anytime")
    original_price = Decimal(b["final_price"])
    bid = b["id"]

    s, e = _dates()
    r = study_client.put(
        f"/study-room/bookings/{bid}",
        json={
            "seat_id": 20,
            "start_date": s.isoformat(),
            "end_date": e.isoformat(),
            "access_type": "timeslot",
            "start_time": "09:00",
            "end_time": "12:00",
        },
    )
    assert r.status_code == 200, r.text
    updated = r.json()
    assert updated["status"] == "RESERVED"
    assert updated["access_type"] == "timeslot"
    assert Decimal(updated["final_price"]) < original_price
    assert updated["paid_amount"] == "0.00"
    assert updated["amount_due"] == updated["final_price"]


def test_edit_pending_payment_resets_proof_and_status(study_client: TestClient) -> None:
    """PAYMENT_PENDING → edit clears the proof and reverts to RESERVED."""
    b = _create(study_client, seat_id=21, access="timeslot", start="09:00", end="12:00")
    bid = b["id"]

    up = study_client.post(
        f"/study-room/bookings/{bid}/payment-proof",
        files={"file": ("proof.png", MIN_PNG, "image/png")},
    )
    assert up.status_code == 200
    assert up.json()["status"] == "PAYMENT_PENDING"

    s, e = _dates()
    r = study_client.put(
        f"/study-room/bookings/{bid}",
        json={
            "seat_id": 21,
            "start_date": s.isoformat(),
            "end_date": e.isoformat(),
            "access_type": "timeslot",
            "start_time": "12:00",
            "end_time": "15:00",
        },
    )
    assert r.status_code == 200, r.text
    updated = r.json()
    assert updated["status"] == "RESERVED"
    assert updated["payment_proof_path"] is None
    assert updated["start_time"] == "12:00:00"


def test_edit_completed_upgrade_creates_topup(study_client: TestClient) -> None:
    """COMPLETED → upgrade reverts to RESERVED with amount_due = delta."""
    b = _create(study_client, seat_id=22, access="timeslot", start="09:00", end="12:00")
    bid = b["id"]

    study_client.post(
        f"/study-room/bookings/{bid}/payment-proof",
        files={"file": ("proof.png", MIN_PNG, "image/png")},
    )
    ap = study_client.post(f"/admin/study-room/bookings/{bid}/approve")
    assert ap.status_code == 200
    approved = ap.json()
    assert approved["status"] == "COMPLETED"
    paid = Decimal(approved["paid_amount"])
    assert paid > 0
    assert approved["amount_due"] == "0.00"

    s, e = _dates()
    r = study_client.put(
        f"/study-room/bookings/{bid}",
        json={
            "seat_id": 22,
            "start_date": s.isoformat(),
            "end_date": e.isoformat(),
            "access_type": "anytime",
        },
    )
    assert r.status_code == 200, r.text
    upd = r.json()
    assert upd["status"] == "RESERVED"
    new_final = Decimal(upd["final_price"])
    assert new_final > paid
    assert Decimal(upd["paid_amount"]) == paid
    assert Decimal(upd["amount_due"]) == new_final - paid


def test_edit_completed_downgrade_rejected(study_client: TestClient) -> None:
    """COMPLETED → cheaper plan is rejected with 400 (paid bookings can't be downgraded)."""
    b = _create(study_client, seat_id=23, access="anytime")
    bid = b["id"]

    study_client.post(
        f"/study-room/bookings/{bid}/payment-proof",
        files={"file": ("proof.png", MIN_PNG, "image/png")},
    )
    ap = study_client.post(f"/admin/study-room/bookings/{bid}/approve")
    assert ap.status_code == 200

    s, e = _dates()
    r = study_client.put(
        f"/study-room/bookings/{bid}",
        json={
            "seat_id": 23,
            "start_date": s.isoformat(),
            "end_date": e.isoformat(),
            "access_type": "timeslot",
            "start_time": "09:00",
            "end_time": "12:00",
        },
    )
    assert r.status_code == 400
    assert "cheaper" in r.json()["detail"].lower()


def test_edit_frees_old_slot(study_client: TestClient) -> None:
    """Editing a booking off a seat releases its old slot for another user."""
    a = _create(study_client, seat_id=24, access="timeslot", start="09:00", end="12:00")
    aid = a["id"]

    s, e = _dates()
    r_conflict = study_client.post(
        "/study-room/availability",
        json={
            "seat_id": 24,
            "start_date": s.isoformat(),
            "end_date": e.isoformat(),
            "access_type": "timeslot",
            "start_time": "09:00",
            "end_time": "12:00",
        },
    )
    assert r_conflict.json()["available"] is False

    r_edit = study_client.put(
        f"/study-room/bookings/{aid}",
        json={
            "seat_id": 24,
            "start_date": s.isoformat(),
            "end_date": e.isoformat(),
            "access_type": "timeslot",
            "start_time": "15:00",
            "end_time": "18:00",
        },
    )
    assert r_edit.status_code == 200, r_edit.text

    r_free = study_client.post(
        "/study-room/availability",
        json={
            "seat_id": 24,
            "start_date": s.isoformat(),
            "end_date": e.isoformat(),
            "access_type": "timeslot",
            "start_time": "09:00",
            "end_time": "12:00",
        },
    )
    assert r_free.json()["available"] is True


def test_edit_conflict_with_other_booking_rejected() -> None:
    """Cannot edit onto a seat/slot already held by a different user's booking."""
    u1 = CurrentUser(user_id=f"conflict-a-{uuid.uuid4().hex[:8]}", email="a@example.com")
    u2 = CurrentUser(user_id=f"conflict-b-{uuid.uuid4().hex[:8]}", email="b@example.com")
    app.dependency_overrides[require_admin] = lambda: None
    s, e = _dates()
    with TestClient(app) as c:
        app.dependency_overrides[get_current_user] = lambda: u1
        r1 = c.post(
            "/study-room/bookings",
            json={
                "seat_id": 25,
                "start_date": s.isoformat(),
                "end_date": e.isoformat(),
                "access_type": "timeslot",
                "start_time": "09:00",
                "end_time": "12:00",
            },
        )
        assert r1.status_code == 201, r1.text

        app.dependency_overrides[get_current_user] = lambda: u2
        r2 = c.post(
            "/study-room/bookings",
            json={
                "seat_id": 26,
                "start_date": s.isoformat(),
                "end_date": e.isoformat(),
                "access_type": "timeslot",
                "start_time": "09:00",
                "end_time": "12:00",
            },
        )
        assert r2.status_code == 201, r2.text
        bid = r2.json()["id"]

        r = c.put(
            f"/study-room/bookings/{bid}",
            json={
                "seat_id": 25,
                "start_date": s.isoformat(),
                "end_date": e.isoformat(),
                "access_type": "timeslot",
                "start_time": "09:00",
                "end_time": "12:00",
            },
        )
        assert r.status_code == 400
        assert "available" in r.json()["detail"].lower()
    app.dependency_overrides.clear()


def test_upgrade_topup_timeout_reverts_to_paid_plan(study_client: TestClient) -> None:
    """RESERVED after paid upgrade: expiry restores the last fully paid plan, not EXPIRED."""
    b = _create(study_client, seat_id=27, access="timeslot", start="09:00", end="12:00")
    bid = b["id"]

    study_client.post(
        f"/study-room/bookings/{bid}/payment-proof",
        files={"file": ("proof.png", MIN_PNG, "image/png")},
    )
    ap = study_client.post(f"/admin/study-room/bookings/{bid}/approve")
    assert ap.status_code == 200
    assert ap.json()["status"] == "COMPLETED"
    timeslot_price = ap.json()["final_price"]

    s, e = _dates()
    r = study_client.put(
        f"/study-room/bookings/{bid}",
        json={
            "seat_id": 27,
            "start_date": s.isoformat(),
            "end_date": e.isoformat(),
            "access_type": "anytime",
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "RESERVED"
    assert r.json()["access_type"] == "anytime"
    assert r.json()["final_price"] != timeslot_price

    factory = get_async_session_maker()

    async def _force_past_reservation() -> None:
        async with factory() as session:
            async with session.begin():
                await session.execute(
                    update(Booking)
                    .where(Booking.id == UUID(bid))
                    .values(reserved_until=datetime(2020, 1, 1, tzinfo=timezone.utc))
                )

    async def _past_and_expire() -> int:
        await _force_past_reservation()
        return await run_expire_reserved_once()

    n = asyncio.run(_past_and_expire())
    assert n >= 1

    lst = study_client.get("/study-room/bookings")
    assert lst.status_code == 200
    row = next(x for x in lst.json() if x["id"] == bid)
    assert row["status"] == "COMPLETED"
    assert row["access_type"] == "timeslot"
    assert row["start_time"] == "09:00:00"
    assert row["end_time"] == "12:00:00"
    assert row["final_price"] == timeslot_price
    assert row["amount_due"] == "0.00"

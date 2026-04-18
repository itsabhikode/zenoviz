"""Amount-aware admin approval flow.

Admin types in the amount they see on the UPI screenshot. Behaviour:
- Full or over amount  → booking moves to COMPLETED; proof kept for audit.
- Under amount         → partial credit recorded; booking returns to
                         RESERVED with proof cleared so the user can upload
                         a fresh screenshot for the remainder.
- Omitted `amount`     → credits whatever is still owed (the clean-path
                         default when the user paid exactly what's due).
- Multiple partial approvals cumulate into `paid_amount`.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from src.dependencies import get_current_user, require_admin
from src.domain.user import CurrentUser
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
def client() -> TestClient:
    user = CurrentUser(user_id="approver-user-1", email="approver@example.com")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[require_admin] = lambda: None
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _book_and_upload(client: TestClient, seat_id: int) -> dict:
    s, e = _dates()
    r = client.post(
        "/study-room/bookings",
        json={
            "seat_id": seat_id,
            "start_date": s.isoformat(),
            "end_date": e.isoformat(),
            "access_type": "anytime",
        },
    )
    assert r.status_code == 201, r.text
    bid = r.json()["id"]
    up = client.post(
        f"/study-room/bookings/{bid}/payment-proof",
        files={"file": ("proof.png", MIN_PNG, "image/png")},
    )
    assert up.status_code == 200
    return up.json()


def test_approve_without_amount_credits_full_due(client: TestClient) -> None:
    b = _book_and_upload(client, seat_id=30)
    r = client.post(f"/admin/study-room/bookings/{b['id']}/approve")
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["status"] == "COMPLETED"
    assert Decimal(out["paid_amount"]) == Decimal(b["final_price"])
    assert out["amount_due"] == "0.00"


def test_approve_with_exact_amount_matches_default(client: TestClient) -> None:
    b = _book_and_upload(client, seat_id=31)
    r = client.post(
        f"/admin/study-room/bookings/{b['id']}/approve",
        json={"amount": b["final_price"]},
    )
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["status"] == "COMPLETED"
    assert Decimal(out["paid_amount"]) == Decimal(b["final_price"])


def test_approve_with_partial_amount_reverts_to_reserved(client: TestClient) -> None:
    b = _book_and_upload(client, seat_id=32)
    total = Decimal(b["final_price"])
    partial = (total / Decimal(2)).quantize(Decimal("0.01"))

    r = client.post(
        f"/admin/study-room/bookings/{b['id']}/approve",
        json={"amount": str(partial)},
    )
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["status"] == "RESERVED"
    assert Decimal(out["paid_amount"]) == partial
    assert Decimal(out["amount_due"]) == total - partial
    # Proof is cleared so the admin queue isn't polluted with a screenshot
    # that has already been partially credited.
    assert out["payment_proof_path"] is None
    assert out["reserved_until"] is not None


def test_partial_approvals_cumulate_to_completed(client: TestClient) -> None:
    b = _book_and_upload(client, seat_id=33)
    total = Decimal(b["final_price"])
    half = (total / Decimal(2)).quantize(Decimal("0.01"))
    bid = b["id"]

    first = client.post(
        f"/admin/study-room/bookings/{bid}/approve",
        json={"amount": str(half)},
    )
    assert first.status_code == 200
    assert first.json()["status"] == "RESERVED"

    # User uploads a fresh proof for the remainder and admin approves again.
    up = client.post(
        f"/study-room/bookings/{bid}/payment-proof",
        files={"file": ("proof.png", MIN_PNG, "image/png")},
    )
    assert up.status_code == 200
    assert up.json()["status"] == "PAYMENT_PENDING"

    remainder = total - half
    second = client.post(
        f"/admin/study-room/bookings/{bid}/approve",
        json={"amount": str(remainder)},
    )
    assert second.status_code == 200, second.text
    out = second.json()
    assert out["status"] == "COMPLETED"
    assert Decimal(out["paid_amount"]) == total
    assert out["amount_due"] == "0.00"


def test_approve_overpayment_is_accepted(client: TestClient) -> None:
    """Overpayments (tip / rounding) are recorded; amount_due clamps at 0."""
    b = _book_and_upload(client, seat_id=34)
    total = Decimal(b["final_price"])
    over = total + Decimal("50.00")

    r = client.post(
        f"/admin/study-room/bookings/{b['id']}/approve",
        json={"amount": str(over)},
    )
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["status"] == "COMPLETED"
    assert Decimal(out["paid_amount"]) == over
    assert out["amount_due"] == "0.00"


def test_approve_rejects_zero_amount(client: TestClient) -> None:
    b = _book_and_upload(client, seat_id=35)
    r = client.post(
        f"/admin/study-room/bookings/{b['id']}/approve",
        json={"amount": "0"},
    )
    # Pydantic-level validation (gt=0) → 422, not 400.
    assert r.status_code == 422


def test_approve_rejects_non_pending_booking(client: TestClient) -> None:
    s, e = _dates()
    r = client.post(
        "/study-room/bookings",
        json={
            "seat_id": 36,
            "start_date": s.isoformat(),
            "end_date": e.isoformat(),
            "access_type": "anytime",
        },
    )
    bid = r.json()["id"]
    # RESERVED, no proof yet.
    bad = client.post(f"/admin/study-room/bookings/{bid}/approve")
    assert bad.status_code == 400

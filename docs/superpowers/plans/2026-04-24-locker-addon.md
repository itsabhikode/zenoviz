# Locker Add-on Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users add an optional locker to any seat booking; locker fee (per daily/weekly/monthly category) is set by admin and added to `final_price`.

**Architecture:** Locker pricing lives in `PricingConfig` (three new decimal columns). `Booking` records `with_locker: bool`. `compute_stored_breakdown` accepts `with_locker` and appends a `locker_fee` line to the breakdown dict — same frozen-at-booking-time pattern as all other price lines. Frontend adds a checkbox to the invoice section in create and edit booking forms.

**Tech Stack:** Python 3.13 / FastAPI / SQLAlchemy 2.x / Pydantic v2 / Alembic · Angular 19 / Angular Material 19 / TypeScript strict

---

## File Map

| File | Change |
|------|--------|
| `backend/src/domain/study_pricing.py` | Add 3 locker fields to snapshot, `locker_price_for_category`, `with_locker` param to `compute_stored_breakdown` |
| `backend/src/models/orm/study_room.py` | Add 3 locker price columns to `PricingConfig`, `with_locker` bool to `Booking` |
| `backend/alembic/versions/<rev>_add_locker_fields.py` | Migration: 4 columns |
| `backend/src/models/study_api.py` | Extend request/response Pydantic schemas |
| `backend/src/services/booking_service.py` | Thread `with_locker` through pricing, booking create/update, responses |
| `backend/src/repositories/impl/study_repository_sqlalchemy.py` | Restore `with_locker` in `_revert_to_paid_plan` |
| `backend/tests/study/test_domain_study.py` | Add locker pricing unit tests |
| `backend/tests/study/test_booking_flow.py` | Add locker integration tests |
| `frontend/src/app/core/api/models.ts` | Add locker fields to TS interfaces |
| `frontend/src/app/features/bookings/create-booking.component.ts` | Add `withLocker` signal + checkbox + locker invoice line |
| `frontend/src/app/features/bookings/edit-booking.component.ts` | Same as create; prefill from existing booking |
| `frontend/src/app/features/bookings/my-bookings.component.ts` | Locker badge on booking card |
| `frontend/src/app/features/admin/admin-pricing.component.ts` | Three new locker price inputs |

---

## Task 1: Domain — extend PricingConfigSnapshot and compute_stored_breakdown

**Files:**
- Modify: `backend/src/domain/study_pricing.py`
- Test: `backend/tests/study/test_domain_study.py`

- [ ] **Step 1: Write failing tests**

Add to the bottom of `backend/tests/study/test_domain_study.py`:

```python
def test_locker_fee_zero_when_not_requested() -> None:
    from decimal import Decimal
    cfg = PricingConfigSnapshot(
        daily_base_price=Decimal("100"),
        weekly_base_price=Decimal("500"),
        monthly_base_price=Decimal("1000"),
        daily_discount_percent=Decimal("0"),
        weekly_discount_percent=Decimal("0"),
        monthly_discount_percent=Decimal("0"),
        anytime_surcharge_percent=Decimal("0"),
        locker_daily_price=Decimal("50"),
        locker_weekly_price=Decimal("200"),
        locker_monthly_price=Decimal("600"),
    )
    final, bd = compute_stored_breakdown(
        category=PriceCategory.DAILY, access_type=AccessType.TIMESLOT, cfg=cfg,
    )
    assert bd["locker_fee"] == "0"
    assert final == Decimal("100.00")


def test_locker_fee_per_category() -> None:
    from decimal import Decimal
    cfg = PricingConfigSnapshot(
        daily_base_price=Decimal("100"),
        weekly_base_price=Decimal("500"),
        monthly_base_price=Decimal("1000"),
        daily_discount_percent=Decimal("0"),
        weekly_discount_percent=Decimal("0"),
        monthly_discount_percent=Decimal("0"),
        anytime_surcharge_percent=Decimal("0"),
        locker_daily_price=Decimal("50"),
        locker_weekly_price=Decimal("200"),
        locker_monthly_price=Decimal("600"),
    )
    final_d, bd_d = compute_stored_breakdown(
        category=PriceCategory.DAILY, access_type=AccessType.TIMESLOT, cfg=cfg, with_locker=True,
    )
    assert bd_d["locker_fee"] == "50.00"
    assert final_d == Decimal("150.00")

    final_w, bd_w = compute_stored_breakdown(
        category=PriceCategory.WEEKLY, access_type=AccessType.TIMESLOT, cfg=cfg, with_locker=True,
    )
    assert bd_w["locker_fee"] == "200.00"
    assert final_w == Decimal("700.00")

    final_m, bd_m = compute_stored_breakdown(
        category=PriceCategory.MONTHLY, access_type=AccessType.TIMESLOT, cfg=cfg, with_locker=True,
    )
    assert bd_m["locker_fee"] == "600.00"
    assert final_m == Decimal("1600.00")


def test_locker_stacks_with_anytime_surcharge() -> None:
    from decimal import Decimal
    cfg = PricingConfigSnapshot(
        daily_base_price=Decimal("100"),
        weekly_base_price=Decimal("500"),
        monthly_base_price=Decimal("1000"),
        daily_discount_percent=Decimal("0"),
        weekly_discount_percent=Decimal("0"),
        monthly_discount_percent=Decimal("0"),
        anytime_surcharge_percent=Decimal("20"),
        locker_daily_price=Decimal("50"),
        locker_weekly_price=Decimal("200"),
        locker_monthly_price=Decimal("600"),
    )
    # base=100, surcharge=20, locker=50 → total=170
    final, bd = compute_stored_breakdown(
        category=PriceCategory.DAILY, access_type=AccessType.ANYTIME, cfg=cfg, with_locker=True,
    )
    assert bd["surcharge"] == "20.00"
    assert bd["locker_fee"] == "50.00"
    assert final == Decimal("170.00")
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && uv run pytest tests/study/test_domain_study.py::test_locker_fee_zero_when_not_requested tests/study/test_domain_study.py::test_locker_fee_per_category tests/study/test_domain_study.py::test_locker_stacks_with_anytime_surcharge -v
```

Expected: FAIL — `PricingConfigSnapshot` doesn't accept locker fields yet.

- [ ] **Step 3: Replace `backend/src/domain/study_pricing.py` with the updated implementation**

```python
"""Stored-at-booking-time pricing snapshot (never recompute on read)."""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from src.domain.study_room_rules import AccessType, PriceCategory


@dataclass(frozen=True)
class PricingConfigSnapshot:
    daily_base_price: Decimal
    weekly_base_price: Decimal
    monthly_base_price: Decimal
    daily_discount_percent: Decimal
    weekly_discount_percent: Decimal
    monthly_discount_percent: Decimal
    anytime_surcharge_percent: Decimal
    locker_daily_price: Decimal = field(default_factory=lambda: Decimal("0"))
    locker_weekly_price: Decimal = field(default_factory=lambda: Decimal("0"))
    locker_monthly_price: Decimal = field(default_factory=lambda: Decimal("0"))


def base_price_for_category(category: PriceCategory, cfg: PricingConfigSnapshot) -> Decimal:
    if category == PriceCategory.DAILY:
        return cfg.daily_base_price
    if category == PriceCategory.WEEKLY:
        return cfg.weekly_base_price
    return cfg.monthly_base_price


def discount_percent_for_category(category: PriceCategory, cfg: PricingConfigSnapshot) -> Decimal:
    if category == PriceCategory.DAILY:
        return cfg.daily_discount_percent
    if category == PriceCategory.WEEKLY:
        return cfg.weekly_discount_percent
    return cfg.monthly_discount_percent


def locker_price_for_category(category: PriceCategory, cfg: PricingConfigSnapshot) -> Decimal:
    if category == PriceCategory.DAILY:
        return cfg.locker_daily_price
    if category == PriceCategory.WEEKLY:
        return cfg.locker_weekly_price
    return cfg.locker_monthly_price


def compute_stored_breakdown(
    *,
    category: PriceCategory,
    access_type: AccessType,
    cfg: PricingConfigSnapshot,
    with_locker: bool = False,
) -> tuple[Decimal, dict[str, Any]]:
    base = base_price_for_category(category, cfg)
    disc_pct = discount_percent_for_category(category, cfg)
    discounted = base - (base * disc_pct / Decimal("100"))
    discounted = discounted.quantize(Decimal("0.01"))

    surcharge = Decimal("0")
    if access_type == AccessType.ANYTIME:
        surcharge = discounted * (cfg.anytime_surcharge_percent / Decimal("100"))
        surcharge = surcharge.quantize(Decimal("0.01"))

    locker_fee = Decimal("0")
    if with_locker:
        locker_fee = locker_price_for_category(category, cfg).quantize(Decimal("0.01"))

    final_price = (discounted + surcharge + locker_fee).quantize(Decimal("0.01"))

    breakdown: dict[str, Any] = {
        "category": category.value,
        "access_type": access_type.value,
        "base_price": str(base),
        "discount_percent": str(disc_pct),
        "discounted_price": str(discounted),
        "anytime_surcharge_percent": str(cfg.anytime_surcharge_percent),
        "surcharge": str(surcharge),
        "locker_fee": str(locker_fee),
        "final_price": str(final_price),
    }
    return final_price, breakdown
```

- [ ] **Step 4: Run all domain tests**

```bash
cd backend && uv run pytest tests/study/test_domain_study.py -v
```

Expected: all PASS (including the pre-existing `test_pricing_discount_and_anytime_surcharge` — the new `with_locker` param defaults to `False`).

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/domain/study_pricing.py tests/study/test_domain_study.py
git commit -m "feat: extend PricingConfigSnapshot and compute_stored_breakdown with locker fee"
```

---

## Task 2: ORM — add locker columns to PricingConfig and Booking

**Files:**
- Modify: `backend/src/models/orm/study_room.py`

- [ ] **Step 1: Add columns to PricingConfig**

In `backend/src/models/orm/study_room.py`, after `anytime_surcharge_percent` in the `PricingConfig` class, add:

```python
    locker_daily_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"), server_default="0")
    locker_weekly_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"), server_default="0")
    locker_monthly_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"), server_default="0")
```

- [ ] **Step 2: Add `with_locker` column to Booking**

In the `Booking` class, after `paid_amount`, add:

```python
    with_locker: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
```

- [ ] **Step 3: Verify existing tests still pass (schema is recreated from models in tests)**

```bash
cd backend && uv run pytest tests/study/ -v
```

Expected: all PASS — `create_tables()` in lifespan builds the schema from ORM models; SQLite tests use that.

- [ ] **Step 4: Commit**

```bash
cd backend && git add src/models/orm/study_room.py
git commit -m "feat: add locker price columns to PricingConfig and with_locker to Booking ORM"
```

---

## Task 3: Alembic migration

**Files:**
- Create: `backend/alembic/versions/<rev>_add_locker_fields.py`

- [ ] **Step 1: Generate the migration skeleton**

```bash
cd backend && uv run alembic revision -m "add_locker_fields"
```

This creates `backend/alembic/versions/<timestamp>_add_locker_fields.py`. Open the file and replace the `upgrade` and `downgrade` functions with:

```python
def upgrade() -> None:
    op.add_column(
        "pricing_configs",
        sa.Column("locker_daily_price", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "pricing_configs",
        sa.Column("locker_weekly_price", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "pricing_configs",
        sa.Column("locker_monthly_price", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "bookings",
        sa.Column("with_locker", sa.Boolean(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("bookings", "with_locker")
    op.drop_column("pricing_configs", "locker_monthly_price")
    op.drop_column("pricing_configs", "locker_weekly_price")
    op.drop_column("pricing_configs", "locker_daily_price")
```

Also ensure `import sqlalchemy as sa` is present at the top of the migration file (it should be auto-generated).

- [ ] **Step 2: Commit**

```bash
cd backend && git add alembic/versions/
git commit -m "feat: alembic migration — add locker price and with_locker columns"
```

---

## Task 4: Pydantic API schemas

**Files:**
- Modify: `backend/src/models/study_api.py`

- [ ] **Step 1: Add `locker_fee` to `PriceBreakdownResponse`**

In `backend/src/models/study_api.py`, the `PriceBreakdownResponse` class currently ends with `final_price: str`. Add after `final_price`:

```python
    locker_fee: str = "0"
```

- [ ] **Step 2: Add `with_locker` to `AvailabilityCheckRequest` and `CreateBookingRequest`**

In `AvailabilityCheckRequest`, add after `end_time`:

```python
    with_locker: bool = False
```

In `CreateBookingRequest`, add after `end_time`:

```python
    with_locker: bool = False
```

- [ ] **Step 3: Add `with_locker` to `BookingResponse`**

In `BookingResponse`, add after `amount_due`:

```python
    with_locker: bool = False
```

- [ ] **Step 4: Add locker prices to `UpdatePricingRequest` and `PricingConfigResponse`**

In `UpdatePricingRequest`, add after `anytime_surcharge_percent`:

```python
    locker_daily_price: Decimal = Field(default=Decimal("0"), ge=0)
    locker_weekly_price: Decimal = Field(default=Decimal("0"), ge=0)
    locker_monthly_price: Decimal = Field(default=Decimal("0"), ge=0)
```

In `PricingConfigResponse`, add after `anytime_surcharge_percent`:

```python
    locker_daily_price: str
    locker_weekly_price: str
    locker_monthly_price: str
```

- [ ] **Step 5: Run existing tests to confirm no breakage**

```bash
cd backend && uv run pytest tests/study/ -v
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/models/study_api.py
git commit -m "feat: extend Pydantic schemas with locker fields"
```

---

## Task 5: Service layer — thread `with_locker` through pricing and booking

**Files:**
- Modify: `backend/src/services/booking_service.py`

- [ ] **Step 1: Update `_snapshot_from_pricing` to include locker prices**

Find `_snapshot_from_pricing` (lines ~61-69) and replace with:

```python
def _snapshot_from_pricing(row: PricingConfig) -> PricingConfigSnapshot:
    return PricingConfigSnapshot(
        daily_base_price=row.daily_base_price,
        weekly_base_price=row.weekly_base_price,
        monthly_base_price=row.monthly_base_price,
        daily_discount_percent=row.daily_discount_percent,
        weekly_discount_percent=row.weekly_discount_percent,
        monthly_discount_percent=row.monthly_discount_percent,
        anytime_surcharge_percent=row.anytime_surcharge_percent,
        locker_daily_price=row.locker_daily_price,
        locker_weekly_price=row.locker_weekly_price,
        locker_monthly_price=row.locker_monthly_price,
    )
```

- [ ] **Step 2: Update `_breakdown_response` to include `locker_fee`**

Find `_breakdown_response` (lines ~72-82) and replace with:

```python
def _breakdown_response(b: dict[str, Any]) -> PriceBreakdownResponse:
    return PriceBreakdownResponse(
        category=str(b["category"]),
        access_type=str(b["access_type"]),
        base_price=str(b["base_price"]),
        discount_percent=str(b["discount_percent"]),
        discounted_price=str(b["discounted_price"]),
        anytime_surcharge_percent=str(b["anytime_surcharge_percent"]),
        surcharge=str(b["surcharge"]),
        locker_fee=str(b.get("locker_fee", "0")),
        final_price=str(b["final_price"]),
    )
```

- [ ] **Step 3: Pass `with_locker` in `check_availability`**

Find the two calls to `compute_stored_breakdown` in `check_availability` (around line 211):

```python
        final, breakdown_dict = compute_stored_breakdown(
            category=category,
            access_type=access,
            cfg=snap,
        )
```

Replace with:

```python
        final, breakdown_dict = compute_stored_breakdown(
            category=category,
            access_type=access,
            cfg=snap,
            with_locker=body.with_locker,
        )
```

- [ ] **Step 4: Pass `with_locker` in `create_booking` and store on Booking**

In `create_booking`, find:

```python
        final_price, breakdown_dict = compute_stored_breakdown(
            category=category,
            access_type=access,
            cfg=snap,
        )
```

Replace with:

```python
        final_price, breakdown_dict = compute_stored_breakdown(
            category=category,
            access_type=access,
            cfg=snap,
            with_locker=body.with_locker,
        )
```

Find the `Booking(...)` constructor call and add `with_locker=body.with_locker` as a keyword argument (after `payment_proof_path=None`):

```python
        booking = Booking(
            id=bid,
            user_id=user_id,
            seat_id=body.seat_id,
            start_date=body.start_date,
            end_date=body.end_date,
            access_type=access.value,
            start_minute=start_min,
            end_minute=end_min,
            category=category.value,
            duration_days=days,
            status=BookingStatus.RESERVED.value,
            reserved_until=reserved_until,
            final_price=final_price,
            price_breakdown=breakdown_dict,
            with_locker=body.with_locker,
            payment_proof_path=None,
            created_at=now,
            updated_at=now,
        )
```

- [ ] **Step 5: Pass `with_locker` in `update_booking` and update booking field**

In `update_booking`, find:

```python
        new_final, new_breakdown = compute_stored_breakdown(
            category=category, access_type=access, cfg=snap,
        )
```

Replace with:

```python
        new_final, new_breakdown = compute_stored_breakdown(
            category=category, access_type=access, cfg=snap, with_locker=body.with_locker,
        )
```

Find where the booking fields are mutated at the end of `update_booking` (around line 414) and add:

```python
        booking.with_locker = body.with_locker
```

alongside the other assignments (`booking.seat_id`, `booking.category`, etc.).

- [ ] **Step 6: Add `with_locker` to `_reversion_snapshot_v1`**

Find `_reversion_snapshot_v1` (around line 686) and add `"with_locker"` to the returned dict:

```python
def _reversion_snapshot_v1(booking: Booking) -> dict[str, Any]:
    return {
        "v": 1,
        "seat_id": booking.seat_id,
        "start_date": booking.start_date.isoformat(),
        "end_date": booking.end_date.isoformat(),
        "access_type": booking.access_type,
        "start_minute": booking.start_minute,
        "end_minute": booking.end_minute,
        "category": booking.category,
        "duration_days": booking.duration_days,
        "final_price": str(Decimal(booking.final_price).quantize(_MONEY_Q)),
        "price_breakdown": dict(booking.price_breakdown or {}),
        "with_locker": booking.with_locker,
        "day_rows": [
            {
                "seat_id": int(row.seat_id),
                "booking_date": row.booking_date.isoformat(),
                "start_minute": int(row.start_minute),
                "end_minute": int(row.end_minute),
            }
            for row in (booking.day_slots or [])
        ],
    }
```

- [ ] **Step 7: Add `with_locker` to `booking_to_response`**

Find `booking_to_response` (around line 724) and add `"with_locker": b.with_locker` to the returned dict (after `"paid_amount"`):

```python
        "with_locker": b.with_locker,
```

- [ ] **Step 8: Add locker prices to `pricing_to_response`**

Find `pricing_to_response` and replace with:

```python
def pricing_to_response(p: PricingConfig) -> PricingConfigResponse:
    return PricingConfigResponse(
        id=p.id,
        is_active=p.is_active,
        daily_base_price=str(p.daily_base_price),
        weekly_base_price=str(p.weekly_base_price),
        monthly_base_price=str(p.monthly_base_price),
        daily_discount_percent=str(p.daily_discount_percent),
        weekly_discount_percent=str(p.weekly_discount_percent),
        monthly_discount_percent=str(p.monthly_discount_percent),
        anytime_surcharge_percent=str(p.anytime_surcharge_percent),
        locker_daily_price=str(p.locker_daily_price),
        locker_weekly_price=str(p.locker_weekly_price),
        locker_monthly_price=str(p.locker_monthly_price),
        reservation_timeout_minutes=p.reservation_timeout_minutes,
        business_open_time=minute_to_time(p.business_open_minute),
        business_close_time=minute_to_time(p.business_close_minute),
        created_at=p.created_at,
    )
```

- [ ] **Step 9: Add locker prices to `update_pricing` in BookingService**

Find the `PricingConfig(...)` constructor in `update_pricing` (around line 569) and add the three locker price fields:

```python
        row = PricingConfig(
            is_active=True,
            daily_base_price=body.daily_base_price,
            weekly_base_price=body.weekly_base_price,
            monthly_base_price=body.monthly_base_price,
            daily_discount_percent=body.daily_discount_percent,
            weekly_discount_percent=body.weekly_discount_percent,
            monthly_discount_percent=body.monthly_discount_percent,
            anytime_surcharge_percent=body.anytime_surcharge_percent,
            locker_daily_price=body.locker_daily_price,
            locker_weekly_price=body.locker_weekly_price,
            locker_monthly_price=body.locker_monthly_price,
            reservation_timeout_minutes=body.reservation_timeout_minutes,
            business_open_minute=open_min,
            business_close_minute=close_min,
            created_at=now,
        )
```

- [ ] **Step 10: Run all backend tests**

```bash
cd backend && uv run pytest tests/ -v
```

Expected: all PASS.

- [ ] **Step 11: Commit**

```bash
cd backend && git add src/services/booking_service.py
git commit -m "feat: thread with_locker through service layer pricing and booking CRUD"
```

---

## Task 6: Repository — restore `with_locker` on reversion

**Files:**
- Modify: `backend/src/repositories/impl/study_repository_sqlalchemy.py`

- [ ] **Step 1: Add `with_locker` to the `update(Booking)` call in `_revert_to_paid_plan`**

Find the `update(Booking).where(...).values(...)` call inside `_revert_to_paid_plan` (around line 304). Add `with_locker=bool(snap.get("with_locker", False))` to the `.values(...)` dict:

```python
        await self._session.execute(
            update(Booking)
            .where(Booking.id == b.id)
            .values(
                seat_id=int(snap["seat_id"]),
                start_date=start_date,
                end_date=end_date,
                access_type=str(snap["access_type"]),
                start_minute=int(snap["start_minute"]),
                end_minute=int(snap["end_minute"]),
                category=str(snap["category"]),
                duration_days=int(snap["duration_days"]),
                final_price=target_final,
                price_breakdown=snap.get("price_breakdown") or {},
                with_locker=bool(snap.get("with_locker", False)),
                status=BookingStatus.COMPLETED.value,
                reserved_until=None,
                reversion_snapshot=None,
                payment_proof_path=None,
                updated_at=now,
            )
        )
```

- [ ] **Step 2: Run tests**

```bash
cd backend && uv run pytest tests/ -v
```

Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/repositories/impl/study_repository_sqlalchemy.py
git commit -m "feat: restore with_locker from reversion_snapshot on top-up expiry"
```

---

## Task 7: Integration test — booking flow with locker

**Files:**
- Modify: `backend/tests/study/test_booking_flow.py`

- [ ] **Step 1: Add a locker booking test**

Add to the bottom of `backend/tests/study/test_booking_flow.py`:

```python
def test_booking_with_locker(study_client: TestClient) -> None:
    """Booking created with locker has locker_fee > 0 in breakdown and with_locker=True."""
    # First set locker pricing via admin endpoint
    study_client.put(
        "/admin/study-room/pricing",
        json={
            "daily_base_price": "100",
            "weekly_base_price": "500",
            "monthly_base_price": "1000",
            "daily_discount_percent": "0",
            "weekly_discount_percent": "0",
            "monthly_discount_percent": "0",
            "anytime_surcharge_percent": "0",
            "locker_daily_price": "50",
            "locker_weekly_price": "200",
            "locker_monthly_price": "600",
            "reservation_timeout_minutes": 30,
            "business_open_time": "09:00",
            "business_close_time": "21:00",
        },
    )

    start, end = _dates()
    # Check availability with locker
    r = study_client.post(
        "/study-room/availability",
        json={
            "seat_id": 10,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "timeslot",
            "start_time": "09:00",
            "end_time": "12:00",
            "with_locker": True,
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["available"] is True
    assert Decimal(body["breakdown"]["locker_fee"]) == Decimal("50.00")
    # end_date is start+2, so 3 days = daily category
    assert Decimal(body["final_price"]) == Decimal("150.00")

    # Create booking with locker
    r2 = study_client.post(
        "/study-room/bookings",
        json={
            "seat_id": 10,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "timeslot",
            "start_time": "09:00",
            "end_time": "12:00",
            "with_locker": True,
        },
    )
    assert r2.status_code == 201, r2.text
    b = r2.json()
    assert b["with_locker"] is True
    assert Decimal(b["breakdown"]["locker_fee"]) == Decimal("50.00")
    assert Decimal(b["final_price"]) == Decimal("150.00")


def test_booking_without_locker_has_zero_fee(study_client: TestClient) -> None:
    start, end = _dates()
    r = study_client.post(
        "/study-room/bookings",
        json={
            "seat_id": 11,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "access_type": "timeslot",
            "start_time": "10:00",
            "end_time": "13:00",
        },
    )
    assert r.status_code == 201, r.text
    b = r.json()
    assert b["with_locker"] is False
    assert b["breakdown"]["locker_fee"] == "0"
```

- [ ] **Step 2: Run the new integration tests**

```bash
cd backend && uv run pytest tests/study/test_booking_flow.py::test_booking_with_locker tests/study/test_booking_flow.py::test_booking_without_locker_has_zero_fee -v
```

Expected: both PASS.

- [ ] **Step 3: Run full test suite**

```bash
cd backend && uv run pytest tests/ -v
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
cd backend && git add tests/study/test_booking_flow.py
git commit -m "test: locker add-on integration tests for availability and create booking"
```

---

## Task 8: Frontend — TypeScript models

**Files:**
- Modify: `frontend/src/app/core/api/models.ts`

- [ ] **Step 1: Add `locker_fee` to `PriceBreakdown`**

In `frontend/src/app/core/api/models.ts`, find the `PriceBreakdown` interface and add after `surcharge`:

```typescript
  locker_fee: string;
```

- [ ] **Step 2: Add `with_locker` to `AvailabilityRequest`**

Find the `AvailabilityRequest` interface and add after `end_time`:

```typescript
  with_locker?: boolean;
```

(`CreateBookingRequest extends AvailabilityRequest`, so it inherits `with_locker` automatically.)

- [ ] **Step 3: Add `with_locker` to `BookingResponse`**

Find `BookingResponse` and add after `amount_due`:

```typescript
  with_locker: boolean;
```

- [ ] **Step 4: Add locker prices to `PricingConfigResponse`**

Find `PricingConfigResponse` and add after `anytime_surcharge_percent`:

```typescript
  locker_daily_price: number;
  locker_weekly_price: number;
  locker_monthly_price: number;
```

(`UpdatePricingRequest extends PricingConfigResponse`, so it inherits these automatically.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/core/api/models.ts
git commit -m "feat: add locker fields to TypeScript API models"
```

---

## Task 9: Frontend — create-booking component

**Files:**
- Modify: `frontend/src/app/features/bookings/create-booking.component.ts`

- [ ] **Step 1: Add `MatCheckboxModule` import and `withLocker` signal**

In the component's import list (inside `@Component.imports`), add `MatCheckboxModule`:

```typescript
import { MatCheckboxModule } from '@angular/material/checkbox';
```

Add it to the `imports` array in `@Component`:

```typescript
    MatCheckboxModule,
```

In the component class, after `readonly selectedSeat = signal<number | null>(null);`, add:

```typescript
  readonly withLocker = signal(false);
```

- [ ] **Step 2: Make the price effect reactive to `withLocker`**

In `priceEffect`, the effect body reads signals to trigger re-execution. Add a read of `withLocker()` at the top of the effect body (after the existing signal reads):

```typescript
    const withLocker = this.withLocker();
```

And pass it in the request body built inside the effect:

```typescript
    const body: CreateBookingRequest = {
      seat_id: seat,
      start_date: startIso,
      end_date: endIso,
      access_type: access,
      start_time: isTimeslot ? slotStart ?? null : null,
      end_time: isTimeslot && slotStart ? addThreeHours(slotStart) : null,
      with_locker: withLocker,
    };
```

- [ ] **Step 3: Pass `with_locker` in `buildRequest()`**

Find the `buildRequest()` method and update the returned object:

```typescript
  private buildRequest(): CreateBookingRequest | null {
    const v = this.form.getRawValue();
    const start_date = toIsoDate(v.start_date);
    const end_date = toIsoDate(v.end_date);
    const seat_id = this.selectedSeat();
    if (!start_date || !end_date || seat_id === null) return null;
    const isTimeslot = v.access_type === 'timeslot';
    const endTime = isTimeslot ? addThreeHours(v.start_time) : null;
    return {
      seat_id,
      start_date,
      end_date,
      access_type: v.access_type,
      start_time: isTimeslot ? v.start_time : null,
      end_time: endTime,
      with_locker: this.withLocker(),
    };
  }
```

- [ ] **Step 4: Add locker checkbox and fee line to the invoice section in the template**

In the template, find the `<dl class="invoice-lines">` block (the price breakdown section). Add the locker checkbox row **before** `</dl>`, after the surcharge line:

```html
                @if (hasSurcharge(a)) {
                  <div class="invoice-line">
                    <dt>
                      ANYTIME surcharge
                      <span class="line-meta">({{ a.breakdown.anytime_surcharge_percent }}%)</span>
                    </dt>
                    <dd>+{{ nprPrefix }} {{ formatNpr(a.breakdown.surcharge) }}</dd>
                  </div>
                }
                @if (hasLockerFee(a)) {
                  <div class="invoice-line">
                    <dt>Locker</dt>
                    <dd>+{{ nprPrefix }} {{ formatNpr(a.breakdown.locker_fee) }}</dd>
                  </div>
                }
```

And add the locker toggle **between the `<dl class="invoice-meta">` block and the `<dl class="invoice-lines">` block**:

```html
                <div class="locker-toggle">
                  <mat-checkbox
                    [checked]="withLocker()"
                    (change)="withLocker.set($event.checked)"
                  >
                    Add locker
                    @if (lockerPrice(a); as lp) {
                      <span class="locker-price-hint">+{{ nprPrefix }} {{ formatNpr(lp) }}</span>
                    }
                  </mat-checkbox>
                </div>
```

Add the CSS class to the styles array:

```typescript
      .locker-toggle {
        padding: 4px 0;
      }
      .locker-price-hint {
        font-size: 13px;
        color: var(--mat-sys-on-surface-variant);
        margin-left: 4px;
      }
```

- [ ] **Step 5: Add helper methods to the component class**

```typescript
  hasLockerFee(a: AvailabilityResponse): boolean {
    const n = parseFloat(a.breakdown.locker_fee);
    return Number.isFinite(n) && n > 0;
  }

  /** Returns the locker price for the current category (before user opts in). */
  lockerPrice(a: AvailabilityResponse): string | null {
    // The fee in breakdown is already computed; but when locker is OFF the
    // fee is 0. We need the "what would it cost" value from the toggle label.
    // Re-read from breakdown only when locker is on; otherwise show nothing.
    if (this.withLocker()) return a.breakdown.locker_fee;
    return null;
  }
```

- [ ] **Step 6: Reset `withLocker` when seat is deselected**

In `onSeatPicked`, keep `withLocker` as-is (user intent should be preserved when they switch seats). No change needed.

- [ ] **Step 7: Build frontend to check for TypeScript errors**

```bash
cd frontend && npm run build -- --configuration development 2>&1 | tail -30
```

Expected: build succeeds with no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/features/bookings/create-booking.component.ts
git commit -m "feat: add locker checkbox and fee line to create-booking invoice"
```

---

## Task 10: Frontend — edit-booking component

**Files:**
- Modify: `frontend/src/app/features/bookings/edit-booking.component.ts`

- [ ] **Step 1: Add `MatCheckboxModule` import and `withLocker` signal**

At the top of the file, add:

```typescript
import { MatCheckboxModule } from '@angular/material/checkbox';
```

Add `MatCheckboxModule` to `@Component.imports`.

In the component class, after `readonly original = signal<BookingResponse | null>(null);`, add:

```typescript
  readonly withLocker = signal(false);
```

- [ ] **Step 2: Prefill `withLocker` from the existing booking**

In the `prefill(b: BookingResponse)` method, add after `this.selectedSeat.set(b.seat_id)`:

```typescript
    this.withLocker.set(b.with_locker);
```

- [ ] **Step 3: Make the price effect reactive to `withLocker`**

In the `priceEffect` body, add `const withLocker = this.withLocker();` alongside the other signal reads, and pass it in the body:

```typescript
    const body: CreateBookingRequest = {
      seat_id: seat,
      start_date: startIso,
      end_date: endIso,
      access_type: access,
      start_time: isTimeslot ? slotStart ?? null : null,
      end_time: isTimeslot && slotStart ? addThreeHours(slotStart) : null,
      with_locker: withLocker,
    };
```

- [ ] **Step 4: Pass `with_locker` in `save()`**

Find the `body: CreateBookingRequest` object in `save()` and add:

```typescript
      with_locker: this.withLocker(),
```

- [ ] **Step 5: Add locker checkbox to the invoice section in the template**

In the template, find the `<dl class="invoice-lines">` block inside the `@if (selectedSeat() !== null && seatSelectionReady() && availability(); as a)` section. Add the locker toggle **before** that block and a locker fee line inside it:

After the `@if (!a.available) { ... }` block, before the `<dl class="invoice-lines">`, add:

```html
                <div class="locker-toggle">
                  <mat-checkbox
                    [checked]="withLocker()"
                    (change)="withLocker.set($event.checked)"
                  >
                    Add locker
                  </mat-checkbox>
                </div>
```

Inside `<dl class="invoice-lines">`, after the "New plan" row, add:

```html
                  @if (hasLockerFee(a)) {
                    <div class="invoice-line">
                      <dt>Locker</dt>
                      <dd>+{{ nprPrefix }} {{ formatNpr(a.breakdown.locker_fee) }}</dd>
                    </div>
                  }
```

Add the CSS to the styles array:

```typescript
      .locker-toggle {
        padding: 4px 0;
      }
```

- [ ] **Step 6: Add helper method to the component class**

```typescript
  hasLockerFee(a: AvailabilityResponse): boolean {
    const n = parseFloat(a.breakdown.locker_fee);
    return Number.isFinite(n) && n > 0;
  }
```

- [ ] **Step 7: Build frontend**

```bash
cd frontend && npm run build -- --configuration development 2>&1 | tail -30
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/features/bookings/edit-booking.component.ts
git commit -m "feat: add locker checkbox to edit-booking invoice, prefill from existing booking"
```

---

## Task 11: Frontend — my-bookings locker badge

**Files:**
- Modify: `frontend/src/app/features/bookings/my-bookings.component.ts`

- [ ] **Step 1: Find where the booking card displays seat and category info**

Search for `seat_id` in the my-bookings template. The booking card shows seat number, dates, status, etc. Find the section that renders booking metadata and add a locker chip after the seat badge.

Locate the template section that shows per-booking info (look for `b.seat_id` or `b.category`). Add the locker badge:

```html
                @if (b.with_locker) {
                  <mat-chip class="locker-chip">
                    <mat-icon matChipAvatar>lock</mat-icon>
                    Locker
                  </mat-chip>
                }
```

Add CSS to the styles:

```typescript
      .locker-chip {
        background: rgba(124, 58, 237, 0.08);
        color: #6d28d9;
        border: 1px solid rgba(124, 58, 237, 0.2);
        font-size: 12px;
        height: 24px;
      }
```

- [ ] **Step 2: Build frontend**

```bash
cd frontend && npm run build -- --configuration development 2>&1 | tail -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/features/bookings/my-bookings.component.ts
git commit -m "feat: show locker badge on booking card in my-bookings"
```

---

## Task 12: Frontend — admin pricing form

**Files:**
- Modify: `frontend/src/app/features/admin/admin-pricing.component.ts`

- [ ] **Step 1: Add three locker price controls to the form group**

In the `form` definition inside `AdminPricingComponent`, add after `anytime_surcharge_percent`:

```typescript
    locker_daily_price: [0, [Validators.required, Validators.min(0)]],
    locker_weekly_price: [0, [Validators.required, Validators.min(0)]],
    locker_monthly_price: [0, [Validators.required, Validators.min(0)]],
```

- [ ] **Step 2: Add locker price inputs to the template**

In the template, after the `<mat-divider />` following the Rules section, add a new Locker section before the Business hours section:

```html
          <mat-divider />

          <h3>Locker add-on (NPR, Rs.)</h3>
          <div class="grid3">
            <mat-form-field appearance="outline">
              <mat-label>Daily locker</mat-label>
              <input matInput type="number" formControlName="locker_daily_price" min="0" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Weekly locker</mat-label>
              <input matInput type="number" formControlName="locker_weekly_price" min="0" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Monthly locker</mat-label>
              <input matInput type="number" formControlName="locker_monthly_price" min="0" />
            </mat-form-field>
          </div>
```

- [ ] **Step 3: Build frontend**

```bash
cd frontend && npm run build -- --configuration development 2>&1 | tail -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/features/admin/admin-pricing.component.ts
git commit -m "feat: add locker price inputs to admin pricing form"
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ All seats can have locker — no per-seat flag, it's a booking option
- ✅ Per-category pricing (daily/weekly/monthly) in `PricingConfig`
- ✅ Checkbox in invoice section after seat selection
- ✅ Price updates reactively when locker is toggled (via signals + effect)
- ✅ `final_price` includes locker fee
- ✅ `locker_fee` line in breakdown
- ✅ Admin sets locker prices in pricing form
- ✅ Edit booking prefills `withLocker` from existing booking
- ✅ Reversion snapshot includes `with_locker` for expiry job
- ✅ My Bookings shows locker badge

**Type consistency:**
- `with_locker` (Python snake_case) used consistently throughout backend
- `withLocker` (TypeScript camelCase signal) used consistently in components
- `locker_fee` key in breakdown dict matches `PriceBreakdownResponse.locker_fee` and `PriceBreakdown.locker_fee` in TS

**Backward compatibility:**
- `with_locker` defaults to `False` everywhere — existing bookings and API calls without the field work unchanged
- `locker_fee: "0"` default on `PriceBreakdownResponse` — old breakdown JSON rows without the key return `"0"` via `.get("locker_fee", "0")`

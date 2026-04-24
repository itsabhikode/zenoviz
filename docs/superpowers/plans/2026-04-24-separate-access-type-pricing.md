# Separate Access-Type Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the surcharge-on-discount pricing model with six explicit flat prices (timeslot/anytime × daily/weekly/monthly).

**Architecture:** Domain layer changes first (snapshot + compute), then ORM + schemas + service wire-up, then migration. All changes stay in the backend; existing booking price_breakdown JSON is left untouched (backward-compat reads via `.get()`).

**Tech Stack:** Python 3.13, FastAPI, SQLAlchemy 2.x, Pydantic v2, Alembic, pytest + pytest-asyncio. Run tests with `cd backend && .venv/bin/pytest`.

---

## File Map

| File | Change |
|---|---|
| `backend/src/domain/study_pricing.py` | Replace snapshot fields; remove old helpers; add `price_for()`; simplify `compute_stored_breakdown()` |
| `backend/src/models/study_api.py` | Simplify `PriceBreakdownResponse`; update `UpdatePricingRequest` and `PricingConfigResponse` |
| `backend/src/models/orm/study_room.py` | Replace 7 old `Mapped` fields with 6 new ones on `PricingConfig` |
| `backend/src/services/booking_service.py` | Update `_snapshot_from_pricing()`, `_breakdown_response()`, `update_pricing()` |
| `backend/src/repositories/impl/study_repository_sqlalchemy.py` | Update seed defaults |
| `backend/tests/study/test_domain_study.py` | Replace old pricing tests with new flat-price tests |
| `backend/alembic/versions/<hash>_separate_access_type_pricing.py` | New migration: drop 7 cols, add 6 cols |

---

### Task 1: Rewrite domain layer tests (red)

**Files:**
- Modify: `backend/tests/study/test_domain_study.py`

- [ ] **Step 1: Replace the three pricing-specific tests with new ones**

Open `backend/tests/study/test_domain_study.py` and replace the three existing pricing tests (`test_pricing_discount_and_anytime_surcharge`, `test_locker_fee_zero_when_not_requested`, `test_locker_fee_per_category`, `test_locker_stacks_with_anytime_surcharge`, `test_locker_fee_zero_price_configured_but_requested`) with the following. Leave all non-pricing tests untouched.

```python
def _cfg(
    ts_daily: str = "15.00",
    ts_weekly: str = "80.00",
    ts_monthly: str = "250.00",
    at_daily: str = "20.00",
    at_weekly: str = "100.00",
    at_monthly: str = "300.00",
    locker_daily: str = "0",
    locker_weekly: str = "0",
    locker_monthly: str = "0",
) -> PricingConfigSnapshot:
    return PricingConfigSnapshot(
        timeslot_daily_price=Decimal(ts_daily),
        timeslot_weekly_price=Decimal(ts_weekly),
        timeslot_monthly_price=Decimal(ts_monthly),
        anytime_daily_price=Decimal(at_daily),
        anytime_weekly_price=Decimal(at_weekly),
        anytime_monthly_price=Decimal(at_monthly),
        locker_daily_price=Decimal(locker_daily),
        locker_weekly_price=Decimal(locker_weekly),
        locker_monthly_price=Decimal(locker_monthly),
    )


def test_timeslot_uses_timeslot_price() -> None:
    cfg = _cfg(ts_daily="15.00", at_daily="20.00")
    final, bd = compute_stored_breakdown(
        category=PriceCategory.DAILY, access_type=AccessType.TIMESLOT, cfg=cfg
    )
    assert final == Decimal("15.00")
    assert bd["base"] == "15.00"
    assert bd["locker_fee"] == "0.00"
    assert bd["total"] == "15.00"


def test_anytime_uses_anytime_price() -> None:
    cfg = _cfg(ts_daily="15.00", at_daily="20.00")
    final, bd = compute_stored_breakdown(
        category=PriceCategory.DAILY, access_type=AccessType.ANYTIME, cfg=cfg
    )
    assert final == Decimal("20.00")
    assert bd["base"] == "20.00"
    assert bd["total"] == "20.00"


def test_weekly_and_monthly_categories() -> None:
    cfg = _cfg(ts_weekly="80.00", at_weekly="100.00", ts_monthly="250.00", at_monthly="300.00")
    final_w, _ = compute_stored_breakdown(
        category=PriceCategory.WEEKLY, access_type=AccessType.TIMESLOT, cfg=cfg
    )
    assert final_w == Decimal("80.00")

    final_aw, _ = compute_stored_breakdown(
        category=PriceCategory.WEEKLY, access_type=AccessType.ANYTIME, cfg=cfg
    )
    assert final_aw == Decimal("100.00")

    final_m, _ = compute_stored_breakdown(
        category=PriceCategory.MONTHLY, access_type=AccessType.TIMESLOT, cfg=cfg
    )
    assert final_m == Decimal("250.00")

    final_am, _ = compute_stored_breakdown(
        category=PriceCategory.MONTHLY, access_type=AccessType.ANYTIME, cfg=cfg
    )
    assert final_am == Decimal("300.00")


def test_locker_fee_added_to_base() -> None:
    cfg = _cfg(ts_daily="15.00", locker_daily="10.00")
    final, bd = compute_stored_breakdown(
        category=PriceCategory.DAILY, access_type=AccessType.TIMESLOT, cfg=cfg, with_locker=True
    )
    assert bd["locker_fee"] == "10.00"
    assert final == Decimal("25.00")


def test_locker_fee_zero_when_not_requested() -> None:
    cfg = _cfg(ts_daily="15.00", locker_daily="10.00")
    final, bd = compute_stored_breakdown(
        category=PriceCategory.DAILY, access_type=AccessType.TIMESLOT, cfg=cfg, with_locker=False
    )
    assert bd["locker_fee"] == "0.00"
    assert final == Decimal("15.00")


def test_locker_fee_per_category() -> None:
    cfg = _cfg(
        ts_daily="15.00", ts_weekly="80.00", ts_monthly="250.00",
        locker_daily="10.00", locker_weekly="50.00", locker_monthly="150.00",
    )
    _, bd_d = compute_stored_breakdown(
        category=PriceCategory.DAILY, access_type=AccessType.TIMESLOT, cfg=cfg, with_locker=True
    )
    assert bd_d["locker_fee"] == "10.00"

    _, bd_w = compute_stored_breakdown(
        category=PriceCategory.WEEKLY, access_type=AccessType.TIMESLOT, cfg=cfg, with_locker=True
    )
    assert bd_w["locker_fee"] == "50.00"

    _, bd_m = compute_stored_breakdown(
        category=PriceCategory.MONTHLY, access_type=AccessType.TIMESLOT, cfg=cfg, with_locker=True
    )
    assert bd_m["locker_fee"] == "150.00"


def test_anytime_with_locker() -> None:
    cfg = _cfg(at_daily="20.00", locker_daily="10.00")
    final, bd = compute_stored_breakdown(
        category=PriceCategory.DAILY, access_type=AccessType.ANYTIME, cfg=cfg, with_locker=True
    )
    assert bd["base"] == "20.00"
    assert bd["locker_fee"] == "10.00"
    assert final == Decimal("30.00")
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && .venv/bin/pytest tests/study/test_domain_study.py -v 2>&1 | tail -20
```

Expected: multiple FAILED — `PricingConfigSnapshot` still has old fields.

---

### Task 2: Update domain layer (green)

**Files:**
- Modify: `backend/src/domain/study_pricing.py`

- [ ] **Step 1: Replace the entire file with the new implementation**

```python
"""Stored-at-booking-time pricing snapshot (never recompute on read)."""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from src.domain.study_room_rules import AccessType, PriceCategory


@dataclass(frozen=True)
class PricingConfigSnapshot:
    timeslot_daily_price: Decimal
    timeslot_weekly_price: Decimal
    timeslot_monthly_price: Decimal
    anytime_daily_price: Decimal
    anytime_weekly_price: Decimal
    anytime_monthly_price: Decimal
    locker_daily_price: Decimal = field(default_factory=lambda: Decimal("0"))
    locker_weekly_price: Decimal = field(default_factory=lambda: Decimal("0"))
    locker_monthly_price: Decimal = field(default_factory=lambda: Decimal("0"))


def price_for(
    access_type: AccessType, category: PriceCategory, cfg: PricingConfigSnapshot
) -> Decimal:
    if access_type == AccessType.TIMESLOT:
        if category == PriceCategory.DAILY:
            return cfg.timeslot_daily_price
        if category == PriceCategory.WEEKLY:
            return cfg.timeslot_weekly_price
        return cfg.timeslot_monthly_price
    else:  # ANYTIME
        if category == PriceCategory.DAILY:
            return cfg.anytime_daily_price
        if category == PriceCategory.WEEKLY:
            return cfg.anytime_weekly_price
        return cfg.anytime_monthly_price


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
    base = price_for(access_type, category, cfg).quantize(Decimal("0.01"))

    locker_fee = Decimal("0")
    if with_locker:
        locker_fee = locker_price_for_category(category, cfg).quantize(Decimal("0.01"))

    final_price = (base + locker_fee).quantize(Decimal("0.01"))

    breakdown: dict[str, Any] = {
        "category": category.value,
        "access_type": access_type.value,
        "base": str(base),
        "locker_fee": str(locker_fee),
        "total": str(final_price),
    }
    return final_price, breakdown
```

- [ ] **Step 2: Run the domain tests**

```bash
cd backend && .venv/bin/pytest tests/study/test_domain_study.py -v 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/domain/study_pricing.py tests/study/test_domain_study.py
git commit -m "refactor: replace surcharge model with flat access-type prices in domain"
```

---

### Task 3: Update ORM model

**Files:**
- Modify: `backend/src/models/orm/study_room.py:29-48`

- [ ] **Step 1: Replace the `PricingConfig` class body**

Replace lines 34–40 (the 7 old `Mapped` fields) with 6 new ones:

```python
class PricingConfig(Base):
    __tablename__ = "pricing_configs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    is_active: Mapped[bool] = mapped_column(default=False, index=True)
    timeslot_daily_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"), server_default="0")
    timeslot_weekly_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"), server_default="0")
    timeslot_monthly_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"), server_default="0")
    anytime_daily_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"), server_default="0")
    anytime_weekly_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"), server_default="0")
    anytime_monthly_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"), server_default="0")
    locker_daily_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"), server_default="0")
    locker_weekly_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"), server_default="0")
    locker_monthly_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"), server_default="0")
    reservation_timeout_minutes: Mapped[int] = mapped_column(Integer, default=30)
    business_open_minute: Mapped[int] = mapped_column(Integer, default=9 * 60)
    business_close_minute: Mapped[int] = mapped_column(Integer, default=21 * 60)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
```

- [ ] **Step 2: Commit**

```bash
cd backend && git add src/models/orm/study_room.py
git commit -m "refactor: update PricingConfig ORM to flat access-type price fields"
```

---

### Task 4: Update Pydantic schemas

**Files:**
- Modify: `backend/src/models/study_api.py`

- [ ] **Step 1: Simplify `PriceBreakdownResponse`**

Replace lines 29–38:

```python
class PriceBreakdownResponse(BaseModel):
    category: str
    access_type: str
    base: str
    locker_fee: str = "0"
    total: str
```

- [ ] **Step 2: Replace `UpdatePricingRequest`**

Replace lines 131–150:

```python
class UpdatePricingRequest(BaseModel):
    timeslot_daily_price: Decimal = Field(default=Decimal("0"), ge=0)
    timeslot_weekly_price: Decimal = Field(default=Decimal("0"), ge=0)
    timeslot_monthly_price: Decimal = Field(default=Decimal("0"), ge=0)
    anytime_daily_price: Decimal = Field(default=Decimal("0"), ge=0)
    anytime_weekly_price: Decimal = Field(default=Decimal("0"), ge=0)
    anytime_monthly_price: Decimal = Field(default=Decimal("0"), ge=0)
    locker_daily_price: Decimal = Field(default=Decimal("0"), ge=0)
    locker_weekly_price: Decimal = Field(default=Decimal("0"), ge=0)
    locker_monthly_price: Decimal = Field(default=Decimal("0"), ge=0)
    reservation_timeout_minutes: int = Field(..., ge=1, le=10080)
    business_open_time: time = Field(
        default=time(9, 0),
        description="Room opens at this wall-clock time (local)",
    )
    business_close_time: time = Field(
        default=time(21, 0),
        description="Room closes at this wall-clock time (local)",
    )
```

- [ ] **Step 3: Replace `PricingConfigResponse`**

Replace lines 183–199:

```python
class PricingConfigResponse(BaseModel):
    id: UUID
    is_active: bool
    timeslot_daily_price: str
    timeslot_weekly_price: str
    timeslot_monthly_price: str
    anytime_daily_price: str
    anytime_weekly_price: str
    anytime_monthly_price: str
    locker_daily_price: str
    locker_weekly_price: str
    locker_monthly_price: str
    reservation_timeout_minutes: int
    business_open_time: time
    business_close_time: time
    created_at: datetime
```

- [ ] **Step 4: Commit**

```bash
cd backend && git add src/models/study_api.py
git commit -m "refactor: update Pydantic schemas for flat access-type pricing"
```

---

### Task 5: Update service layer

**Files:**
- Modify: `backend/src/services/booking_service.py`

- [ ] **Step 1: Update `_snapshot_from_pricing()`**

Replace lines 60–72:

```python
def _snapshot_from_pricing(row: PricingConfig) -> PricingConfigSnapshot:
    return PricingConfigSnapshot(
        timeslot_daily_price=row.timeslot_daily_price,
        timeslot_weekly_price=row.timeslot_weekly_price,
        timeslot_monthly_price=row.timeslot_monthly_price,
        anytime_daily_price=row.anytime_daily_price,
        anytime_weekly_price=row.anytime_weekly_price,
        anytime_monthly_price=row.anytime_monthly_price,
        locker_daily_price=row.locker_daily_price,
        locker_weekly_price=row.locker_weekly_price,
        locker_monthly_price=row.locker_monthly_price,
    )
```

- [ ] **Step 2: Update `_breakdown_response()`**

Replace lines 75–86. Use `.get()` fallbacks so old bookings (which have `base_price`/`final_price` keys) still render correctly:

```python
def _breakdown_response(b: dict[str, Any]) -> PriceBreakdownResponse:
    return PriceBreakdownResponse(
        category=str(b["category"]),
        access_type=str(b["access_type"]),
        base=str(b.get("base", b.get("base_price", "0"))),
        locker_fee=str(b.get("locker_fee", "0")),
        total=str(b.get("total", b.get("final_price", "0"))),
    )
```

- [ ] **Step 3: Update `update_pricing()`**

Replace lines 577–594 (the `PricingConfig(...)` constructor call):

```python
        row = PricingConfig(
            is_active=True,
            timeslot_daily_price=body.timeslot_daily_price,
            timeslot_weekly_price=body.timeslot_weekly_price,
            timeslot_monthly_price=body.timeslot_monthly_price,
            anytime_daily_price=body.anytime_daily_price,
            anytime_weekly_price=body.anytime_weekly_price,
            anytime_monthly_price=body.anytime_monthly_price,
            locker_daily_price=body.locker_daily_price,
            locker_weekly_price=body.locker_weekly_price,
            locker_monthly_price=body.locker_monthly_price,
            reservation_timeout_minutes=body.reservation_timeout_minutes,
            business_open_minute=open_min,
            business_close_minute=close_min,
            created_at=now,
        )
```

- [ ] **Step 4: Commit**

```bash
cd backend && git add src/services/booking_service.py
git commit -m "refactor: wire service layer to flat access-type pricing fields"
```

---

### Task 6: Update admin pricing response mapper

**Files:**
- Modify: `backend/src/routes/admin_study.py` (the route that builds `PricingConfigResponse` from a `PricingConfig` ORM row)

- [ ] **Step 1: Find and update the pricing response builder**

Search for where `PricingConfigResponse` is constructed (look for `daily_base_price` in admin_study.py):

```bash
cd backend && grep -n "daily_base_price\|PricingConfigResponse" src/routes/admin_study.py
```

- [ ] **Step 2: Replace the constructor call with new fields**

The `PricingConfigResponse(...)` call should become:

```python
PricingConfigResponse(
    id=row.id,
    is_active=row.is_active,
    timeslot_daily_price=str(row.timeslot_daily_price),
    timeslot_weekly_price=str(row.timeslot_weekly_price),
    timeslot_monthly_price=str(row.timeslot_monthly_price),
    anytime_daily_price=str(row.anytime_daily_price),
    anytime_weekly_price=str(row.anytime_weekly_price),
    anytime_monthly_price=str(row.anytime_monthly_price),
    locker_daily_price=str(row.locker_daily_price),
    locker_weekly_price=str(row.locker_weekly_price),
    locker_monthly_price=str(row.locker_monthly_price),
    reservation_timeout_minutes=row.reservation_timeout_minutes,
    business_open_time=time(row.business_open_minute // 60, row.business_open_minute % 60),
    business_close_time=time(row.business_close_minute // 60, row.business_close_minute % 60),
    created_at=row.created_at,
)
```

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/routes/admin_study.py
git commit -m "refactor: update admin pricing response to flat access-type fields"
```

---

### Task 7: Update seed defaults

**Files:**
- Modify: `backend/src/repositories/impl/study_repository_sqlalchemy.py:43-59`

- [ ] **Step 1: Replace seed `PricingConfig` constructor**

```python
            self._session.add(
                PricingConfig(
                    is_active=True,
                    timeslot_daily_price=Decimal("15.00"),
                    timeslot_weekly_price=Decimal("80.00"),
                    timeslot_monthly_price=Decimal("250.00"),
                    anytime_daily_price=Decimal("20.00"),
                    anytime_weekly_price=Decimal("100.00"),
                    anytime_monthly_price=Decimal("300.00"),
                    reservation_timeout_minutes=30,
                    created_at=now,
                )
            )
```

- [ ] **Step 2: Commit**

```bash
cd backend && git add src/repositories/impl/study_repository_sqlalchemy.py
git commit -m "refactor: update seed pricing config to flat access-type prices"
```

---

### Task 8: Write and run Alembic migration

**Files:**
- Create: `backend/alembic/versions/<hash>_separate_access_type_pricing.py`

- [ ] **Step 1: Generate migration**

```bash
cd backend && .venv/bin/alembic revision --autogenerate -m "separate_access_type_pricing" 2>&1
```

- [ ] **Step 2: Verify the generated migration**

Open the new file in `backend/alembic/versions/`. Confirm it:
- Drops `daily_base_price`, `weekly_base_price`, `monthly_base_price`, `daily_discount_percent`, `weekly_discount_percent`, `monthly_discount_percent`, `anytime_surcharge_percent`
- Adds `timeslot_daily_price`, `timeslot_weekly_price`, `timeslot_monthly_price`, `anytime_daily_price`, `anytime_weekly_price`, `anytime_monthly_price` all as `Numeric(12,2)` with `server_default="0"`

If autogenerate missed anything, edit the file manually to match. The `upgrade()` should look like:

```python
def upgrade() -> None:
    op.drop_column("pricing_configs", "anytime_surcharge_percent")
    op.drop_column("pricing_configs", "monthly_discount_percent")
    op.drop_column("pricing_configs", "weekly_discount_percent")
    op.drop_column("pricing_configs", "daily_discount_percent")
    op.drop_column("pricing_configs", "monthly_base_price")
    op.drop_column("pricing_configs", "weekly_base_price")
    op.drop_column("pricing_configs", "daily_base_price")
    op.add_column("pricing_configs", sa.Column("timeslot_daily_price", sa.Numeric(12, 2), nullable=False, server_default="0"))
    op.add_column("pricing_configs", sa.Column("timeslot_weekly_price", sa.Numeric(12, 2), nullable=False, server_default="0"))
    op.add_column("pricing_configs", sa.Column("timeslot_monthly_price", sa.Numeric(12, 2), nullable=False, server_default="0"))
    op.add_column("pricing_configs", sa.Column("anytime_daily_price", sa.Numeric(12, 2), nullable=False, server_default="0"))
    op.add_column("pricing_configs", sa.Column("anytime_weekly_price", sa.Numeric(12, 2), nullable=False, server_default="0"))
    op.add_column("pricing_configs", sa.Column("anytime_monthly_price", sa.Numeric(12, 2), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("pricing_configs", "anytime_monthly_price")
    op.drop_column("pricing_configs", "anytime_weekly_price")
    op.drop_column("pricing_configs", "anytime_daily_price")
    op.drop_column("pricing_configs", "timeslot_monthly_price")
    op.drop_column("pricing_configs", "timeslot_weekly_price")
    op.drop_column("pricing_configs", "timeslot_daily_price")
    op.add_column("pricing_configs", sa.Column("daily_base_price", sa.Numeric(12, 2), nullable=False, server_default="0"))
    op.add_column("pricing_configs", sa.Column("weekly_base_price", sa.Numeric(12, 2), nullable=False, server_default="0"))
    op.add_column("pricing_configs", sa.Column("monthly_base_price", sa.Numeric(12, 2), nullable=False, server_default="0"))
    op.add_column("pricing_configs", sa.Column("daily_discount_percent", sa.Numeric(6, 2), nullable=False, server_default="0"))
    op.add_column("pricing_configs", sa.Column("weekly_discount_percent", sa.Numeric(6, 2), nullable=False, server_default="0"))
    op.add_column("pricing_configs", sa.Column("monthly_discount_percent", sa.Numeric(6, 2), nullable=False, server_default="0"))
    op.add_column("pricing_configs", sa.Column("anytime_surcharge_percent", sa.Numeric(6, 2), nullable=False, server_default="0"))
```

- [ ] **Step 3: Apply migration**

```bash
cd backend && .venv/bin/alembic upgrade head 2>&1
```

Expected: `Running upgrade <prev> -> <new>, separate_access_type_pricing`

- [ ] **Step 4: Commit**

```bash
cd backend && git add alembic/versions/
git commit -m "migration: separate access-type pricing (drop surcharge, add flat prices)"
```

---

### Task 9: Run full test suite

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && .venv/bin/pytest -v 2>&1 | tail -30
```

Expected: all tests PASS. If any test references old fields (`daily_base_price`, `anytime_surcharge_percent`, `discount_percent`, `surcharge`), update it to use the new snapshot/breakdown shape.

- [ ] **Step 2: Commit any test fixes**

```bash
cd backend && git add tests/
git commit -m "test: fix remaining tests after access-type pricing refactor"
```

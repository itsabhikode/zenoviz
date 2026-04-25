# Per-Day Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `compute_stored_breakdown()` multiply per-day rates by `duration_days` so a 9-day weekly booking costs rate × 9, not a flat rate.

**Architecture:** Domain layer change first (TDD), then service callers pass `duration_days`, then Pydantic schema exposes new fields, then frontend displays per-day breakdown. Backend integration tests may need price assertion updates since totals will change with multi-day test bookings.

**Tech Stack:** Python 3.13, FastAPI, Pydantic v2, pytest + pytest-asyncio. Run backend tests: `cd backend && .venv/bin/pytest`. Run frontend build: `source ~/.nvm/nvm.sh && nvm use 18 && cd frontend && npm run build`.

---

## File Map

| File | Change |
|---|---|
| `backend/src/domain/study_pricing.py` | Add `duration_days` param; multiply rates |
| `backend/tests/study/test_domain_study.py` | Add `duration_days` to all existing calls; add multi-day tests |
| `backend/src/models/study_api.py` | Add 3 new fields to `PriceBreakdownResponse` |
| `backend/src/services/booking_service.py` | Pass `duration_days` to 3 callers; update `_breakdown_response()` |
| `backend/tests/study/test_booking_flow.py` | Fix any price assertions that assumed flat rates |
| `frontend/src/app/core/api/models.ts` | Add 3 new fields to `PriceBreakdown` |
| `frontend/src/app/features/admin/admin-pricing.component.ts` | Update section header labels to "(NPR/day)" |
| `frontend/src/app/features/bookings/create-booking.component.ts` | Show per-day × days in breakdown display |

---

### Task 1: Update domain tests (red)

**Files:**
- Modify: `backend/tests/study/test_domain_study.py`

- [ ] **Step 1: Add `duration_days=1` to all existing `compute_stored_breakdown` calls**

All current calls in the test file omit `duration_days`. After Task 2 the parameter becomes required, so add it now (using `1` to preserve existing assertions — 1 day × rate = same rate):

```python
# test_timeslot_uses_timeslot_price
    final, bd = compute_stored_breakdown(
        category=PriceCategory.DAILY, access_type=AccessType.TIMESLOT, cfg=cfg, duration_days=1
    )

# test_anytime_uses_anytime_price
    final, bd = compute_stored_breakdown(
        category=PriceCategory.DAILY, access_type=AccessType.ANYTIME, cfg=cfg, duration_days=1
    )

# test_weekly_and_monthly_categories (4 calls)
    final_w, _ = compute_stored_breakdown(
        category=PriceCategory.WEEKLY, access_type=AccessType.TIMESLOT, cfg=cfg, duration_days=7
    )
    final_aw, _ = compute_stored_breakdown(
        category=PriceCategory.WEEKLY, access_type=AccessType.ANYTIME, cfg=cfg, duration_days=7
    )
    final_m, _ = compute_stored_breakdown(
        category=PriceCategory.MONTHLY, access_type=AccessType.TIMESLOT, cfg=cfg, duration_days=30
    )
    final_am, _ = compute_stored_breakdown(
        category=PriceCategory.MONTHLY, access_type=AccessType.ANYTIME, cfg=cfg, duration_days=30
    )

# test_locker_fee_added_to_base
    final, bd = compute_stored_breakdown(
        category=PriceCategory.DAILY, access_type=AccessType.TIMESLOT, cfg=cfg, with_locker=True, duration_days=1
    )

# test_locker_fee_zero_when_not_requested
    final, bd = compute_stored_breakdown(
        category=PriceCategory.DAILY, access_type=AccessType.TIMESLOT, cfg=cfg, with_locker=False, duration_days=1
    )

# test_locker_fee_per_category (3 calls)
    _, bd_d = compute_stored_breakdown(
        category=PriceCategory.DAILY, access_type=AccessType.TIMESLOT, cfg=cfg, with_locker=True, duration_days=1
    )
    _, bd_w = compute_stored_breakdown(
        category=PriceCategory.WEEKLY, access_type=AccessType.TIMESLOT, cfg=cfg, with_locker=True, duration_days=7
    )
    _, bd_m = compute_stored_breakdown(
        category=PriceCategory.MONTHLY, access_type=AccessType.TIMESLOT, cfg=cfg, with_locker=True, duration_days=30
    )

# test_anytime_with_locker
    final, bd = compute_stored_breakdown(
        category=PriceCategory.DAILY, access_type=AccessType.ANYTIME, cfg=cfg, with_locker=True, duration_days=1
    )
```

Also update the price assertions for `test_weekly_and_monthly_categories` and `test_locker_fee_per_category` since those use 7/30 days:

For `test_weekly_and_monthly_categories`:
```python
    assert final_w == Decimal("560.00")   # 80.00 × 7
    assert final_aw == Decimal("700.00")  # 100.00 × 7
    assert final_m == Decimal("7500.00")  # 250.00 × 30
    assert final_am == Decimal("9000.00") # 300.00 × 30
```

For `test_locker_fee_per_category`:
```python
    assert bd_d["locker_fee"] == "10.00"   # 10.00 × 1
    assert bd_w["locker_fee"] == "350.00"  # 50.00 × 7
    assert bd_m["locker_fee"] == "4500.00" # 150.00 × 30
```

- [ ] **Step 2: Add new multi-day tests at the end of the file**

```python
def test_multi_day_weekly_multiplies_rate() -> None:
    cfg = _cfg(ts_weekly="15.00")
    final, bd = compute_stored_breakdown(
        category=PriceCategory.WEEKLY,
        access_type=AccessType.TIMESLOT,
        cfg=cfg,
        duration_days=9,
    )
    assert final == Decimal("135.00")
    assert bd["per_day_rate"] == "15.00"
    assert bd["duration_days"] == 9
    assert bd["base"] == "135.00"
    assert bd["locker_fee"] == "0.00"
    assert bd["total"] == "135.00"


def test_multi_day_anytime_multiplies_rate() -> None:
    cfg = _cfg(at_daily="20.00")
    final, bd = compute_stored_breakdown(
        category=PriceCategory.DAILY,
        access_type=AccessType.ANYTIME,
        cfg=cfg,
        duration_days=5,
    )
    assert final == Decimal("100.00")
    assert bd["per_day_rate"] == "20.00"
    assert bd["base"] == "100.00"


def test_locker_per_day_multiplied() -> None:
    cfg = _cfg(ts_weekly="15.00", locker_weekly="10.00")
    final, bd = compute_stored_breakdown(
        category=PriceCategory.WEEKLY,
        access_type=AccessType.TIMESLOT,
        cfg=cfg,
        duration_days=9,
        with_locker=True,
    )
    assert bd["per_day_rate"] == "15.00"
    assert bd["locker_per_day"] == "10.00"
    assert bd["base"] == "135.00"
    assert bd["locker_fee"] == "90.00"
    assert final == Decimal("225.00")


def test_breakdown_includes_duration_days_key() -> None:
    cfg = _cfg(ts_daily="15.00")
    _, bd = compute_stored_breakdown(
        category=PriceCategory.DAILY,
        access_type=AccessType.TIMESLOT,
        cfg=cfg,
        duration_days=3,
    )
    assert bd["duration_days"] == 3
    assert bd["per_day_rate"] == "15.00"
    assert bd["base"] == "45.00"
    assert "locker_per_day" in bd
```

- [ ] **Step 3: Run tests to confirm failures**

```bash
cd /Users/akarna/PycharmProjects/zenoviz/backend && .venv/bin/pytest tests/study/test_domain_study.py -v 2>&1 | tail -20
```

Expected: failures on new tests (missing `duration_days` param) and updated existing assertions.

---

### Task 2: Update domain implementation (green)

**Files:**
- Modify: `backend/src/domain/study_pricing.py:50-72`

- [ ] **Step 1: Replace `compute_stored_breakdown()`**

```python
def compute_stored_breakdown(
    *,
    category: PriceCategory,
    access_type: AccessType,
    cfg: PricingConfigSnapshot,
    duration_days: int,
    with_locker: bool = False,
) -> tuple[Decimal, dict[str, Any]]:
    per_day_rate = price_for(access_type, category, cfg).quantize(Decimal("0.01"))
    base = (per_day_rate * duration_days).quantize(Decimal("0.01"))

    locker_per_day = Decimal("0").quantize(Decimal("0.01"))
    locker_fee = Decimal("0").quantize(Decimal("0.01"))
    if with_locker:
        locker_per_day = locker_price_for_category(category, cfg).quantize(Decimal("0.01"))
        locker_fee = (locker_per_day * duration_days).quantize(Decimal("0.01"))

    final_price = (base + locker_fee).quantize(Decimal("0.01"))

    breakdown: dict[str, Any] = {
        "category": category.value,
        "access_type": access_type.value,
        "duration_days": duration_days,
        "per_day_rate": str(per_day_rate),
        "base": str(base),
        "locker_per_day": str(locker_per_day),
        "locker_fee": str(locker_fee),
        "total": str(final_price),
    }
    return final_price, breakdown
```

- [ ] **Step 2: Run domain tests**

```bash
cd /Users/akarna/PycharmProjects/zenoviz/backend && .venv/bin/pytest tests/study/test_domain_study.py -v 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/domain/study_pricing.py tests/study/test_domain_study.py
git commit -m "feat: multiply per-day rate by duration_days in compute_stored_breakdown"
```

---

### Task 3: Update Pydantic schema and service layer

**Files:**
- Modify: `backend/src/models/study_api.py:29-34`
- Modify: `backend/src/services/booking_service.py`

- [ ] **Step 1: Update `PriceBreakdownResponse` in `study_api.py`**

Replace lines 29–34:

```python
class PriceBreakdownResponse(BaseModel):
    category: str
    access_type: str
    duration_days: str = "1"
    per_day_rate: str = "0"
    base: str
    locker_per_day: str = "0.00"
    locker_fee: str = "0"
    total: str
```

- [ ] **Step 2: Update `_breakdown_response()` in `booking_service.py`**

Replace lines 74–81:

```python
def _breakdown_response(b: dict[str, Any]) -> PriceBreakdownResponse:
    return PriceBreakdownResponse(
        category=str(b["category"]),
        access_type=str(b["access_type"]),
        duration_days=str(b.get("duration_days", "1")),
        per_day_rate=str(b.get("per_day_rate", b.get("base", "0"))),
        base=str(b.get("base", b.get("base_price", "0"))),
        locker_per_day=str(b.get("locker_per_day", "0.00")),
        locker_fee=str(b.get("locker_fee", "0")),
        total=str(b.get("total", b.get("final_price", "0"))),
    )
```

- [ ] **Step 3: Add `duration_days=days` to all 3 `compute_stored_breakdown` calls**

**Call 1** — `check_availability()` (around line 210):
```python
        final, breakdown_dict = compute_stored_breakdown(
            category=category,
            access_type=access,
            cfg=snap,
            duration_days=days,
            with_locker=body.with_locker,
        )
```

**Call 2** — `create_booking()` (around line 265):
```python
        final_price, breakdown_dict = compute_stored_breakdown(
            category=category,
            access_type=access,
            cfg=snap,
            duration_days=days,
            with_locker=body.with_locker,
        )
```

**Call 3** — `update_booking()` (around line 360):
```python
        new_final, new_breakdown = compute_stored_breakdown(
            category=category, access_type=access, cfg=snap,
            duration_days=days, with_locker=body.with_locker,
        )
```

- [ ] **Step 4: Run backend tests**

```bash
cd /Users/akarna/PycharmProjects/zenoviz/backend && .venv/bin/pytest -q 2>&1 | tail -10
```

Expected: all tests pass (or only the pre-existing unrelated failure). If `test_booking_flow.py` fails with wrong price assertions, read the failing test, calculate the correct expected price (rate × days used in that test), and fix the assertion.

- [ ] **Step 5: Commit**

```bash
git add src/models/study_api.py src/services/booking_service.py
git commit -m "feat: pass duration_days to compute_stored_breakdown in service layer"
```

---

### Task 4: Update frontend

**Files:**
- Modify: `frontend/src/app/core/api/models.ts`
- Modify: `frontend/src/app/features/admin/admin-pricing.component.ts`
- Modify: `frontend/src/app/features/bookings/create-booking.component.ts`

- [ ] **Step 1: Add new fields to `PriceBreakdown` in `models.ts`**

Replace the `PriceBreakdown` interface:

```typescript
/**
 * Shape matches backend `PriceBreakdownResponse`. Backend returns all monetary
 * fields as strings (serialised Decimals) to preserve precision across the wire.
 */
export interface PriceBreakdown {
  category: string;
  access_type: string;
  duration_days: string;
  per_day_rate: string;
  base: string;
  locker_per_day: string;
  locker_fee: string;
  total: string;
}
```

- [ ] **Step 2: Update admin pricing section headers in `admin-pricing.component.ts`**

Update the three `<h3>` labels to clarify these are per-day rates:

```html
<h3>3-Hour (Timeslot) prices (NPR/day)</h3>
```
```html
<h3>Anytime prices (NPR/day)</h3>
```
```html
<h3>Locker add-on (NPR/day)</h3>
```

- [ ] **Step 3: Update breakdown display in `create-booking.component.ts`**

Replace the `<dl class="invoice-lines">` block (currently showing plain "Price" and "Locker"):

```html
                <dl class="invoice-lines">
                  <div class="invoice-line">
                    <dt>{{ nprPrefix }} {{ formatNpr(a.breakdown.per_day_rate) }}/day × {{ a.breakdown.duration_days }} days</dt>
                    <dd>{{ nprPrefix }} {{ formatNpr(a.breakdown.base) }}</dd>
                  </div>
                  @if (hasLockerFee(a)) {
                    <div class="invoice-line">
                      <dt>Locker {{ nprPrefix }} {{ formatNpr(a.breakdown.locker_per_day) }}/day × {{ a.breakdown.duration_days }} days</dt>
                      <dd>+{{ nprPrefix }} {{ formatNpr(a.breakdown.locker_fee) }}</dd>
                    </div>
                  }
                </dl>
```

- [ ] **Step 4: Build frontend**

```bash
source ~/.nvm/nvm.sh && nvm use 18 && cd /Users/akarna/PycharmProjects/zenoviz/frontend && npm run build 2>&1 | grep -E "error TS|ERROR"
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/core/api/models.ts \
        frontend/src/app/features/admin/admin-pricing.component.ts \
        frontend/src/app/features/bookings/create-booking.component.ts
git commit -m "feat(frontend): show per-day × days breakdown and update pricing labels"
```

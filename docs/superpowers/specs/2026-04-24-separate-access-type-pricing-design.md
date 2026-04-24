# Separate Access-Type Pricing Design

**Date:** 2026-04-24
**Status:** Approved

## Problem

The current pricing model applies a percentage surcharge on top of a discounted base price to derive the anytime access price. This is confusing to admins — the final anytime price is not obvious from the config, and the discount + surcharge machinery adds unnecessary complexity.

## Goal

Replace the surcharge model with explicit flat prices for each combination of access type (timeslot / anytime) and duration category (daily / weekly / monthly).

---

## Data Model

### `pricing_configs` table changes

**Remove:**
- `daily_base_price`
- `weekly_base_price`
- `monthly_base_price`
- `daily_discount_percent`
- `weekly_discount_percent`
- `monthly_discount_percent`
- `anytime_surcharge_percent`

**Add:**
| Column | Type | Default |
|---|---|---|
| `timeslot_daily_price` | Numeric(12,2) | 0 |
| `timeslot_weekly_price` | Numeric(12,2) | 0 |
| `timeslot_monthly_price` | Numeric(12,2) | 0 |
| `anytime_daily_price` | Numeric(12,2) | 0 |
| `anytime_weekly_price` | Numeric(12,2) | 0 |
| `anytime_monthly_price` | Numeric(12,2) | 0 |

**Unchanged:** `locker_daily_price`, `locker_weekly_price`, `locker_monthly_price`, `reservation_timeout_minutes`, `business_open_minute`, `business_close_minute`, `id`, `is_active`, `created_at`.

### Seed defaults

| | Daily | Weekly | Monthly |
|---|---|---|---|
| Timeslot | 15.00 | 80.00 | 250.00 |
| Anytime | 20.00 | 100.00 | 300.00 |

---

## Domain Layer (`study_pricing.py`)

### `PricingConfigSnapshot`
Replace the 7 removed fields with 6 new price fields.

### `compute_stored_breakdown()`
Simplified — no discount or surcharge math:

```
base = price_for(access_type, category, cfg)
locker_fee = locker_price_for_category(category, cfg) if with_locker else 0
final_price = base + locker_fee
```

Stored `price_breakdown` JSON shape:
```json
{ "base": "15.00", "locker_fee": "0.00", "total": "15.00" }
```

### Removed helpers
`base_price_for_category()` and `discount_percent_for_category()` are removed.

### New helper
`price_for(access_type, category, cfg) -> Decimal` — direct lookup of the correct price field.

---

## ORM Model (`study_room.py`)

`PricingConfig` mapped class: remove 7 old `Mapped` fields, add 6 new ones.

---

## Pydantic Schemas (`study_api.py`)

**`UpdatePricingRequest`:** remove 7 old fields, add 6 new price fields (`Decimal`, `ge=0`, `Field(default=Decimal("0"))`).

**`PricingConfigResponse`:** same field swap (returned as `str` like existing price fields).

---

## Service Layer (`booking_service.py`)

`_snapshot_from_pricing()`: map 6 new ORM fields onto the snapshot. No other service logic changes.

---

## Migration

Single Alembic migration (`add_separate_access_type_pricing`):
- Drop 7 old columns from `pricing_configs`
- Add 6 new columns with `server_default="0"`

---

## Backward Compatibility

Existing bookings store `price_breakdown` JSON frozen at booking time. Old bookings keep their old JSON shape (with `discount_pct`, `surcharge`, etc.) — this is fine since prices are never recomputed from the config after booking creation. New bookings get the simplified shape. No booking data migration required.

---

## Out of Scope

- Frontend changes (separate task)
- Per-seat pricing overrides
- Time-of-day pricing

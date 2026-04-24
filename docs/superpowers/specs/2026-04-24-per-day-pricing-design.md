# Per-Day Pricing Design

**Date:** 2026-04-24
**Status:** Approved

## Problem

The current pricing model applies a flat rate per category tier regardless of how many days are booked. A 9-day booking and a 14-day booking both cost `timeslot_weekly_price` — the same flat amount. Admins set a per-day rate but the system ignores duration within a tier.

## Goal

Multiply the per-day rate by the number of days booked. A 9-day booking at Rs. 15/day costs Rs. 135, not Rs. 15.

---

## Domain Layer (`study_pricing.py`)

`compute_stored_breakdown()` receives a new required parameter: `duration_days: int`.

Calculation:
```
per_day_rate = price_for(access_type, category, cfg)
base         = per_day_rate × duration_days

locker_per_day = locker_price_for_category(category, cfg)
locker_fee     = locker_per_day × duration_days   (if with_locker, else 0)

total = base + locker_fee
```

All values quantized to 2 decimal places.

New breakdown JSON shape:
```json
{
  "category": "weekly",
  "access_type": "timeslot",
  "duration_days": 9,
  "per_day_rate": "15.00",
  "base": "135.00",
  "locker_per_day": "0.00",
  "locker_fee": "0.00",
  "total": "135.00"
}
```

---

## Service Layer (`booking_service.py`)

Three callers of `compute_stored_breakdown()` — `check_availability()`, `create_booking()`, and `update_booking()` — all already compute `duration_days` from `duration_days(start_date, end_date)`. Each call gains a `duration_days=days` argument. No other service changes.

---

## Pydantic Schema (`study_api.py`)

`PriceBreakdownResponse` gains three new fields:
- `duration_days: str`
- `per_day_rate: str`
- `locker_per_day: str = "0.00"`

The `_breakdown_response()` mapper in `booking_service.py` reads these from the stored dict (with `.get()` defaults for old bookings that lack them).

---

## Frontend

### Admin pricing form (`admin-pricing.component.ts`)

Section headers updated to clarify per-day intent:
- "3-Hour (Timeslot) prices" → "3-Hour (Timeslot) prices (NPR/day)"
- "Anytime prices" → "Anytime prices (NPR/day)"
- "Locker add-on" → "Locker add-on (NPR/day)"

### TypeScript model (`models.ts`)

`PriceBreakdown` gains three fields:
```typescript
duration_days: string;
per_day_rate: string;
locker_per_day: string;
```

### Booking breakdown display (`create-booking.component.ts`)

The invoice lines `<dl>` shows the per-day multiplication:

```
Rs. 15/day × 9 days      Rs. 135
+ Locker Rs. 5/day × 9   Rs. 45    (if locker selected)
```

Template reads `a.breakdown.per_day_rate`, `a.breakdown.duration_days`, `a.breakdown.locker_per_day`.

---

## Backward Compatibility

Existing bookings have old-format `price_breakdown` JSON without `duration_days`, `per_day_rate`, or `locker_per_day`. The `_breakdown_response()` mapper uses `.get()` with safe defaults (`"0"`, `"1"`, `"0.00"`) so old bookings render without errors. No migration of booking data required.

---

## Out of Scope

- Changing tier boundaries (daily < 7, weekly 7–29, monthly 30+)
- Proration for partial weeks/months
- Per-seat price overrides

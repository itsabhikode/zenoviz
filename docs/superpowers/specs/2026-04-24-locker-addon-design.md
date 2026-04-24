# Locker Add-on for Seat Bookings

**Date:** 2026-04-24  
**Status:** Approved

## Summary

Users can optionally add a locker to any seat booking. The locker fee is a flat per-category amount (daily / weekly / monthly) configured by admin alongside the existing pricing config. Price increases automatically when locker is selected.

## Approach

Locker pricing lives in `PricingConfig` (three new decimal columns). The booking records `with_locker: bool`. Pricing domain logic computes the locker fee at booking time and stores it in the `price_breakdown` snapshot — the same frozen-at-booking-time pattern used for all other price lines.

## Data Model

### `PricingConfig` — new columns (default `0`)
| column | type |
|--------|------|
| `locker_daily_price` | `Numeric(12,2)` |
| `locker_weekly_price` | `Numeric(12,2)` |
| `locker_monthly_price` | `Numeric(12,2)` |

### `Booking` — new column
| column | type |
|--------|------|
| `with_locker` | `Boolean`, default `False` |

### `PricingConfigSnapshot` (domain dataclass)
Three matching `Decimal` fields added: `locker_daily_price`, `locker_weekly_price`, `locker_monthly_price`.

### `price_breakdown` JSON — new key
```json
{ "locker_fee": "50.00" }
```
`locker_fee` is always present; value is `"0.00"` when no locker.

### `reversion_snapshot` (v1)
Extended with `"with_locker": bool` so the expiry job can restore the correct locker state.

## Domain Logic

`compute_stored_breakdown` in `study_pricing.py` accepts a new `with_locker: bool` parameter.

```
locker_fee = locker_<category>_price  if with_locker else 0
final_price = discounted + surcharge + locker_fee
```

The locker fee is a flat add-on applied after the anytime surcharge. No discounts or percentages apply to the locker fee.

## API Changes

### Requests (new field, default `false`)
- `AvailabilityCheckRequest.with_locker: bool = False`
- `CreateBookingRequest.with_locker: bool = False`

### Responses (new fields)
- `PriceBreakdownResponse.locker_fee: str` — always present, `"0.00"` when no locker
- `AvailabilityCheckResponse` — inherits `locker_fee` via `breakdown`
- `BookingResponse.with_locker: bool`
- `PricingConfigResponse` — three new locker price string fields
- `UpdatePricingRequest` — three new locker price `Decimal` fields (default `0`)

### Endpoints unchanged in shape
- `GET /study-room/availability` — passes `with_locker` through
- `POST /bookings` — passes `with_locker` through
- `PUT /bookings/{id}` — passes `with_locker` through; locker upgrade on completed booking triggers existing top-up flow (new_final > paid → RESERVED with fresh expiry)
- `PUT /admin/study-room/pricing` — carries new locker fields naturally
- `GET /admin/study-room/pricing` — returns new locker fields

## Service Layer

`BookingService.check_availability`, `create_booking`, and `update_booking` all pass `with_locker` to `compute_stored_breakdown`. No other service logic changes — the existing price-delta rules for completed bookings handle locker upgrades/downgrades correctly.

## Frontend

### Create / Edit booking form
After seat selection, a checkbox row appears in the invoice section:

```
[ ] Add locker   +₹<locker_fee_for_category>
```

- Bound to a `withLocker` signal (`false` by default).
- Toggling re-runs the price effect (passes `with_locker` to `checkAvailability`).
- Invoice shows a `Locker` line item when `with_locker` is true.
- `CreateBookingRequest` on confirm includes `with_locker`.
- Edit booking mirrors create.

### My Bookings
Booking card shows a locker badge/chip when `with_locker` is true.

### Admin pricing form
Three new number inputs: **Locker (daily)**, **Locker (weekly)**, **Locker (monthly)**.

## Database Migration

One Alembic migration:
1. Add `locker_daily_price`, `locker_weekly_price`, `locker_monthly_price` to `pricing_configs` (default `0`).
2. Add `with_locker` to `bookings` (default `false`).

## Testing

- `study_pricing` unit tests: `with_locker=True` adds correct fee per category; `with_locker=False` adds zero.
- `BookingService` unit tests: `check_availability`, `create_booking`, `update_booking` with locker flag.
- Integration tests: create booking with locker → `final_price` includes locker fee; edit to remove locker on completed booking is a downgrade (rejected if cheaper than paid).
- Frontend: toggle updates invoice total; confirm sends `with_locker`.

# Frontend Flat Pricing Alignment Design

**Date:** 2026-04-24
**Status:** Approved

## Problem

The backend pricing model was refactored to use 6 explicit flat prices (timeslot/anytime × daily/weekly/monthly) replacing the old base-price + discount% + surcharge% model. The frontend still uses the old field names and UI, making the admin pricing form and booking breakdown display broken against the new API.

## Goal

Update three frontend files to align with the new backend API — no new features, no layout redesign.

---

## Changes

### 1. `frontend/src/app/core/api/models.ts`

**`PriceBreakdown` interface** — replace 6 old fields with 3 new ones:

```typescript
export interface PriceBreakdown {
  category: string;
  access_type: string;
  base: string;        // was: base_price, discount_percent, discounted_price,
  locker_fee: string;  //      anytime_surcharge_percent, surcharge
  total: string;       // was: final_price
}
```

**`PricingConfigResponse` interface** — replace 7 old fields with 6 new ones:

```typescript
export interface PricingConfigResponse {
  timeslot_daily_price: number;
  timeslot_weekly_price: number;
  timeslot_monthly_price: number;
  anytime_daily_price: number;
  anytime_weekly_price: number;
  anytime_monthly_price: number;
  locker_daily_price: number;     // unchanged
  locker_weekly_price: number;    // unchanged
  locker_monthly_price: number;   // unchanged
  reservation_timeout_minutes: number;  // unchanged
  business_open_time: string;     // unchanged
  business_close_time: string;    // unchanged
}
```

`UpdatePricingRequest extends PricingConfigResponse` — no change needed (inherits automatically).

---

### 2. `frontend/src/app/features/admin/admin-pricing.component.ts`

**Template changes:**
- Remove "Base Prices" section (3 inputs: daily_base_price, weekly_base_price, monthly_base_price)
- Remove "Discounts" section (3 inputs: daily_discount_percent, weekly_discount_percent, monthly_discount_percent)
- Remove "Anytime Surcharge" input (anytime_surcharge_percent)
- Add **"3-Hour (Timeslot) Prices"** section with 3 inputs: timeslot_daily_price, timeslot_weekly_price, timeslot_monthly_price
- Add **"Anytime Prices"** section with 3 inputs: anytime_daily_price, anytime_weekly_price, anytime_monthly_price
- Locker prices section, rules section, business hours section — unchanged

**Form group changes:**
- Remove 7 old controls
- Add 6 new controls: `timeslot_daily_price`, `timeslot_weekly_price`, `timeslot_monthly_price`, `anytime_daily_price`, `anytime_weekly_price`, `anytime_monthly_price` — all `[0, [Validators.required, Validators.min(0)]]`

---

### 3. `frontend/src/app/features/bookings/create-booking.component.ts`

**Template changes** — replace the 3-row breakdown (base → discount → surcharge) with 2-row breakdown:

```html
<dl class="invoice-lines">
  <div class="invoice-line">
    <dt>Price</dt>
    <dd>{{ nprPrefix }} {{ formatNpr(a.breakdown.base) }}</dd>
  </div>
  @if (hasLockerFee(a)) {
    <div class="invoice-line">
      <dt>Locker</dt>
      <dd>+{{ nprPrefix }} {{ formatNpr(a.breakdown.locker_fee) }}</dd>
    </div>
  }
</dl>
```

**Helper method changes:**
- Remove `hasDiscount()`, `hasSurcharge()`, `discountAmount()` — dead code
- Keep `hasLockerFee()` unchanged

---

## Out of Scope

- `edit-booking.component.ts` breakdown display (uses `final_price` from booking, not from `PriceBreakdown` — unaffected)
- `my-bookings`, `admin-payments`, `admin-bookings` — all use `booking.final_price`, not `PriceBreakdown` fields — unaffected

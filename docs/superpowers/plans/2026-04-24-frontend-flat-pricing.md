# Frontend Flat Pricing Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the Angular frontend to use the new flat access-type pricing API (6 explicit price fields instead of base-price + discount% + surcharge%).

**Architecture:** Three focused edits — TypeScript models first so the compiler catches every downstream reference, then the admin pricing form, then the booking breakdown display. Each task compiles cleanly on its own.

**Tech Stack:** Angular 19, TypeScript strict mode. Build: `cd frontend && npm run build`. No unit test changes needed — TypeScript compilation is the verification gate for interface changes.

---

## File Map

| File | Change |
|---|---|
| `frontend/src/app/core/api/models.ts` | Replace `PriceBreakdown` and `PricingConfigResponse` interfaces |
| `frontend/src/app/features/admin/admin-pricing.component.ts` | Replace template sections and form group controls |
| `frontend/src/app/features/bookings/create-booking.component.ts` | Replace breakdown template rows; remove dead helper methods |

---

### Task 1: Update TypeScript models

**Files:**
- Modify: `frontend/src/app/core/api/models.ts:70-80` (`PriceBreakdown`)
- Modify: `frontend/src/app/core/api/models.ts:151-165` (`PricingConfigResponse`)

- [ ] **Step 1: Replace `PriceBreakdown` interface (lines 70–80)**

```typescript
/**
 * Shape matches backend `PriceBreakdownResponse`. Backend returns all monetary
 * fields as strings (serialised Decimals) to preserve precision across the wire.
 */
export interface PriceBreakdown {
  category: string;
  access_type: string;
  base: string;
  locker_fee: string;
  total: string;
}
```

- [ ] **Step 2: Replace `PricingConfigResponse` interface (lines 151–165)**

```typescript
// Admin pricing
export interface PricingConfigResponse {
  timeslot_daily_price: number;
  timeslot_weekly_price: number;
  timeslot_monthly_price: number;
  anytime_daily_price: number;
  anytime_weekly_price: number;
  anytime_monthly_price: number;
  locker_daily_price: number;
  locker_weekly_price: number;
  locker_monthly_price: number;
  reservation_timeout_minutes: number;
  business_open_time: string; // HH:mm
  business_close_time: string;
}

export interface UpdatePricingRequest extends PricingConfigResponse {}
```

- [ ] **Step 3: Run build to catch all downstream type errors**

```bash
cd /Users/akarna/PycharmProjects/zenoviz/frontend && npm run build 2>&1 | grep -E "error TS|ERROR"
```

Expected: TypeScript errors in `admin-pricing.component.ts` and `create-booking.component.ts` referencing the old fields — these confirm the interface change propagated. They will be fixed in Tasks 2 and 3.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/core/api/models.ts
git commit -m "refactor(frontend): update PriceBreakdown and PricingConfigResponse to flat pricing fields"
```

---

### Task 2: Update admin pricing form

**Files:**
- Modify: `frontend/src/app/features/admin/admin-pricing.component.ts`

- [ ] **Step 1: Replace the entire template `<form>` contents**

Replace everything between `<form [formGroup]="form" (ngSubmit)="save()" class="form">` and `</form>` (lines 40–164) with:

```html
        <form [formGroup]="form" (ngSubmit)="save()" class="form">
          <h3>3-Hour (Timeslot) prices (NPR, Rs.)</h3>
          <div class="grid3">
            <mat-form-field appearance="outline">
              <mat-label>Daily</mat-label>
              <input matInput type="number" formControlName="timeslot_daily_price" min="0" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Weekly</mat-label>
              <input matInput type="number" formControlName="timeslot_weekly_price" min="0" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Monthly</mat-label>
              <input matInput type="number" formControlName="timeslot_monthly_price" min="0" />
            </mat-form-field>
          </div>

          <mat-divider />

          <h3>Anytime prices (NPR, Rs.)</h3>
          <div class="grid3">
            <mat-form-field appearance="outline">
              <mat-label>Daily</mat-label>
              <input matInput type="number" formControlName="anytime_daily_price" min="0" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Weekly</mat-label>
              <input matInput type="number" formControlName="anytime_weekly_price" min="0" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Monthly</mat-label>
              <input matInput type="number" formControlName="anytime_monthly_price" min="0" />
            </mat-form-field>
          </div>

          <mat-divider />

          <h3>Rules</h3>
          <div class="grid3">
            <mat-form-field appearance="outline">
              <mat-label>Reservation timeout (min)</mat-label>
              <input
                matInput
                type="number"
                formControlName="reservation_timeout_minutes"
                min="1"
              />
            </mat-form-field>
          </div>

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

          <mat-divider />

          <h3>Business hours</h3>
          <div class="grid3">
            <mat-form-field appearance="outline">
              <mat-label>Open</mat-label>
              <input matInput type="time" formControlName="business_open_time" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Close</mat-label>
              <input matInput type="time" formControlName="business_close_time" />
            </mat-form-field>
          </div>

          <div class="actions">
            <button
              mat-flat-button
              color="primary"
              type="submit"
              [disabled]="saving() || form.invalid"
            >
              {{ saving() ? 'Saving…' : 'Save pricing' }}
            </button>
            <button mat-stroked-button type="button" (click)="reload()" [disabled]="loading()">
              <mat-icon>refresh</mat-icon>
              Reload
            </button>
          </div>
        </form>
```

- [ ] **Step 2: Replace the form group definition (lines 201–215)**

```typescript
  readonly form = this.fb.nonNullable.group({
    timeslot_daily_price: [0, [Validators.required, Validators.min(0)]],
    timeslot_weekly_price: [0, [Validators.required, Validators.min(0)]],
    timeslot_monthly_price: [0, [Validators.required, Validators.min(0)]],
    anytime_daily_price: [0, [Validators.required, Validators.min(0)]],
    anytime_weekly_price: [0, [Validators.required, Validators.min(0)]],
    anytime_monthly_price: [0, [Validators.required, Validators.min(0)]],
    reservation_timeout_minutes: [30, [Validators.required, Validators.min(1)]],
    locker_daily_price: [0, [Validators.required, Validators.min(0)]],
    locker_weekly_price: [0, [Validators.required, Validators.min(0)]],
    locker_monthly_price: [0, [Validators.required, Validators.min(0)]],
    business_open_time: ['09:00', Validators.required],
    business_close_time: ['21:00', Validators.required],
  });
```

- [ ] **Step 3: Build to verify no errors in this file**

```bash
cd /Users/akarna/PycharmProjects/zenoviz/frontend && npm run build 2>&1 | grep -E "error TS|ERROR" | grep "admin-pricing"
```

Expected: no errors mentioning `admin-pricing.component.ts`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/features/admin/admin-pricing.component.ts
git commit -m "refactor(frontend): update admin pricing form to flat access-type price fields"
```

---

### Task 3: Update booking breakdown display

**Files:**
- Modify: `frontend/src/app/features/bookings/create-booking.component.ts`

- [ ] **Step 1: Replace the breakdown `<dl>` block in the template (lines 251–283)**

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

- [ ] **Step 2: Remove dead helper methods**

Delete the following three methods (leave `hasLockerFee` untouched):

- `hasSurcharge()` at lines 887–890
- `hasDiscount()` at lines 1061–1064
- `discountAmount()` at lines 1066–1072

- [ ] **Step 3: Build to verify no errors**

```bash
cd /Users/akarna/PycharmProjects/zenoviz/frontend && npm run build 2>&1 | grep -E "error TS|ERROR"
```

Expected: no errors. Clean build.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/features/bookings/create-booking.component.ts
git commit -m "refactor(frontend): simplify booking breakdown display for flat pricing"
```

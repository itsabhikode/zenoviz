import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';

import { BookingsService } from '../../core/api/bookings.service';
import {
  AccessType,
  AvailabilityResponse,
  CreateBookingRequest,
  SeatsAvailabilityRequest,
} from '../../core/api/models';
import { SeatGridComponent } from './seat-grid.component';

function toIsoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Backend requires exactly a 3-hour window; compute it from start so we never
 * send a stale end_time while form controls are catching up. */
function addThreeHours(hhmm: string): string | null {
  const parts = hhmm.split(':');
  if (parts.length !== 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const eh = (h + 3) % 24;
  return `${String(eh).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

@Component({
  selector: 'zv-create-booking',
  standalone: true,
  providers: [provideNativeDateAdapter(), { provide: MAT_DATE_LOCALE, useValue: 'en-GB' }],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatRadioModule,
    MatSnackBarModule,
    MatTooltipModule,
    SeatGridComponent,
  ],
  template: `
    <div class="zv-page">
      <h2 class="zv-page-title">Book a seat</h2>

      <mat-card>
        <form [formGroup]="form" class="form">
          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>Start date</mat-label>
              <input matInput [matDatepicker]="dp1" formControlName="start_date" />
              <mat-datepicker-toggle matIconSuffix [for]="dp1" />
              <mat-datepicker #dp1 />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>End date</mat-label>
              <input matInput [matDatepicker]="dp2" formControlName="end_date" />
              <mat-datepicker-toggle matIconSuffix [for]="dp2" />
              <mat-datepicker #dp2 />
            </mat-form-field>
          </div>

          <mat-radio-group formControlName="access_type" class="access">
            <mat-radio-button value="timeslot">Fixed 3-hour slot</mat-radio-button>
            <mat-radio-button value="anytime">Full-day access (ANYTIME)</mat-radio-button>
          </mat-radio-group>

          @if (form.controls.access_type.value === 'timeslot') {
            <section class="slot-section">
              <header class="slot-section-header">
                <div class="slot-heading">
                  <mat-icon class="slot-heading-icon">schedule</mat-icon>
                  <div>
                    <h3>Pick a 3-hour slot</h3>
                    <p class="slot-hint">Tap any slot inside business hours.</p>
                  </div>
                </div>
                @if (selectedSlot(); as sel) {
                  <span class="slot-selected-pill">
                    <strong>{{ sel.start }} – {{ sel.end }}</strong>
                    <small>{{ sel.meta }}</small>
                  </span>
                }
              </header>

              <div class="slot-chips" role="radiogroup" aria-label="3-hour slot options">
                @for (slot of slotOptions; track slot.start) {
                  <button
                    type="button"
                    role="radio"
                    class="slot-chip"
                    [attr.aria-checked]="form.controls.start_time.value === slot.start"
                    [class.selected]="form.controls.start_time.value === slot.start"
                    (click)="selectSlot(slot.start)"
                  >
                    <span class="slot-chip-range">{{ slot.start }} – {{ slot.end }}</span>
                    <span class="slot-chip-meta">{{ slot.meta }}</span>
                  </button>
                }
              </div>
            </section>
          }

          <section class="seat-section" [class.ready]="seatSelectionReady()">
            <header class="seat-header">
              <div>
                <h3>Pick your seat</h3>
                <p class="hint">
                  @if (!seatSelectionReady()) {
                    Choose your dates
                    @if (hasTimeslot()) { and time slot }
                    to see which seats are available.
                  } @else if (selectedSeat() !== null) {
                    Seat <strong>{{ selectedSeat() }}</strong> selected — you can book now.
                  } @else {
                    <strong>Tap an available seat below</strong> to continue
                    ({{ availableCount() }} of 65 free).
                  }
                </p>
              </div>
              @if (loadingSeats()) {
                <mat-icon class="spin" aria-label="Refreshing seat map">refresh</mat-icon>
              }
            </header>

            @if (seatSelectionReady()) {
              <zv-seat-grid
                [unavailable]="unavailableSeats()"
                [selected]="selectedSeat()"
                [disabled]="loadingSeats()"
                (selectedChange)="onSeatPicked($event)"
              />
            } @else {
              <div class="seat-placeholder">
                <mat-icon>event_seat</mat-icon>
                <span>Seat map appears here.</span>
              </div>
            }
          </section>

          @if (selectedSeat() !== null && seatSelectionReady()) {
            <section class="zv-invoice" aria-label="Booking summary">
              <header class="invoice-header">
                <div class="invoice-heading">
                  <span class="invoice-eyebrow">Review before you book</span>
                  <h3>Booking summary</h3>
                </div>
                <button
                  mat-button
                  type="button"
                  (click)="refreshPrice()"
                  [disabled]="checking()"
                  class="invoice-refresh"
                  matTooltip="Recalculate price"
                >
                  <mat-icon [class.spin]="checking()">refresh</mat-icon>
                  <span>Refresh</span>
                </button>
              </header>

              @if (checking() && !availability()) {
                <div class="invoice-skeleton">
                  <mat-progress-bar mode="indeterminate" />
                  <span>Calculating price…</span>
                </div>
              }
              @if (availability(); as a) {
                @if (!a.available) {
                  <div class="invoice-warning" role="alert">
                    <mat-icon>warning_amber</mat-icon>
                    <div>
                      <strong>This seat is not available for the selected window.</strong>
                      @if (a.reason) {
                        <div class="warning-reason">{{ a.reason }}</div>
                      }
                    </div>
                  </div>
                }

                <dl class="invoice-meta">
                  <div class="invoice-meta-row">
                    <dt>Seat</dt>
                    <dd>
                      <span class="seat-badge">#{{ selectedSeat() }}</span>
                    </dd>
                  </div>
                  <div class="invoice-meta-row">
                    <dt>Dates</dt>
                    <dd>{{ dateLabel() }}</dd>
                  </div>
                  <div class="invoice-meta-row">
                    <dt>Access</dt>
                    <dd>{{ accessLabel() }}</dd>
                  </div>
                  <div class="invoice-meta-row">
                    <dt>Duration</dt>
                    <dd>
                      {{ a.duration_days }}
                      {{ a.duration_days === 1 ? 'day' : 'days' }}
                      · <span class="category-chip">{{ a.category }}</span>
                    </dd>
                  </div>
                </dl>

                <dl class="invoice-lines">
                  <div class="invoice-line">
                    <dt>Base price</dt>
                    <dd>₹{{ formatInr(a.breakdown.base_price) }}</dd>
                  </div>
                  @if (hasDiscount(a)) {
                    <div class="invoice-line">
                      <dt>
                        Discount
                        <span class="line-meta">({{ a.breakdown.discount_percent }}%)</span>
                      </dt>
                      <dd class="negative">−₹{{ formatInr(discountAmount(a)) }}</dd>
                    </div>
                  }
                  @if (hasSurcharge(a)) {
                    <div class="invoice-line">
                      <dt>
                        ANYTIME surcharge
                        <span class="line-meta"
                          >({{ a.breakdown.anytime_surcharge_percent }}%)</span
                        >
                      </dt>
                      <dd>+₹{{ formatInr(a.breakdown.surcharge) }}</dd>
                    </div>
                  }
                </dl>

                <div class="invoice-total">
                  <span>Total due at booking</span>
                  <span class="total-amount">₹{{ formatInr(a.final_price) }}</span>
                </div>

                <p class="invoice-note">
                  <mat-icon>info</mat-icon>
                  Booking is held for a short while after you click Confirm. Upload
                  payment proof on the My Bookings page to complete it.
                </p>
              }
            </section>
          } @else if (disabledReason()) {
            <div class="disabled-banner" role="status">
              <mat-icon>info</mat-icon>
              <span>{{ disabledReason() }}</span>
            </div>
          }

          <div class="actions">
            <button
              mat-flat-button
              color="primary"
              type="button"
              (click)="submit()"
              [disabled]="!canConfirm() || submitting()"
              [matTooltip]="confirmDisabledReason() || ''"
            >
              <mat-icon>event_available</mat-icon>
              @if (submitting()) {
                Booking…
              } @else if (availability()?.available) {
                Confirm booking · ₹{{ formatInr(availability()!.final_price) }}
              } @else {
                Confirm booking
              }
            </button>
          </div>
        </form>

        @if (submitting()) {
          <mat-progress-bar mode="indeterminate" />
        }
      </mat-card>
    </div>
  `,
  styles: [
    `
      .form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 16px;
      }
      .row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
      }
      .access {
        display: flex;
        gap: 16px;
      }
      .slot-section {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 16px 18px;
        border-radius: var(--zv-radius-lg);
        border: 1px solid rgba(15, 23, 42, 0.08);
        background: rgba(248, 250, 252, 0.6);
      }
      .slot-section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .slot-heading {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .slot-heading-icon {
        color: #7c3aed;
        background: var(--zv-gradient-brand-soft);
        border-radius: 10px;
        padding: 6px;
        width: 32px;
        height: 32px;
        font-size: 20px;
        display: grid;
        place-items: center;
      }
      .slot-heading h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.01em;
        color: #0f172a;
      }
      .slot-hint {
        margin: 2px 0 0;
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant);
      }
      .slot-selected-pill {
        display: inline-flex;
        align-items: baseline;
        gap: 8px;
        padding: 6px 12px;
        border-radius: 999px;
        background: var(--zv-gradient-brand-soft);
        color: #6d28d9;
        border: 1px solid rgba(124, 58, 237, 0.2);
        font-size: 13px;
        font-variant-numeric: tabular-nums;
      }
      .slot-selected-pill small {
        font-size: 11px;
        opacity: 0.8;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .slot-chips {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
        gap: 10px;
      }
      .slot-chip {
        font: inherit;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
        padding: 10px 14px;
        border-radius: 12px;
        border: 1px solid rgba(15, 23, 42, 0.1);
        background: #ffffff;
        color: var(--mat-sys-on-surface);
        cursor: pointer;
        text-align: left;
        transition: background 0.15s ease, border-color 0.15s ease,
          transform 0.1s ease, box-shadow 0.15s ease, color 0.15s ease;
      }
      .slot-chip-range {
        font-variant-numeric: tabular-nums;
        font-size: 14px;
        font-weight: 600;
        letter-spacing: -0.01em;
      }
      .slot-chip-meta {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--mat-sys-on-surface-variant);
      }
      .slot-chip:hover {
        border-color: rgba(124, 58, 237, 0.35);
        background: rgba(124, 58, 237, 0.04);
      }
      .slot-chip:active {
        transform: translateY(1px);
      }
      .slot-chip.selected {
        background: var(--zv-gradient-brand);
        color: #fff;
        border-color: transparent;
        box-shadow: 0 8px 22px -10px rgba(109, 94, 252, 0.55);
      }
      .slot-chip.selected .slot-chip-meta {
        color: rgba(255, 255, 255, 0.85);
      }
      .actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .actions button {
        min-height: 44px;
      }

      /* ----- Pre-booking invoice ---------------------------- */
      .zv-invoice {
        border-radius: var(--zv-radius-lg);
        border: 1px solid rgba(15, 23, 42, 0.08);
        background: #ffffff;
        box-shadow: var(--zv-shadow-sm);
        padding: 20px 22px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .invoice-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      .invoice-heading {
        display: flex;
        flex-direction: column;
        line-height: 1.2;
      }
      .invoice-eyebrow {
        font-size: 11px;
        color: var(--mat-sys-on-surface-variant);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 600;
      }
      .invoice-header h3 {
        margin: 2px 0 0;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: -0.015em;
      }
      .invoice-refresh {
        border-radius: 999px !important;
        min-width: auto !important;
      }
      .invoice-skeleton {
        display: flex;
        flex-direction: column;
        gap: 8px;
        color: var(--mat-sys-on-surface-variant);
        font-size: 13px;
      }
      .invoice-warning {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        background: var(--zv-status-rejected-bg);
        border: 1px solid var(--zv-status-rejected-border);
        color: var(--zv-status-rejected-fg);
        padding: 10px 14px;
        border-radius: var(--zv-radius-md);
        font-size: 13px;
      }
      .invoice-warning mat-icon {
        color: var(--zv-status-rejected-accent);
        flex-shrink: 0;
      }
      .warning-reason {
        margin-top: 2px;
        color: inherit;
        opacity: 0.85;
      }
      .invoice-meta {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
        margin: 0;
        padding: 12px 0 0;
        border-top: 1px dashed rgba(15, 23, 42, 0.08);
      }
      .invoice-meta-row {
        display: grid;
        grid-template-columns: 120px 1fr;
        align-items: center;
        gap: 12px;
        margin: 0;
      }
      .invoice-meta-row dt {
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 600;
      }
      .invoice-meta-row dd {
        margin: 0;
        font-size: 14px;
        color: var(--mat-sys-on-surface);
        font-weight: 500;
      }
      .seat-badge {
        display: inline-block;
        background: var(--zv-gradient-brand-soft);
        color: #6d28d9;
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 600;
        border: 1px solid rgba(124, 58, 237, 0.2);
      }
      .category-chip {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.04);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .invoice-lines {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin: 0;
        padding: 12px 0;
        border-top: 1px dashed rgba(15, 23, 42, 0.08);
        border-bottom: 1px dashed rgba(15, 23, 42, 0.08);
      }
      .invoice-line {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin: 0;
      }
      .invoice-line dt {
        font-size: 14px;
        color: var(--mat-sys-on-surface);
      }
      .invoice-line dd {
        margin: 0;
        font-size: 14px;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
      }
      .invoice-line .negative {
        color: var(--zv-status-completed-accent);
      }
      .line-meta {
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant);
        font-weight: 400;
      }
      .invoice-total {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        font-size: 15px;
        font-weight: 600;
        padding-top: 4px;
      }
      .invoice-total .total-amount {
        font-size: 22px;
        font-weight: 700;
        letter-spacing: -0.01em;
        font-variant-numeric: tabular-nums;
        background: var(--zv-gradient-brand);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }
      .invoice-note {
        margin: 0;
        display: flex;
        align-items: flex-start;
        gap: 6px;
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant);
        line-height: 1.4;
      }
      .invoice-note mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        margin-top: 1px;
        opacity: 0.75;
      }
      .seat-section {
        margin: 0 -4px;
        padding: 16px;
        border-radius: 14px;
        border: 1px dashed rgba(15, 23, 42, 0.14);
        background: rgba(248, 250, 252, 0.6);
        transition: background 0.2s ease, border-color 0.2s ease;
      }
      .seat-section.ready {
        background: #ffffff;
        border-style: solid;
        border-color: rgba(15, 23, 42, 0.08);
        box-shadow: 0 6px 18px -14px rgba(15, 23, 42, 0.3);
      }
      .seat-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      .seat-header h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.2px;
        color: #0f172a;
      }
      .seat-header .hint {
        margin: 2px 0 0;
        font-size: 13px;
        color: #64748b;
      }
      .seat-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 36px 12px;
        color: #94a3b8;
        font-size: 13px;
      }
      .seat-placeholder mat-icon {
        color: #cbd5e1;
      }
      .spin {
        animation: zv-spin 1s linear infinite;
        color: #7c3aed;
      }
      .disabled-banner {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border-radius: 10px;
        background: #fff7ed;
        color: #9a3412;
        border: 1px solid #fed7aa;
        font-size: 13px;
      }
      .disabled-banner mat-icon {
        color: #ea580c;
        font-size: 18px;
        height: 18px;
        width: 18px;
      }
      @keyframes zv-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `,
  ],
})
export class CreateBookingComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(BookingsService);
  private readonly snack = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group({
    start_date: [null as Date | null, Validators.required],
    end_date: [null as Date | null, Validators.required],
    access_type: ['timeslot' as AccessType, Validators.required],
    start_time: ['10:00'],
    end_time: ['13:00'],
  });

  readonly checking = signal(false);
  readonly submitting = signal(false);
  readonly availability = signal<AvailabilityResponse | null>(null);

  /** Monotonically increasing id to ignore stale availability responses when
   * the user edits inputs faster than the network can respond. */
  private priceReqId = 0;

  readonly selectedSeat = signal<number | null>(null);
  readonly unavailableSeats = signal<readonly number[]>([]);
  readonly loadingSeats = signal(false);

  readonly availableCount = computed(() => 65 - this.unavailableSeats().length);

  /** Mirror the reactive form values into signals so derived state reacts cleanly. */
  private readonly startDateSig = toSignal(this.form.controls.start_date.valueChanges, {
    initialValue: this.form.controls.start_date.value,
  });
  private readonly endDateSig = toSignal(this.form.controls.end_date.valueChanges, {
    initialValue: this.form.controls.end_date.value,
  });
  private readonly accessSig = toSignal(this.form.controls.access_type.valueChanges, {
    initialValue: this.form.controls.access_type.value,
  });

  /** Track form status so `canSubmit` re-evaluates when validity flips. */
  private readonly formStatusSig = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });

  readonly hasTimeslot = computed(() => this.accessSig() === 'timeslot');

  /** We can show the seat map once we know enough to query unavailability. */
  readonly seatSelectionReady = computed(() => {
    if (!this.startDateSig() || !this.endDateSig()) return false;
    if (this.hasTimeslot() && !this.startTimeSignal()) return false;
    return true;
  });

  readonly canSubmit = computed(
    () =>
      this.formStatusSig() === 'VALID' &&
      this.selectedSeat() !== null &&
      this.seatSelectionReady(),
  );

  /**
   * Gate the primary "Confirm booking" button: the user must (a) have supplied
   * every input, (b) have received a priced invoice, and (c) the invoice must
   * report the seat as actually available. This is what prevents users from
   * confirming a booking without seeing the price.
   */
  readonly canConfirm = computed(
    () =>
      this.canSubmit() &&
      !this.checking() &&
      this.availability()?.available === true,
  );

  /** Explanation for why the inputs haven't produced an invoice yet. */
  readonly disabledReason = computed<string>(() => {
    if (this.canSubmit()) return '';
    if (!this.startDateSig()) return 'Pick a start date.';
    if (!this.endDateSig()) return 'Pick an end date.';
    if (this.hasTimeslot() && !this.startTimeSignal()) {
      return 'Pick a 3-hour slot.';
    }
    if (this.selectedSeat() === null) {
      return 'Tap an available seat on the map.';
    }
    if (this.formStatusSig() !== 'VALID') {
      return `Form status: ${this.formStatusSig()} — check highlighted fields.`;
    }
    return 'Complete the form to continue.';
  });

  /** Tooltip on the Confirm button when an invoice is shown but can't be confirmed. */
  readonly confirmDisabledReason = computed<string>(() => {
    if (this.canConfirm()) return '';
    if (!this.canSubmit()) return this.disabledReason();
    if (this.checking()) return 'Calculating price…';
    const a = this.availability();
    if (!a) return 'Waiting for price…';
    if (!a.available) return a.reason ?? 'This seat is not available.';
    return '';
  });

  private readonly startTimeSignal = toSignal(this.form.controls.start_time.valueChanges, {
    initialValue: this.form.controls.start_time.value,
  });

  readonly selectedSlot = computed(() => {
    const v = this.startTimeSignal();
    return this.slotOptions.find((s) => s.start === v) ?? null;
  });

  /**
   * Pre-generated 3-hour slots inside the default business window (09:00 – 21:00).
   * Backend enforces the same rule; keeping this client-side avoids a round-trip
   * for the picker. If admin later tightens business hours, an out-of-range slot
   * is rejected by availability check with a clear error.
   */
  readonly slotOptions: ReadonlyArray<{ start: string; end: string; meta: string }> = (() => {
    const OPEN_HOUR = 9;
    const CLOSE_HOUR = 21;
    const out: { start: string; end: string; meta: string }[] = [];
    for (let h = OPEN_HOUR; h + 3 <= CLOSE_HOUR; h++) {
      const start = `${String(h).padStart(2, '0')}:00`;
      const end = `${String(h + 3).padStart(2, '0')}:00`;
      const meta =
        h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
      out.push({ start, end, meta });
    }
    return out;
  })();

  onStartTimeChange(): void {
    const start = this.form.controls.start_time.value;
    if (!start) return;
    const [h, m] = start.split(':').map(Number);
    const end = new Date(0, 0, 0, h + 3, m);
    const eh = String(end.getHours()).padStart(2, '0');
    const em = String(end.getMinutes()).padStart(2, '0');
    this.form.controls.end_time.setValue(`${eh}:${em}`);
  }

  selectSlot(start: string): void {
    this.form.controls.start_time.setValue(start);
    this.onStartTimeChange();
  }

  hasSurcharge(a: AvailabilityResponse): boolean {
    const n = parseFloat(a.breakdown.surcharge);
    return Number.isFinite(n) && n > 0;
  }

  /** Reactively refetch the seat-availability map whenever the relevant inputs change. */
  private readonly seatMapEffect = effect(() => {
    const ready = this.seatSelectionReady();
    const start = this.startDateSig();
    const end = this.endDateSig();
    const access = this.accessSig();
    const slotStart = this.startTimeSignal();

    if (!ready || !start || !end) {
      this.unavailableSeats.set([]);
      return;
    }

    const isTimeslot = access === 'timeslot';
    const startIso = toIsoDate(start);
    const endIso = toIsoDate(end);
    if (!startIso || !endIso) return;

    // Derive end_time from start_time deterministically so we never send a
    // mismatched pair if the reactive-form sync trails a signal update.
    const endFromStart = isTimeslot && slotStart ? addThreeHours(slotStart) : null;

    const body: SeatsAvailabilityRequest = {
      start_date: startIso,
      end_date: endIso,
      access_type: access,
      start_time: isTimeslot ? slotStart ?? null : null,
      end_time: endFromStart,
    };

    this.loadingSeats.set(true);
    this.api.seatsAvailability(body).subscribe({
      next: (res) => {
        this.unavailableSeats.set(res.unavailable_seat_ids);
        if (
          this.selectedSeat() !== null &&
          res.unavailable_seat_ids.includes(this.selectedSeat()!)
        ) {
          this.selectedSeat.set(null);
        }
        this.loadingSeats.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loadingSeats.set(false);
        this.unavailableSeats.set([]);
        this.snack.open(err.error?.detail ?? 'Could not load seat map', 'Dismiss', {
          duration: 4000,
        });
      },
    });
  });

  onSeatPicked(seatId: number): void {
    this.selectedSeat.set(seatId);
    // Clear the old invoice immediately; the price effect will fetch a fresh one.
    this.availability.set(null);
  }

  /**
   * Auto-price the booking whenever inputs settle. Fires alongside the seat-map
   * effect but is independent: seat-map answers "which seats are free" while
   * this answers "what does this seat cost for this window".
   */
  private readonly priceEffect = effect(() => {
    const seat = this.selectedSeat();
    const start = this.startDateSig();
    const end = this.endDateSig();
    const access = this.accessSig();
    const slotStart = this.startTimeSignal();
    const ready = this.seatSelectionReady();

    if (!ready || seat === null || !start || !end) {
      this.availability.set(null);
      return;
    }

    const isTimeslot = access === 'timeslot';
    const startIso = toIsoDate(start);
    const endIso = toIsoDate(end);
    if (!startIso || !endIso) return;
    if (isTimeslot && !slotStart) return;

    const body: CreateBookingRequest = {
      seat_id: seat,
      start_date: startIso,
      end_date: endIso,
      access_type: access,
      start_time: isTimeslot ? slotStart ?? null : null,
      end_time: isTimeslot && slotStart ? addThreeHours(slotStart) : null,
    };

    const myId = ++this.priceReqId;
    this.checking.set(true);
    this.api.checkAvailability(body).subscribe({
      next: (res) => {
        if (myId !== this.priceReqId) return;
        this.availability.set(res);
        this.checking.set(false);
      },
      error: (err: HttpErrorResponse) => {
        if (myId !== this.priceReqId) return;
        this.checking.set(false);
        this.availability.set(null);
        this.snack.open(err.error?.detail ?? 'Could not price this booking', 'Dismiss', {
          duration: 4000,
        });
      },
    });
  });

  refreshPrice(): void {
    // Force the effect to re-run by bumping the req id and re-submitting the
    // current intent. Simplest way is to read the seat signal then set it to
    // the same value; but using the direct path keeps things explicit.
    const body = this.buildRequest();
    if (!body) return;
    const myId = ++this.priceReqId;
    this.checking.set(true);
    this.api.checkAvailability(body).subscribe({
      next: (res) => {
        if (myId !== this.priceReqId) return;
        this.availability.set(res);
        this.checking.set(false);
      },
      error: (err: HttpErrorResponse) => {
        if (myId !== this.priceReqId) return;
        this.checking.set(false);
        this.snack.open(err.error?.detail ?? 'Refresh failed', 'Dismiss', {
          duration: 4000,
        });
      },
    });
  }

  // ----- Formatting helpers used by the invoice template ----------------

  dateLabel(): string {
    const s = this.form.controls.start_date.value;
    const e = this.form.controls.end_date.value;
    const siso = toIsoDate(s);
    const eiso = toIsoDate(e);
    if (!siso || !eiso) return '—';
    return siso === eiso ? siso : `${siso} → ${eiso}`;
  }

  accessLabel(): string {
    if (this.form.controls.access_type.value === 'anytime') {
      return 'Full-day access (ANYTIME)';
    }
    const start = this.form.controls.start_time.value;
    const slot = this.slotOptions.find((s) => s.start === start);
    return slot ? `${slot.start} – ${slot.end} · ${slot.meta}` : '—';
  }

  formatInr(value: string | number): string {
    const n = typeof value === 'string' ? parseFloat(value) : value;
    if (!Number.isFinite(n)) return String(value);
    const whole = Math.round(n);
    return whole.toLocaleString('en-IN');
  }

  hasDiscount(a: AvailabilityResponse): boolean {
    const n = parseFloat(a.breakdown.discount_percent);
    return Number.isFinite(n) && n > 0;
  }

  /** Base price − discounted price; backend returns both, we show the delta. */
  discountAmount(a: AvailabilityResponse): string {
    const base = parseFloat(a.breakdown.base_price);
    const discounted = parseFloat(a.breakdown.discounted_price);
    if (!Number.isFinite(base) || !Number.isFinite(discounted)) return '0';
    return Math.max(0, base - discounted).toFixed(2);
  }

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
    };
  }

  submit(): void {
    const body = this.buildRequest();
    if (!body) return;
    this.submitting.set(true);
    this.api.create(body).subscribe({
      next: () => {
        this.submitting.set(false);
        this.snack.open('Booking reserved. Upload payment proof next.', 'Dismiss', {
          duration: 4000,
        });
        this.router.navigate(['/app/my-bookings']);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.snack.open(err.error?.detail ?? 'Booking failed', 'Dismiss', {
          duration: 4000,
        });
      },
    });
  }
}

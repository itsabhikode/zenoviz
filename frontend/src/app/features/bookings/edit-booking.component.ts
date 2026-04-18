import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { BookingsService } from '../../core/api/bookings.service';
import {
  AccessType,
  AvailabilityResponse,
  BookingResponse,
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

function parseIsoDate(s: string): Date | null {
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function addThreeHours(hhmm: string | null | undefined): string | null {
  if (!hhmm) return null;
  const parts = hhmm.split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const eh = (h + 3) % 24;
  return `${String(eh).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Strip seconds from "HH:MM:SS" -> "HH:MM" for the slot picker lookup. */
function toHhmm(t: string | null | undefined): string | null {
  if (!t) return null;
  const parts = t.split(':');
  if (parts.length < 2) return null;
  return `${parts[0]}:${parts[1]}`;
}

@Component({
  selector: 'zv-edit-booking',
  standalone: true,
  providers: [provideNativeDateAdapter(), { provide: MAT_DATE_LOCALE, useValue: 'en-GB' }],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
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
      <div class="zv-flex-row">
        <h2 class="zv-page-title">Edit booking</h2>
        <span class="zv-spacer"></span>
        <button mat-button routerLink="/app/my-bookings">
          <mat-icon>arrow_back</mat-icon>
          Back
        </button>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (original(); as orig) {
        @if (orig.status === 'COMPLETED') {
          <div class="context-banner context-banner--paid" role="note">
            <mat-icon>verified</mat-icon>
            <div>
              @if (paidAmountNumber(orig) > 0) {
                <strong>This booking is marked paid (₹{{ orig.paid_amount }} credited).</strong>
              } @else {
                <!-- Legacy rows (approved before the amount-aware flow) have
                     paid_amount=0 on disk; don't lie about "₹0 paid". -->
                <strong>This booking is marked completed.</strong>
              }
              You can upgrade or change to an equal-price plan. Upgrades require
              uploading a top-up proof; cheaper plans are blocked.
            </div>
          </div>
        } @else {
          <div class="context-banner" role="note">
            <mat-icon>info</mat-icon>
            <div>
              Changing anything here resets the reservation timer. Any uploaded
              proof is discarded since the amount may change.
            </div>
          </div>
        }

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
                    @if (selectedSeat() !== null) {
                      Seat <strong>{{ selectedSeat() }}</strong> selected.
                    } @else {
                      <strong>Tap an available seat below</strong>
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
              }
            </section>

            @if (selectedSeat() !== null && seatSelectionReady() && availability(); as a) {
              <section class="zv-invoice" aria-label="Booking diff">
                <header class="invoice-header">
                  <div class="invoice-heading">
                    <span class="invoice-eyebrow">Review changes</span>
                    <h3>Price difference</h3>
                  </div>
                </header>

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

                <dl class="invoice-lines">
                  <div class="invoice-line">
                    <dt>Original plan</dt>
                    <dd>₹{{ formatInr(orig.final_price) }}</dd>
                  </div>
                  <div class="invoice-line">
                    <dt>Already paid</dt>
                    <dd>₹{{ formatInr(orig.paid_amount) }}</dd>
                  </div>
                  <div class="invoice-line">
                    <dt>New plan</dt>
                    <dd>₹{{ formatInr(a.final_price) }}</dd>
                  </div>
                </dl>

                @if (downgradeBlocked()) {
                  <div class="invoice-warning" role="alert">
                    <mat-icon>block</mat-icon>
                    <div>
                      <strong>Cheaper plans are blocked for paid bookings.</strong>
                      Cancel this booking and create a new one instead.
                    </div>
                  </div>
                } @else {
                  <div
                    class="invoice-total"
                    [class.invoice-total--neutral]="deltaSign() === 0"
                    [class.invoice-total--positive]="deltaSign() > 0"
                  >
                    <span>{{ deltaLabel() }}</span>
                    <span class="total-amount">
                      @if (deltaSign() > 0) {
                        +₹{{ formatInr(deltaAmount()) }}
                      } @else {
                        ₹0
                      }
                    </span>
                  </div>
                }
              </section>
            }

            <div class="actions">
              <button mat-button type="button" routerLink="/app/my-bookings">Cancel</button>
              <button
                mat-flat-button
                color="primary"
                type="button"
                (click)="save()"
                [disabled]="!canSave() || saving()"
                [matTooltip]="saveDisabledReason() || ''"
              >
                <mat-icon>save</mat-icon>
                @if (saving()) {
                  Saving…
                } @else if (deltaSign() > 0) {
                  Save & owe +₹{{ formatInr(deltaAmount()) }}
                } @else {
                  Save changes
                }
              </button>
            </div>
          </form>

          @if (saving()) {
            <mat-progress-bar mode="indeterminate" />
          }
        </mat-card>
      }
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
      .context-banner {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        padding: 12px 16px;
        border-radius: 10px;
        background: #eff6ff;
        color: #1e3a8a;
        border: 1px solid #bfdbfe;
        font-size: 13px;
        margin-bottom: 12px;
      }
      .context-banner mat-icon {
        color: #2563eb;
        flex-shrink: 0;
      }
      .context-banner--paid {
        background: #ecfdf5;
        color: #065f46;
        border-color: #a7f3d0;
      }
      .context-banner--paid mat-icon {
        color: #10b981;
      }
      .slot-section {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 16px 18px;
        border-radius: var(--zv-radius-lg, 16px);
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
        background: var(--zv-gradient-brand-soft, rgba(124, 58, 237, 0.08));
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
        background: var(--zv-gradient-brand-soft, rgba(124, 58, 237, 0.08));
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
      }
      .slot-chip-range {
        font-variant-numeric: tabular-nums;
        font-size: 14px;
        font-weight: 600;
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
      .slot-chip.selected {
        background: var(--zv-gradient-brand, #7c3aed);
        color: #fff;
        border-color: transparent;
      }
      .slot-chip.selected .slot-chip-meta {
        color: rgba(255, 255, 255, 0.85);
      }
      .seat-section {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .seat-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }
      .seat-header h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
      }
      .hint {
        margin: 2px 0 0;
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant);
      }
      .spin {
        animation: zv-edit-spin 1s linear infinite;
      }
      @keyframes zv-edit-spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
      .zv-invoice {
        border-radius: var(--zv-radius-lg, 16px);
        border: 1px solid rgba(15, 23, 42, 0.08);
        background: #ffffff;
        box-shadow: var(--zv-shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.05));
        padding: 20px 22px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .invoice-header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
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
      }
      .invoice-warning {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #991b1b;
        padding: 10px 14px;
        border-radius: 10px;
        font-size: 13px;
      }
      .invoice-warning mat-icon {
        color: #dc2626;
      }
      .warning-reason {
        margin-top: 2px;
        opacity: 0.85;
      }
      .invoice-lines {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin: 0;
      }
      .invoice-line {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 14px;
      }
      .invoice-line dt,
      .invoice-line dd {
        margin: 0;
      }
      .invoice-line dd {
        font-variant-numeric: tabular-nums;
      }
      .invoice-total {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding: 14px 16px;
        border-radius: 12px;
        background: #f1f5f9;
        border: 1px solid rgba(15, 23, 42, 0.06);
        font-size: 15px;
        font-weight: 600;
      }
      .invoice-total.invoice-total--positive {
        background: #fff7ed;
        color: #9a3412;
        border-color: #fed7aa;
      }
      .invoice-total.invoice-total--neutral {
        background: #ecfdf5;
        color: #065f46;
        border-color: #a7f3d0;
      }
      .total-amount {
        font-size: 20px;
        font-variant-numeric: tabular-nums;
      }
      .actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }
    `,
  ],
})
export class EditBookingComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(BookingsService);
  private readonly snack = inject(MatSnackBar);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group({
    start_date: [null as Date | null, Validators.required],
    end_date: [null as Date | null, Validators.required],
    access_type: ['timeslot' as AccessType, Validators.required],
    start_time: ['10:00'],
    end_time: ['13:00'],
  });

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly original = signal<BookingResponse | null>(null);
  readonly availability = signal<AvailabilityResponse | null>(null);
  readonly selectedSeat = signal<number | null>(null);
  readonly unavailableSeats = signal<readonly number[]>([]);
  readonly loadingSeats = signal(false);

  private priceReqId = 0;

  readonly availableCount = computed(() => 65 - this.unavailableSeats().length);

  private readonly startDateSig = toSignal(this.form.controls.start_date.valueChanges, {
    initialValue: this.form.controls.start_date.value,
  });
  private readonly endDateSig = toSignal(this.form.controls.end_date.valueChanges, {
    initialValue: this.form.controls.end_date.value,
  });
  private readonly accessSig = toSignal(this.form.controls.access_type.valueChanges, {
    initialValue: this.form.controls.access_type.value,
  });
  private readonly startTimeSignal = toSignal(this.form.controls.start_time.valueChanges, {
    initialValue: this.form.controls.start_time.value,
  });

  readonly hasTimeslot = computed(() => this.accessSig() === 'timeslot');
  readonly seatSelectionReady = computed(() => {
    if (!this.startDateSig() || !this.endDateSig()) return false;
    if (this.hasTimeslot() && !this.startTimeSignal()) return false;
    return true;
  });

  readonly selectedSlot = computed(() => {
    const v = this.startTimeSignal();
    return this.slotOptions.find((s) => s.start === v) ?? null;
  });

  readonly slotOptions: ReadonlyArray<{ start: string; end: string; meta: string }> = (() => {
    const OPEN_HOUR = 9;
    const CLOSE_HOUR = 21;
    const out: { start: string; end: string; meta: string }[] = [];
    for (let h = OPEN_HOUR; h + 3 <= CLOSE_HOUR; h++) {
      const start = `${String(h).padStart(2, '0')}:00`;
      const end = `${String(h + 3).padStart(2, '0')}:00`;
      const meta = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
      out.push({ start, end, meta });
    }
    return out;
  })();

  /** Price delta (new total − already paid). Negative when cheaper. */
  readonly deltaAmount = computed<string>(() => {
    const a = this.availability();
    const orig = this.original();
    if (!a || !orig) return '0';
    const paid = Number(orig.paid_amount);
    const newTotal = Number(a.final_price);
    if (!Number.isFinite(paid) || !Number.isFinite(newTotal)) return '0';
    const d = newTotal - paid;
    return d.toFixed(2);
  });

  readonly deltaSign = computed<number>(() => {
    const a = this.availability();
    const orig = this.original();
    if (!a || !orig) return 0;
    const paid = Number(orig.paid_amount);
    const newTotal = Number(a.final_price);
    if (paid === 0) {
      const origFinal = Number(orig.final_price);
      if (newTotal > origFinal) return 1;
      if (newTotal < origFinal) return -1;
      return 0;
    }
    if (newTotal > paid) return 1;
    if (newTotal < paid) return -1;
    return 0;
  });

  readonly deltaLabel = computed<string>(() => {
    const orig = this.original();
    if (!orig) return '';
    const isPaid = Number(orig.paid_amount) > 0;
    const sign = this.deltaSign();
    if (sign === 0) {
      return isPaid ? 'Nothing more to pay' : 'No price change';
    }
    if (sign > 0) {
      return isPaid ? 'Top-up required' : 'Extra amount to pay';
    }
    return 'Refund note (manual)';
  });

  /** Block the submit button when it's a COMPLETED booking and the new plan costs less. */
  readonly downgradeBlocked = computed<boolean>(() => {
    const orig = this.original();
    const a = this.availability();
    if (!orig || !a) return false;
    if (orig.status !== 'COMPLETED') return false;
    return Number(a.final_price) < Number(orig.paid_amount);
  });

  readonly canSave = computed<boolean>(() => {
    if (this.form.status !== 'VALID') return false;
    if (this.selectedSeat() === null) return false;
    const a = this.availability();
    if (!a || !a.available) return false;
    if (this.downgradeBlocked()) return false;
    return true;
  });

  readonly saveDisabledReason = computed<string>(() => {
    if (this.canSave()) return '';
    if (this.downgradeBlocked()) {
      return 'Paid bookings cannot move to a cheaper plan.';
    }
    const a = this.availability();
    if (a && !a.available) return a.reason ?? 'Seat not available.';
    if (this.selectedSeat() === null) return 'Pick a seat.';
    if (this.form.status !== 'VALID') return 'Complete all required fields.';
    return 'Waiting for price…';
  });

  constructor() {
    const bookingId = this.route.snapshot.paramMap.get('id');
    if (!bookingId) {
      this.router.navigate(['/app/my-bookings']);
      return;
    }
    this.loadBooking(bookingId);
  }

  private loadBooking(id: string): void {
    this.api.getOne(id).subscribe({
      next: (b) => {
        this.original.set(b);
        if (!this.isEditable(b)) {
          this.snack.open(
            `This booking cannot be edited (status: ${b.status}).`,
            'Dismiss',
            { duration: 4000 },
          );
          this.router.navigate(['/app/my-bookings']);
          return;
        }
        this.prefill(b);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.snack.open(err.error?.detail ?? 'Booking not found', 'Dismiss', {
          duration: 4000,
        });
        this.router.navigate(['/app/my-bookings']);
      },
    });
  }

  private isEditable(b: BookingResponse): boolean {
    return b.status === 'RESERVED' || b.status === 'PAYMENT_PENDING' || b.status === 'COMPLETED';
  }

  private prefill(b: BookingResponse): void {
    this.form.patchValue(
      {
        start_date: parseIsoDate(b.start_date),
        end_date: parseIsoDate(b.end_date),
        access_type: b.access_type,
        start_time: toHhmm(b.start_time) ?? '10:00',
        end_time: toHhmm(b.end_time) ?? '13:00',
      },
      { emitEvent: true },
    );
    this.selectedSeat.set(b.seat_id);
  }

  selectSlot(start: string): void {
    this.form.controls.start_time.setValue(start);
    const end = addThreeHours(start);
    if (end) this.form.controls.end_time.setValue(end);
  }

  onSeatPicked(seatId: number): void {
    this.selectedSeat.set(seatId);
    this.availability.set(null);
  }

  /** Reload the seat map as the user tweaks the window, excluding this booking's own slots. */
  private readonly seatMapEffect = effect(() => {
    const ready = this.seatSelectionReady();
    const start = this.startDateSig();
    const end = this.endDateSig();
    const access = this.accessSig();
    const slotStart = this.startTimeSignal();
    const orig = this.original();

    if (!ready || !start || !end || !orig) {
      this.unavailableSeats.set([]);
      return;
    }

    const isTimeslot = access === 'timeslot';
    const startIso = toIsoDate(start);
    const endIso = toIsoDate(end);
    if (!startIso || !endIso) return;

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
        // The seats endpoint can't know about "self-exclusion" — we do it
        // client-side: the current booking's seat is always safe to re-pick
        // because the PUT on the backend checks availability excluding this
        // booking's own SeatBookingDay rows.
        const filtered = res.unavailable_seat_ids.filter((id) => id !== orig.seat_id);
        this.unavailableSeats.set(filtered);
        this.loadingSeats.set(false);
      },
      error: () => {
        this.loadingSeats.set(false);
        this.unavailableSeats.set([]);
      },
    });
  });

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
    this.api.checkAvailability(body).subscribe({
      next: (res) => {
        if (myId !== this.priceReqId) return;
        this.availability.set(res);
      },
      error: () => {
        if (myId !== this.priceReqId) return;
        this.availability.set(null);
      },
    });
  });

  formatInr(value: string | number): string {
    const n = typeof value === 'string' ? parseFloat(value) : value;
    if (!Number.isFinite(n)) return String(value);
    const whole = Math.round(n);
    return whole.toLocaleString('en-IN');
  }

  paidAmountNumber(b: BookingResponse): number {
    const n = Number(b.paid_amount);
    return Number.isFinite(n) ? n : 0;
  }

  save(): void {
    const orig = this.original();
    if (!orig) return;
    const v = this.form.getRawValue();
    const startIso = toIsoDate(v.start_date);
    const endIso = toIsoDate(v.end_date);
    const seat = this.selectedSeat();
    if (!startIso || !endIso || seat === null) return;
    const isTimeslot = v.access_type === 'timeslot';
    const body: CreateBookingRequest = {
      seat_id: seat,
      start_date: startIso,
      end_date: endIso,
      access_type: v.access_type,
      start_time: isTimeslot ? v.start_time : null,
      end_time: isTimeslot ? addThreeHours(v.start_time) : null,
    };

    this.saving.set(true);
    this.api.update(orig.id, body).subscribe({
      next: (updated) => {
        this.saving.set(false);
        const msg = Number(updated.amount_due) > 0
          ? `Saved. Upload proof for the top-up of ₹${updated.amount_due} on My Bookings.`
          : 'Booking updated.';
        this.snack.open(msg, 'Dismiss', { duration: 4500 });
        this.router.navigate(['/app/my-bookings']);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.snack.open(err.error?.detail ?? 'Update failed', 'Dismiss', {
          duration: 4500,
        });
      },
    });
  }
}

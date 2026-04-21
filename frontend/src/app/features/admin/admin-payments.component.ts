import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AdminStudyService } from '../../core/api/admin-study.service';
import { BookingResponse } from '../../core/api/models';

@Component({
  selector: 'zv-admin-payments',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
  ],
  template: `
    <div class="zv-page">
      <div class="zv-flex-row">
        <h2 class="zv-page-title">Pending Payments</h2>
        <span class="zv-spacer"></span>
        <button mat-stroked-button (click)="reload()">
          <mat-icon>refresh</mat-icon>
          Reload
        </button>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      <mat-card>
        @if (bookings().length === 0 && !loading()) {
          <div class="zv-card-section empty">
            <mat-icon>inbox</mat-icon>
            <p>No payments waiting for approval.</p>
          </div>
        } @else {
          <table mat-table [dataSource]="bookings()" class="full-width">
            <ng-container matColumnDef="user">
              <th mat-header-cell *matHeaderCellDef>User</th>
              <td mat-cell *matCellDef="let b" [matTooltip]="b.user_id">
                <div class="zv-user-cell">
                  <div class="zv-user-name">{{ userName(b) }}</div>
                  @if (b.user?.email) {
                    <div class="zv-user-sub">
                      <mat-icon inline>mail</mat-icon>
                      <span>{{ b.user.email }}</span>
                    </div>
                  }
                  @if (b.user?.phone_number) {
                    <div class="zv-user-sub">
                      <mat-icon inline>call</mat-icon>
                      <span>{{ b.user.phone_number }}</span>
                    </div>
                  }
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="seat">
              <th mat-header-cell *matHeaderCellDef>Seat</th>
              <td mat-cell *matCellDef="let b">#{{ b.seat_id }}</td>
            </ng-container>

            <ng-container matColumnDef="dates">
              <th mat-header-cell *matHeaderCellDef>Dates</th>
              <td mat-cell *matCellDef="let b">{{ b.start_date }} → {{ b.end_date }}</td>
            </ng-container>

            <ng-container matColumnDef="access">
              <th mat-header-cell *matHeaderCellDef>Access</th>
              <td mat-cell *matCellDef="let b">
                @if (b.access_type === 'anytime') {
                  ANYTIME
                } @else {
                  {{ b.start_time }}–{{ b.end_time }}
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="price">
              <th mat-header-cell *matHeaderCellDef>Expected</th>
              <td mat-cell *matCellDef="let b">
                <div class="expected-cell">
                  <span class="expected-due">₹{{ b.amount_due }}</span>
                  @if (hasPartialPayment(b)) {
                    <span
                      class="expected-sub"
                      [matTooltip]="
                        'Total ₹' + b.final_price + ' · already credited ₹' + b.paid_amount
                      "
                    >
                      of ₹{{ b.final_price }} · paid ₹{{ b.paid_amount }}
                    </span>
                  } @else {
                    <span class="expected-sub">total ₹{{ b.final_price }}</span>
                  }
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="proof">
              <th mat-header-cell *matHeaderCellDef>Proof</th>
              <td mat-cell *matCellDef="let b">
                @if (b.payment_proof_path) {
                  <button mat-button type="button" (click)="viewPaymentProof(b.id)">
                    <mat-icon>open_in_new</mat-icon>
                    View
                  </button>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="submitted">
              <th mat-header-cell *matHeaderCellDef>Submitted</th>
              <td mat-cell *matCellDef="let b">
                {{ b.updated_at | date: 'short' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>Verify & approve</th>
              <td mat-cell *matCellDef="let b">
                <div class="verify-cell">
                  <mat-form-field appearance="outline" class="amount-field" subscriptSizing="dynamic">
                    <mat-label>Paid amount</mat-label>
                    <span matTextPrefix>₹&nbsp;</span>
                    <input
                      matInput
                      type="number"
                      step="0.01"
                      min="0.01"
                      [ngModel]="amountFor(b)"
                      (ngModelChange)="setAmount(b.id, $event)"
                      [disabled]="busyId() === b.id"
                    />
                  </mat-form-field>
                  <div class="verify-buttons">
                    <button
                      mat-flat-button
                      color="primary"
                      (click)="approve(b)"
                      [disabled]="busyId() === b.id || !amountValid(b)"
                      [matTooltip]="approveTooltip(b)"
                    >
                      <mat-icon>check</mat-icon>
                      @if (amountValid(b) && isPartial(b)) {
                        Partial credit
                      } @else {
                        Approve
                      }
                    </button>
                    <button
                      mat-stroked-button
                      color="warn"
                      (click)="reject(b)"
                      [disabled]="busyId() === b.id"
                    >
                      <mat-icon>close</mat-icon> Reject
                    </button>
                  </div>
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        }
      </mat-card>
    </div>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
      }
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 48px;
        color: var(--mat-sys-on-surface-variant);
      }
      .empty mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
      }
      .expected-cell {
        display: flex;
        flex-direction: column;
        gap: 2px;
        line-height: 1.2;
      }
      .expected-due {
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .expected-sub {
        font-size: 11px;
        color: var(--mat-sys-on-surface-variant);
        font-variant-numeric: tabular-nums;
      }
      .verify-cell {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
      }
      .amount-field {
        width: 130px;
      }
      .verify-buttons {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
    `,
  ],
})
export class AdminPaymentsComponent {
  private readonly api = inject(AdminStudyService);
  private readonly snack = inject(MatSnackBar);

  readonly bookings = signal<BookingResponse[]>([]);
  readonly loading = signal(false);
  readonly busyId = signal<string | null>(null);
  /**
   * Per-booking draft amount the admin typed before pressing Approve. Keyed
   * by booking id; we seed the map lazily in `amountFor` so that freshly
   * loaded rows start at the expected `amount_due`.
   */
  readonly amountDrafts = signal<Record<string, string>>({});
  readonly columns = [
    'user',
    'seat',
    'dates',
    'access',
    'price',
    'proof',
    'submitted',
    'actions',
  ];

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api.pendingPayments().subscribe({
      next: (list) => {
        this.bookings.set(list);
        this.amountDrafts.set({});
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.snack.open(err.error?.detail ?? 'Failed to load', 'Dismiss', {
          duration: 4000,
        });
      },
    });
  }

  viewPaymentProof(bookingId: string): void {
    this.api.downloadPaymentProof(bookingId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
      },
      error: (err: HttpErrorResponse) => {
        this.snack.open(err.error?.detail ?? 'Could not load payment proof', 'Dismiss', {
          duration: 4000,
        });
      },
    });
  }

  userName(b: BookingResponse): string {
    const u = b.user;
    if (u) {
      const parts = [u.given_name, u.family_name].filter((s): s is string => !!s);
      if (parts.length > 0) return parts.join(' ');
      if (u.email) return u.email;
    }
    return b.user_id.length > 12
      ? `${b.user_id.slice(0, 6)}…${b.user_id.slice(-4)}`
      : b.user_id;
  }

  /** True when the booking has already been credited for part of its price. */
  hasPartialPayment(b: BookingResponse): boolean {
    return Number(b.paid_amount) > 0;
  }

  /**
   * Current draft amount for a row. Defaults to the full outstanding due so
   * the admin can one-click approve a clean payment.
   */
  amountFor(b: BookingResponse): string {
    const draft = this.amountDrafts()[b.id];
    return draft ?? b.amount_due;
  }

  setAmount(bookingId: string, value: string | number): void {
    const str = typeof value === 'number' ? String(value) : value;
    this.amountDrafts.update((m) => ({ ...m, [bookingId]: str }));
  }

  amountValid(b: BookingResponse): boolean {
    const n = Number(this.amountFor(b));
    return Number.isFinite(n) && n > 0;
  }

  /** True when the admin's entered amount won't fully settle the booking. */
  isPartial(b: BookingResponse): boolean {
    const entered = Number(this.amountFor(b));
    const due = Number(b.amount_due);
    return Number.isFinite(entered) && entered > 0 && entered < due;
  }

  approveTooltip(b: BookingResponse): string {
    if (!this.amountValid(b)) return 'Enter the amount you see in the screenshot.';
    if (this.isPartial(b)) {
      return 'Credit this partial amount. Booking returns to RESERVED so the user can pay the rest.';
    }
    const entered = Number(this.amountFor(b));
    const due = Number(b.amount_due);
    if (entered > due) return 'Overpayment — still approved, amount_due clamps at 0.';
    return 'Credit the full amount and mark the booking COMPLETED.';
  }

  approve(b: BookingResponse): void {
    if (!this.amountValid(b)) return;
    const raw = this.amountFor(b);
    // Only send a body if the admin deviated from the default. This keeps the
    // simple case (exact match) as a one-field POST and makes test
    // expectations around "default credit" explicit.
    const amount = raw !== b.amount_due ? raw : undefined;

    this.busyId.set(b.id);
    this.api.approvePayment(b.id, amount).subscribe({
      next: (updated) => {
        this.busyId.set(null);
        if (updated.status === 'COMPLETED') {
          this.snack.open(`Approved · ₹${updated.paid_amount} credited`, 'Dismiss', {
            duration: 3000,
          });
          this.bookings.update((list) => list.filter((x) => x.id !== b.id));
        } else {
          // Partial credit — booking has moved back to RESERVED and left the
          // pending queue. We remove it from the table and nudge the admin
          // that the user still owes the balance.
          this.snack.open(
            `Partial ₹${amount ?? raw} credited. User still owes ₹${updated.amount_due}.`,
            'Dismiss',
            { duration: 5000 },
          );
          this.bookings.update((list) => list.filter((x) => x.id !== b.id));
        }
      },
      error: (err: HttpErrorResponse) => {
        this.busyId.set(null);
        this.snack.open(err.error?.detail ?? 'Approval failed', 'Dismiss', {
          duration: 4000,
        });
      },
    });
  }

  reject(b: BookingResponse): void {
    this.busyId.set(b.id);
    this.api.rejectPayment(b.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.snack.open('Payment rejected, seat released', 'Dismiss', { duration: 2500 });
        this.bookings.update((list) => list.filter((x) => x.id !== b.id));
      },
      error: (err: HttpErrorResponse) => {
        this.busyId.set(null);
        this.snack.open(err.error?.detail ?? 'Rejection failed', 'Dismiss', {
          duration: 4000,
        });
      },
    });
  }
}

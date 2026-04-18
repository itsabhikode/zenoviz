import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { BookingsService } from '../../core/api/bookings.service';
import { BookingResponse, PaymentSettingsResponse } from '../../core/api/models';

@Component({
  selector: 'zv-my-bookings',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
  ],
  template: `
    <div class="zv-page">
      <div class="zv-flex-row">
        <h2 class="zv-page-title">My Bookings</h2>
        <span class="zv-spacer"></span>
        <button mat-flat-button color="primary" routerLink="/app/book">
          <mat-icon>add</mat-icon>
          New booking
        </button>
      </div>

      @if (!loading() && bookings().length > 0) {
        <div class="zv-stats-grid">
          <div class="zv-stat-card">
            <div class="zv-stat-label">Total</div>
            <div class="zv-stat-value">{{ bookings().length }}</div>
          </div>
          <div class="zv-stat-card zv-stat-card--reserved">
            <div class="zv-stat-label">Reserved</div>
            <div class="zv-stat-value">{{ statCount('RESERVED') }}</div>
          </div>
          <div class="zv-stat-card zv-stat-card--pending">
            <div class="zv-stat-label">Pending</div>
            <div class="zv-stat-value">{{ statCount('PAYMENT_PENDING') }}</div>
          </div>
          <div class="zv-stat-card zv-stat-card--completed">
            <div class="zv-stat-label">Completed</div>
            <div class="zv-stat-value">{{ statCount('COMPLETED') }}</div>
          </div>
          <div class="zv-stat-card zv-stat-card--expired">
            <div class="zv-stat-label">Expired</div>
            <div class="zv-stat-value">{{ statCount('EXPIRED') }}</div>
          </div>
          <div class="zv-stat-card zv-stat-card--rejected">
            <div class="zv-stat-label">Rejected</div>
            <div class="zv-stat-value">{{ statCount('REJECTED') }}</div>
          </div>
        </div>
      }

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (showPaymentCard()) {
        <mat-card class="payment-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>qr_code_2</mat-icon>
            <mat-card-title>Pay for your reservation</mat-card-title>
            <mat-card-subtitle>
              Scan the QR below, then upload the payment screenshot for the matching
              booking.
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="pay-row">
              @if (qrUrl()) {
                <img [src]="qrUrl()!" alt="Payment QR" class="qr-img" />
              } @else {
                <div class="qr-missing">
                  <mat-icon>qr_code_2</mat-icon>
                  <span>Admin hasn't uploaded a payment QR yet.</span>
                </div>
              }
              <div class="pay-details">
                @if (settings()?.payee_name) {
                  <div><strong>Payee:</strong> {{ settings()!.payee_name }}</div>
                }
                @if (settings()?.upi_vpa) {
                  <div>
                    <strong>UPI:</strong>
                    <code>{{ settings()!.upi_vpa }}</code>
                    <button
                      mat-icon-button
                      (click)="copyUpi()"
                      matTooltip="Copy UPI ID"
                      aria-label="Copy UPI ID"
                    >
                      <mat-icon>content_copy</mat-icon>
                    </button>
                  </div>
                }
                @if (settings()?.instructions) {
                  <p class="instructions">{{ settings()!.instructions }}</p>
                }
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      }

      @if (!loading() && bookings().length === 0) {
        <mat-card>
          <div class="zv-card-section empty">
            <mat-icon>event_busy</mat-icon>
            <p>You haven't booked any seats yet.</p>
            <button mat-flat-button color="primary" routerLink="/app/book">Book a seat</button>
          </div>
        </mat-card>
      }

      @if (bookings().length > 0) {
        <mat-card>
          <table mat-table [dataSource]="bookings()" class="full-width">
            <ng-container matColumnDef="seat">
              <th mat-header-cell *matHeaderCellDef>Seat</th>
              <td mat-cell *matCellDef="let b">#{{ b.seat_id }}</td>
            </ng-container>

            <ng-container matColumnDef="dates">
              <th mat-header-cell *matHeaderCellDef>Dates</th>
              <td mat-cell *matCellDef="let b">
                {{ b.start_date }} → {{ b.end_date }}
              </td>
            </ng-container>

            <ng-container matColumnDef="access">
              <th mat-header-cell *matHeaderCellDef>Access</th>
              <td mat-cell *matCellDef="let b">
                @if (b.access_type === 'anytime') {
                  <mat-chip>ANYTIME</mat-chip>
                } @else {
                  <mat-chip>{{ b.start_time }}–{{ b.end_time }}</mat-chip>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="category">
              <th mat-header-cell *matHeaderCellDef>Category</th>
              <td mat-cell *matCellDef="let b">{{ b.category }}</td>
            </ng-container>

            <ng-container matColumnDef="price">
              <th mat-header-cell *matHeaderCellDef>Price</th>
              <td mat-cell *matCellDef="let b">
                <div class="price-cell">
                  <span class="price-total">₹{{ b.final_price }}</span>
                  @if (hasTopup(b)) {
                    <span
                      class="price-due"
                      [matTooltip]="
                        'Already paid ₹' + b.paid_amount + ' — top-up needed for the upgrade'
                      "
                    >
                      ₹{{ b.amount_due }} due
                    </span>
                  }
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let b">
                <span class="zv-status-pill" [ngClass]="statusPillClass(b.status)">
                  {{ statusLabel(b.status) }}
                </span>
                @if (b.status === 'RESERVED' && b.reserved_until) {
                  <span class="deadline" [matTooltip]="'Reserved until ' + b.reserved_until">
                    · expires {{ b.reserved_until | date: 'short' }}
                  </span>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>Actions</th>
              <td mat-cell *matCellDef="let b">
                <div class="actions-cell">
                  @if (b.status === 'RESERVED') {
                    <input
                      #fileInput
                      type="file"
                      hidden
                      accept="image/*,.pdf"
                      (change)="upload(b, fileInput)"
                    />
                    <button
                      mat-stroked-button
                      color="primary"
                      (click)="fileInput.click()"
                      [disabled]="uploadingId() === b.id"
                    >
                      <mat-icon>upload_file</mat-icon>
                      {{
                        uploadingId() === b.id
                          ? 'Uploading…'
                          : hasTopup(b)
                            ? 'Upload top-up'
                            : 'Upload payment'
                      }}
                    </button>
                  }
                  @if (b.status === 'PAYMENT_PENDING') {
                    <span class="muted">Awaiting admin approval</span>
                  }
                  @if (canEdit(b)) {
                    <button
                      mat-button
                      color="primary"
                      [routerLink]="['/app/bookings', b.id, 'edit']"
                      [matTooltip]="editTooltip(b)"
                    >
                      <mat-icon>edit</mat-icon>
                      Edit
                    </button>
                  }
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </mat-card>
      }
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
      .deadline {
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant);
        margin-left: 8px;
      }
      .muted {
        color: var(--mat-sys-on-surface-variant);
        font-size: 13px;
      }
      .payment-card {
        margin-bottom: 16px;
        border-left: 4px solid var(--mat-sys-tertiary);
      }
      .pay-row {
        display: flex;
        gap: 24px;
        align-items: center;
        flex-wrap: wrap;
      }
      .qr-img {
        width: 200px;
        height: 200px;
        object-fit: contain;
        background: white;
        padding: 8px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }
      .qr-missing {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        width: 200px;
        height: 200px;
        justify-content: center;
        color: var(--mat-sys-on-surface-variant);
        background: var(--mat-sys-surface-container);
        border-radius: 8px;
        text-align: center;
        padding: 12px;
        font-size: 12px;
      }
      .qr-missing mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
      }
      .pay-details {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 14px;
      }
      .pay-details code {
        background: var(--mat-sys-surface-container);
        padding: 2px 6px;
        border-radius: 4px;
      }
      .instructions {
        color: var(--mat-sys-on-surface-variant);
        font-size: 13px;
        max-width: 420px;
        white-space: pre-wrap;
      }
      .price-cell {
        display: flex;
        flex-direction: column;
        gap: 2px;
        align-items: flex-start;
      }
      .price-total {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      .price-due {
        font-size: 11px;
        font-weight: 600;
        color: var(--zv-status-pending-fg, #b45309);
        background: rgba(245, 158, 11, 0.12);
        padding: 1px 8px;
        border-radius: 999px;
      }
      .actions-cell {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
      }
    `,
  ],
})
export class MyBookingsComponent implements OnDestroy {
  private readonly api = inject(BookingsService);
  private readonly snack = inject(MatSnackBar);

  readonly bookings = signal<BookingResponse[]>([]);
  readonly loading = signal(true);
  readonly uploadingId = signal<string | null>(null);
  readonly settings = signal<PaymentSettingsResponse | null>(null);
  readonly qrUrl = signal<string | null>(null);
  readonly columns = ['seat', 'dates', 'access', 'category', 'price', 'status', 'actions'];

  readonly needsPayment = computed(() =>
    this.bookings().some(
      (b) => b.status === 'RESERVED' || b.status === 'PAYMENT_PENDING',
    ),
  );

  statCount(status: BookingResponse['status']): number {
    return this.bookings().filter((b) => b.status === status).length;
  }
  readonly showPaymentCard = computed(() => {
    if (!this.needsPayment()) return false;
    const s = this.settings();
    return !!s && (s.has_qr || !!s.upi_vpa || !!s.payee_name || !!s.instructions);
  });

  constructor() {
    this.reload();
  }

  ngOnDestroy(): void {
    this.revokeQr();
  }

  reload(): void {
    this.loading.set(true);
    this.api.mine().subscribe({
      next: (data) => {
        this.bookings.set(data);
        this.loading.set(false);
        this.loadPaymentSettings();
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.snack.open(err.error?.detail ?? 'Failed to load bookings', 'Dismiss', {
          duration: 4000,
        });
      },
    });
  }

  private loadPaymentSettings(): void {
    if (!this.needsPayment()) return;
    this.api.paymentSettings().subscribe({
      next: (s) => {
        this.settings.set(s);
        if (s.has_qr) this.loadQr();
      },
      error: () => void 0,
    });
  }

  private loadQr(): void {
    this.api.paymentQrBlob().subscribe({
      next: (blob) => {
        this.revokeQr();
        this.qrUrl.set(URL.createObjectURL(blob));
      },
      error: () => this.revokeQr(),
    });
  }

  private revokeQr(): void {
    const url = this.qrUrl();
    if (url) URL.revokeObjectURL(url);
    this.qrUrl.set(null);
  }

  copyUpi(): void {
    const vpa = this.settings()?.upi_vpa;
    if (!vpa) return;
    navigator.clipboard.writeText(vpa).then(
      () => this.snack.open('UPI ID copied', 'Dismiss', { duration: 2000 }),
      () => this.snack.open('Copy failed', 'Dismiss', { duration: 2000 }),
    );
  }

  upload(b: BookingResponse, input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploadingId.set(b.id);
    this.api.uploadPaymentProof(b.id, file).subscribe({
      next: (updated) => {
        this.uploadingId.set(null);
        this.bookings.update((list) =>
          list.map((x) => (x.id === updated.id ? updated : x)),
        );
        this.snack.open('Payment proof uploaded', 'Dismiss', { duration: 3000 });
      },
      error: (err: HttpErrorResponse) => {
        this.uploadingId.set(null);
        this.snack.open(err.error?.detail ?? 'Upload failed', 'Dismiss', {
          duration: 4000,
        });
      },
    });
  }

  /**
   * Map a BookingStatus to the shared `zv-status-pill--*` modifier so every
   * status looks identical across the app (list cards, tables, details).
   */
  statusPillClass(status: string): string {
    switch (status) {
      case 'RESERVED':
        return 'zv-status-pill--reserved';
      case 'PAYMENT_PENDING':
        return 'zv-status-pill--pending';
      case 'COMPLETED':
        return 'zv-status-pill--completed';
      case 'EXPIRED':
        return 'zv-status-pill--expired';
      case 'REJECTED':
        return 'zv-status-pill--rejected';
      default:
        return '';
    }
  }

  /** Human-friendly label for a BookingStatus. */
  statusLabel(status: string): string {
    return status === 'PAYMENT_PENDING' ? 'PENDING' : status;
  }

  /** Only active bookings are editable; EXPIRED/REJECTED are read-only history. */
  canEdit(b: BookingResponse): boolean {
    return b.status === 'RESERVED' || b.status === 'PAYMENT_PENDING' || b.status === 'COMPLETED';
  }

  editTooltip(b: BookingResponse): string {
    if (b.status === 'COMPLETED') {
      return 'Edit this paid booking. Upgrades require a top-up; cheaper plans are blocked.';
    }
    if (b.status === 'PAYMENT_PENDING') {
      return 'Editing will discard the current proof and return the booking to RESERVED.';
    }
    return 'Change seat, dates, or time slot before paying.';
  }

  /**
   * True when the booking has been partially paid but now owes more — happens
   * when a COMPLETED booking was edited up to a pricier plan.
   */
  hasTopup(b: BookingResponse): boolean {
    return Number(b.paid_amount) > 0 && Number(b.amount_due) > 0;
  }
}

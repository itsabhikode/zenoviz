import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { BookingsService } from '../../core/api/bookings.service';
import { BookingResponse, PaymentSettingsResponse } from '../../core/api/models';
import { UserBookingPolicyService } from '../../core/booking/user-booking-policy.service';
import { formatNprAmount, NPR_PREFIX, nprText } from '../../core/currency';

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
    MatTooltipModule,
  ],
  template: `
    <div class="zv-page my-bookings">
      <header class="page-head">
        <div class="page-head__titles">
          <h2 class="zv-page-title">My bookings</h2>
          <p class="page-head__sub">
            Current and past reservations. Upload payment and edit from the buttons on each
            card.
          </p>
        </div>
        <div class="page-head__cta">
          @if (!bookingPolicy.blocksNewBooking()) {
            <button mat-flat-button color="primary" class="new-btn" routerLink="/app/book">
              <mat-icon>add</mat-icon>
              New booking
            </button>
          } @else {
            <p class="policy-hint">
              One seat at a time — use <strong>Edit</strong> on your reservation below.
            </p>
          }
        </div>
      </header>

      <div class="my-bookings__main">
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (showPaymentCard()) {
        <mat-card class="payment-card">
          <mat-card-header>
            <mat-icon mat-card-avatar class="payment-avatar">qr_code_2</mat-icon>
            <mat-card-title>Pay for your reservation</mat-card-title>
            <mat-card-subtitle>
              Scan the payment QR, pay as instructed, then upload the screenshot on your booking
              card below.
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
                  <div class="payment-id-row">
                    <strong>Payment:</strong>
                    <code>{{ settings()!.upi_vpa }}</code>
                    <button
                      mat-icon-button
                      type="button"
                      (click)="copyPaymentId()"
                      matTooltip="Copy payment details"
                      aria-label="Copy payment details"
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
          <div class="empty">
            <mat-icon>event_seat</mat-icon>
            <p>You haven't booked a seat yet.</p>
            @if (!bookingPolicy.blocksNewBooking()) {
              <button mat-flat-button color="primary" routerLink="/app/book">Book a seat</button>
            }
          </div>
        </mat-card>
      }

      @if (bookings().length > 0) {
        <section class="booking-list" aria-label="Your bookings">
          @for (b of sortedBookings(); track b.id) {
            <mat-card class="booking-card">
              <div class="booking-card__top">
                <span class="zv-status-pill" [ngClass]="statusPillClass(b.status)">
                  {{ statusLabel(b.status) }}
                </span>
                @if (b.status === 'RESERVED' && b.reserved_until) {
                  <span class="expires" [matTooltip]="'Reserved until ' + b.reserved_until">
                    <mat-icon class="expires-icon">schedule</mat-icon>
                    Pay by {{ b.reserved_until | date: 'short' }}
                  </span>
                }
              </div>

              <!-- Primary actions: always visible, thumb-friendly on mobile -->
              <div class="booking-card__actions">
                <input
                  #fileInput
                  type="file"
                  hidden
                  accept="image/*,.pdf"
                  (change)="upload(b, fileInput)"
                />
                @if (b.status === 'RESERVED') {
                  <button
                    mat-flat-button
                    color="primary"
                    type="button"
                    class="action-primary"
                    (click)="fileInput.click()"
                    [disabled]="uploadingId() === b.id"
                  >
                    <mat-icon>upload_file</mat-icon>
                    {{
                      uploadingId() === b.id
                        ? 'Uploading…'
                        : hasTopup(b)
                          ? 'Upload top-up proof'
                          : 'Upload payment proof'
                    }}
                  </button>
                }
                @if (b.status === 'PAYMENT_PENDING') {
                  <div class="awaiting-banner" role="status">
                    <mat-icon>hourglass_empty</mat-icon>
                    <span>Awaiting admin approval — you can still edit below if needed.</span>
                  </div>
                }
                @if (canEdit(b)) {
                  <a
                    mat-stroked-button
                    color="primary"
                    class="action-edit"
                    [routerLink]="['/app/bookings', b.id, 'edit']"
                    [matTooltip]="editTooltip(b)"
                  >
                    <mat-icon>edit</mat-icon>
                    Edit booking
                  </a>
                }
              </div>

              <dl class="detail-grid">
                <div class="detail-row">
                  <dt>Seat</dt>
                  <dd>#{{ b.seat_id }}</dd>
                </div>
                <div class="detail-row">
                  <dt>Dates</dt>
                  <dd>{{ b.start_date }} → {{ b.end_date }}</dd>
                </div>
                <div class="detail-row">
                  <dt>Access</dt>
                  <dd>
                    @if (b.access_type === 'anytime') {
                      <mat-chip class="access-chip">Anytime</mat-chip>
                    } @else {
                      <mat-chip class="access-chip">{{ b.start_time }} – {{ b.end_time }}</mat-chip>
                    }
                  </dd>
                </div>
                <div class="detail-row">
                  <dt>Category</dt>
                  <dd>{{ b.category }}</dd>
                </div>
                <div class="detail-row">
                  <dt>Price</dt>
                  <dd class="price-block">
                    <span class="price-total">{{ nprPrefix }} {{ formatNpr(b.final_price) }}</span>
                    @if (hasTopup(b)) {
                      <span
                        class="price-due"
                        [matTooltip]="topupTooltip(b)"
                      >
                        {{ nprPrefix }} {{ formatNpr(b.amount_due) }} due
                      </span>
                    }
                  </dd>
                </div>
              </dl>
            </mat-card>
          }
        </section>
      }
      </div>
    </div>
  `,
  styles: [
    `
      .my-bookings {
        display: flex;
        flex-direction: column;
        gap: 0;
        max-width: 560px;
        margin-left: auto;
        margin-right: auto;
      }
      @media (min-width: 960px) {
        .my-bookings {
          max-width: min(640px, 100%);
        }
      }

      .my-bookings__main {
        display: flex;
        flex-direction: column;
        gap: 0;
        min-width: 0;
      }

      .page-head {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-bottom: 20px;
      }
      @media (max-width: 479px) {
        .page-head {
          display: contents;
        }
        .page-head__titles {
          order: 0;
          margin-bottom: 20px;
        }
        .my-bookings__main {
          order: 1;
        }
        .page-head__cta {
          order: 2;
          margin-top: 4px;
        }
      }
      @media (min-width: 480px) {
        .page-head {
          flex-direction: row;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
      }
      .page-head__titles {
        min-width: 0;
      }
      .page-head__sub {
        margin: 6px 0 0 0;
        font-size: 14px;
        line-height: 1.45;
        color: var(--mat-sys-on-surface-variant);
      }
      .page-head__cta {
        flex-shrink: 0;
        width: 100%;
      }
      @media (min-width: 480px) {
        .page-head__cta {
          width: auto;
          align-self: center;
        }
      }
      .new-btn {
        width: 100%;
      }
      @media (min-width: 480px) {
        .new-btn {
          width: auto;
        }
      }
      .policy-hint {
        margin: 0;
        flex-shrink: 1;
        max-width: 100%;
        font-size: 14px;
        line-height: 1.45;
        color: var(--mat-sys-on-surface-variant);
      }
      @media (min-width: 480px) {
        .policy-hint {
          max-width: 280px;
        }
      }

      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        padding: 40px 20px;
        text-align: center;
        color: var(--mat-sys-on-surface-variant);
      }
      .empty mat-icon {
        font-size: 56px;
        width: 56px;
        height: 56px;
        opacity: 0.7;
      }

      .payment-card {
        margin-bottom: 20px;
        border-left: 4px solid var(--mat-sys-tertiary);
      }
      .payment-avatar {
        background: rgba(124, 58, 237, 0.12);
        color: #7c3aed;
      }
      .pay-row {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
      }
      @media (min-width: 600px) {
        .pay-row {
          flex-direction: row;
          align-items: flex-start;
          justify-content: flex-start;
        }
      }
      .qr-img {
        width: min(220px, 70vw);
        height: min(220px, 70vw);
        max-width: 100%;
        object-fit: contain;
        background: #fff;
        padding: 10px;
        border-radius: 12px;
        box-shadow: var(--zv-shadow-sm);
      }
      .qr-missing {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        width: min(220px, 70vw);
        aspect-ratio: 1;
        max-width: 100%;
        justify-content: center;
        color: var(--mat-sys-on-surface-variant);
        background: var(--mat-sys-surface-container);
        border-radius: 12px;
        text-align: center;
        padding: 16px;
        font-size: 13px;
      }
      .qr-missing mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
      }
      .pay-details {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-size: 14px;
      }
      .payment-id-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
      }
      .pay-details code {
        background: var(--mat-sys-surface-container);
        padding: 4px 8px;
        border-radius: 6px;
        word-break: break-all;
      }
      .instructions {
        color: var(--mat-sys-on-surface-variant);
        font-size: 13px;
        white-space: pre-wrap;
        margin: 0;
      }

      .booking-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .booking-card {
        overflow: visible;
        padding: 8px 14px 18px;
        box-sizing: border-box;
      }
      @media (min-width: 600px) {
        .booking-card {
          padding: 4px 4px 12px;
        }
      }
      .booking-card__top {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        margin-bottom: 16px;
      }
      .expires {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant);
      }
      .expires-icon {
        font-size: 16px !important;
        width: 16px !important;
        height: 16px !important;
        vertical-align: middle;
      }

      .booking-card__actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 20px;
      }
      .action-primary,
      .action-edit {
        width: 100%;
        min-height: 48px;
        font-size: 15px !important;
        justify-content: center;
      }
      .action-edit {
        text-decoration: none;
      }

      .awaiting-banner {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 14px;
        border-radius: var(--zv-radius-md);
        background: rgba(37, 99, 235, 0.08);
        border: 1px solid rgba(37, 99, 235, 0.2);
        font-size: 13px;
        line-height: 1.4;
        color: var(--mat-sys-on-surface);
      }
      .awaiting-banner mat-icon {
        flex-shrink: 0;
        margin-top: 2px;
        color: var(--mat-sys-primary);
      }

      .detail-grid {
        margin: 0;
        padding: 16px 4px 0;
        border-top: 1px solid rgba(15, 23, 42, 0.08);
        display: flex;
        flex-direction: column;
        gap: 0;
      }
      @media (min-width: 480px) {
        .detail-grid {
          padding: 16px 0 0 0;
        }
      }
      .detail-row {
        display: grid;
        grid-template-columns: minmax(100px, 36%) 1fr;
        gap: 12px;
        padding: 12px 6px;
        border-bottom: 1px solid rgba(15, 23, 42, 0.05);
      }
      .detail-row:last-of-type {
        border-bottom: none;
        padding-bottom: 0;
      }
      dt {
        margin: 0;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--mat-sys-on-surface-variant);
        align-self: start;
        padding-top: 2px;
      }
      dd {
        margin: 0;
        font-size: 15px;
        font-weight: 500;
        color: var(--mat-sys-on-surface);
        word-break: break-word;
      }
      .access-chip {
        font-size: 12px !important;
        min-height: 28px;
      }
      .price-block {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }
      .price-total {
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        font-size: 17px;
      }
      .price-due {
        font-size: 11px;
        font-weight: 600;
        color: var(--zv-status-pending-fg, #b45309);
        background: rgba(245, 158, 11, 0.14);
        padding: 4px 10px;
        border-radius: 999px;
      }
    `,
  ],
})
export class MyBookingsComponent implements OnInit, OnDestroy {
  private readonly api = inject(BookingsService);
  private readonly snack = inject(MatSnackBar);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly bookingPolicy = inject(UserBookingPolicyService);

  /** Nepalese Rupee label for templates */
  readonly nprPrefix = NPR_PREFIX;
  formatNpr(value: string | number): string {
    return formatNprAmount(value);
  }
  topupTooltip(b: BookingResponse): string {
    return `Already paid ${nprText(b.paid_amount)} — top-up owed for upgrade`;
  }

  readonly bookings = signal<BookingResponse[]>([]);
  readonly loading = signal(true);
  readonly uploadingId = signal<string | null>(null);
  readonly settings = signal<PaymentSettingsResponse | null>(null);
  readonly qrUrl = signal<string | null>(null);

  readonly sortedBookings = computed(() => {
    const priority: Record<string, number> = {
      RESERVED: 0,
      PAYMENT_PENDING: 1,
      COMPLETED: 2,
      EXPIRED: 3,
      REJECTED: 4,
    };
    return [...this.bookings()].sort((a, b) => {
      const pa = priority[a.status] ?? 99;
      const pb = priority[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      return (
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime() ||
        b.id.localeCompare(a.id)
      );
    });
  });

  readonly needsPayment = computed(() =>
    this.bookings().some(
      (b) => b.status === 'RESERVED' || b.status === 'PAYMENT_PENDING',
    ),
  );

  readonly showPaymentCard = computed(() => {
    if (!this.needsPayment()) return false;
    const s = this.settings();
    return !!s && (s.has_qr || !!s.upi_vpa || !!s.payee_name || !!s.instructions);
  });

  constructor() {
    this.reload();
  }

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('notice') !== 'one-booking') {
      return;
    }
    this.snack.open(
      'You already have an active booking. Use Edit on your reservation — a second booking is not allowed.',
      'Dismiss',
      { duration: 5500 },
    );
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { notice: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  ngOnDestroy(): void {
    this.revokeQr();
  }

  reload(): void {
    this.loading.set(true);
    this.api.mine().subscribe({
      next: (data) => {
        this.bookings.set(data);
        this.bookingPolicy.setFromBookings(data);
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
        this.applyQrFromSettings(s);
      },
      error: () => void 0,
    });
  }

  private applyQrFromSettings(s: PaymentSettingsResponse): void {
    this.revokeQr();
    if (!s.has_qr) return;
    const pub = s.qr_public_url?.trim();
    if (pub) {
      const sep = pub.includes('?') ? '&' : '?';
      const bust = s.updated_at ? `${sep}v=${encodeURIComponent(s.updated_at)}` : '';
      this.qrUrl.set(pub + bust);
      return;
    }
    this.loadQrBlob();
  }

  private loadQrBlob(): void {
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
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    this.qrUrl.set(null);
  }

  copyPaymentId(): void {
    const vpa = this.settings()?.upi_vpa;
    if (!vpa) return;
    navigator.clipboard.writeText(vpa).then(
      () => this.snack.open('Payment details copied', 'Dismiss', { duration: 2000 }),
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

  statusLabel(status: string): string {
    return status === 'PAYMENT_PENDING' ? 'PENDING' : status;
  }

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

  hasTopup(b: BookingResponse): boolean {
    return Number(b.paid_amount) > 0 && Number(b.amount_due) > 0;
  }
}

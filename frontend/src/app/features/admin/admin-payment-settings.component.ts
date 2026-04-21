import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AdminStudyService } from '../../core/api/admin-study.service';
import { PaymentSettingsResponse } from '../../core/api/models';

@Component({
  selector: 'zv-admin-payment-settings',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="zv-page">
      <div class="zv-flex-row">
        <h2 class="zv-page-title">Payment QR</h2>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      <mat-card>
        <mat-card-header>
          <mat-card-title>Payment QR image</mat-card-title>
          <mat-card-subtitle>
            Users see this QR on their bookings page to pay.
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="qr-area">
            @if (qrUrl()) {
              <img [src]="qrUrl()!" alt="Payment QR" class="qr-img" />
            } @else {
              <div class="qr-empty">
                <mat-icon>qr_code_2</mat-icon>
                <span>No QR uploaded yet</span>
              </div>
            }
          </div>

          <input
            #qrInput
            type="file"
            hidden
            accept="image/png,image/jpeg,image/webp"
            (change)="onQrSelected(qrInput)"
          />

          <div class="row">
            <button
              mat-stroked-button
              color="primary"
              (click)="qrInput.click()"
              [disabled]="uploading()"
            >
              <mat-icon>upload</mat-icon>
              {{ uploading() ? 'Uploading…' : qrUrl() ? 'Replace QR' : 'Upload QR' }}
            </button>
            @if (settings()?.updated_at) {
              <span class="muted">
                Last updated {{ settings()!.updated_at | date: 'medium' }}
              </span>
            }
          </div>

          <p class="hint">
            PNG, JPG, or WebP — up to 5 MB. Square images scan best.
          </p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .qr-area {
        display: grid;
        place-items: center;
        min-height: 280px;
        padding: 16px;
        background: var(--mat-sys-surface-container);
        border-radius: 12px;
        margin-bottom: 16px;
      }
      .qr-img {
        max-width: 280px;
        max-height: 280px;
        border-radius: 8px;
        background: white;
        padding: 12px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
      }
      .qr-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        color: var(--mat-sys-on-surface-variant);
      }
      .qr-empty mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .muted {
        color: var(--mat-sys-on-surface-variant);
        font-size: 13px;
      }
      .hint {
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant);
        margin-top: 8px;
      }
    `,
  ],
})
export class AdminPaymentSettingsComponent implements OnInit, OnDestroy {
  private readonly api = inject(AdminStudyService);
  private readonly snack = inject(MatSnackBar);

  readonly loading = signal(true);
  readonly uploading = signal(false);
  readonly settings = signal<PaymentSettingsResponse | null>(null);
  readonly qrUrl = signal<string | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  ngOnDestroy(): void {
    this.revokeQr();
  }

  reload(): void {
    this.loading.set(true);
    this.api.getPaymentSettings().subscribe({
      next: (s) => {
        this.settings.set(s);
        this.loading.set(false);
        this.applyQrFromSettings(s);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.snack.open(
          err.error?.detail ?? 'Failed to load payment settings',
          'Dismiss',
          { duration: 4000 },
        );
      },
    });
  }

  onQrSelected(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploading.set(true);
    this.api.uploadPaymentQr(file).subscribe({
      next: (s) => {
        this.settings.set(s);
        this.uploading.set(false);
        this.applyQrFromSettings(s);
        this.snack.open('Payment QR updated', 'Dismiss', { duration: 3000 });
      },
      error: (err: HttpErrorResponse) => {
        this.uploading.set(false);
        this.snack.open(err.error?.detail ?? 'Upload failed', 'Dismiss', {
          duration: 4000,
        });
      },
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
}

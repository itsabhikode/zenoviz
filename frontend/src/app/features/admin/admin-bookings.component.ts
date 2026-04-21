import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AdminStudyService } from '../../core/api/admin-study.service';
import { BookingResponse, BookingStatus } from '../../core/api/models';

type StatusFilter = BookingStatus | 'ALL';

interface StatusOption {
  value: StatusFilter;
  label: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'PAYMENT_PENDING', label: 'Payment pending' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'REJECTED', label: 'Rejected' },
];

@Component({
  selector: 'zv-admin-bookings',
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
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
  ],
  template: `
    <div class="zv-page">
      <div class="zv-flex-row">
        <h2 class="zv-page-title">All Bookings</h2>
        <span class="zv-spacer"></span>
        <button mat-stroked-button (click)="reload()">
          <mat-icon>refresh</mat-icon>
          Reload
        </button>
      </div>

      <div class="toolbar">
        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Status</mat-label>
          <mat-select [(ngModel)]="statusFilter" (selectionChange)="reload()">
            @for (opt of statusOptions; track opt.value) {
              <mat-option [value]="opt.value">{{ opt.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Search</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input
            matInput
            type="text"
            placeholder="name, email, phone or seat"
            [(ngModel)]="searchTerm"
          />
        </mat-form-field>
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

      <mat-card>
        @if (filtered().length === 0 && !loading()) {
          <div class="zv-card-section empty">
            <mat-icon>inbox</mat-icon>
            <p>No bookings match the current filter.</p>
          </div>
        } @else {
          <div class="zv-scroll-x table-scroll">
          <table mat-table [dataSource]="filtered()" class="full-width">
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
                  @if (!b.user) {
                    <div class="zv-user-sub zv-mono">{{ shortId(b.user_id) }}</div>
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
              <td mat-cell *matCellDef="let b">₹{{ b.final_price }}</td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let b">
                <span class="zv-status-pill" [ngClass]="statusPillClass(b.status)">
                  {{ statusLabel(b.status) }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="created">
              <th mat-header-cell *matHeaderCellDef>Created</th>
              <td mat-cell *matCellDef="let b">
                {{ b.created_at | date: 'short' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>Actions</th>
              <td mat-cell *matCellDef="let b">
                @if (b.status === 'PAYMENT_PENDING') {
                  <button
                    mat-stroked-button
                    (click)="approve(b)"
                    [disabled]="busyId() === b.id"
                  >
                    <mat-icon>check</mat-icon> Approve
                  </button>
                  <button
                    mat-stroked-button
                    color="warn"
                    (click)="reject(b)"
                    [disabled]="busyId() === b.id"
                  >
                    <mat-icon>close</mat-icon> Reject
                  </button>
                }
                @if (b.payment_proof_path) {
                  <button
                    mat-icon-button
                    type="button"
                    (click)="viewPaymentProof(b.id)"
                    matTooltip="View payment proof"
                    aria-label="View payment proof"
                  >
                    <mat-icon>receipt_long</mat-icon>
                  </button>
                }
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
          </div>
        }
      </mat-card>
    </div>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
      }
      .toolbar {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 12px;
        width: 100%;
        max-width: 100%;
      }
      @media (min-width: 640px) {
        .toolbar {
          flex-direction: row;
          flex-wrap: wrap;
          align-items: flex-start;
        }
      }
      .filter-field {
        width: 100%;
        min-width: 0;
      }
      @media (min-width: 640px) {
        .filter-field {
          width: auto;
          min-width: 160px;
        }
      }
      .search-field {
        width: 100%;
        min-width: 0;
        flex: 1 1 auto;
      }
      @media (min-width: 640px) {
        .search-field {
          min-width: 200px;
          max-width: 420px;
        }
      }
      .table-scroll {
        margin: 0 -4px;
      }
      @media (min-width: 600px) {
        .table-scroll {
          margin: 0;
        }
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
    `,
  ],
})
export class AdminBookingsComponent {
  private readonly api = inject(AdminStudyService);
  private readonly snack = inject(MatSnackBar);

  readonly bookings = signal<BookingResponse[]>([]);
  readonly loading = signal(false);
  readonly busyId = signal<string | null>(null);

  statusFilter: StatusFilter = 'ALL';
  searchTerm = '';

  readonly statusOptions = STATUS_OPTIONS;
  readonly columns = [
    'user',
    'seat',
    'dates',
    'access',
    'category',
    'price',
    'status',
    'created',
    'actions',
  ];

  /** Client-side text search across name / email / phone / user_id / seat. */
  readonly filtered = computed(() => {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.bookings();
    return this.bookings().filter((b) => {
      const haystack = [
        b.user_id,
        String(b.seat_id),
        b.user?.email,
        b.user?.phone_number,
        b.user?.given_name,
        b.user?.family_name,
      ]
        .filter((v): v is string => !!v)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    const filter = this.statusFilter === 'ALL' ? null : this.statusFilter;
    this.api.allBookings(filter).subscribe({
      next: (list) => {
        this.bookings.set(list);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.snack.open(err.error?.detail ?? 'Failed to load bookings', 'Dismiss', {
          duration: 4000,
        });
      },
    });
  }

  statCount(status: BookingStatus): number {
    return this.bookings().filter((b) => b.status === status).length;
  }

  shortId(id: string): string {
    return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
  }

  /** Display label for a user: "First Last" when available, else email, else short sub. */
  userName(b: BookingResponse): string {
    const u = b.user;
    if (u) {
      const parts = [u.given_name, u.family_name].filter((s): s is string => !!s);
      if (parts.length > 0) return parts.join(' ');
      if (u.email) return u.email;
    }
    return this.shortId(b.user_id);
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

  approve(b: BookingResponse): void {
    this.busyId.set(b.id);
    this.api.approvePayment(b.id).subscribe({
      next: (updated) => {
        this.busyId.set(null);
        this.bookings.update((list) =>
          list.map((x) => (x.id === updated.id ? updated : x)),
        );
        this.snack.open('Payment approved', 'Dismiss', { duration: 2500 });
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
      next: (updated) => {
        this.busyId.set(null);
        this.bookings.update((list) =>
          list.map((x) => (x.id === updated.id ? updated : x)),
        );
        this.snack.open('Payment rejected, seat released', 'Dismiss', {
          duration: 2500,
        });
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

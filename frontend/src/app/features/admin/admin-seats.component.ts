import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AdminStudyService } from '../../core/api/admin-study.service';
import { SeatResponse } from '../../core/api/models';

@Component({
  selector: 'zv-admin-seats',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatDividerModule,
    MatIconModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="zv-page">
      <h2 class="zv-page-title">Seat availability</h2>
      <p class="zv-page-lead">
        Disabled seats cannot be booked. Existing bookings on a seat stay valid;
        users can still change dates while keeping that seat.
      </p>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      <mat-card>
        <div class="card-head">
          <mat-icon aria-hidden="true">event_seat</mat-icon>
          <div>
            <h3>All seats (1–65)</h3>
            <p class="card-sub">Toggle off to take a seat out of service.</p>
          </div>
        </div>

        <mat-divider />

        <div class="seat-grid">
          @for (s of seats(); track s.id) {
            <div class="seat-row">
              <span class="seat-label">Seat {{ s.id }}</span>
              <mat-slide-toggle
                [checked]="s.is_enabled"
                [disabled]="patchingIds().has(s.id)"
                (change)="onToggle(s, $event)"
                color="primary"
              >
                {{ s.is_enabled ? 'Bookable' : 'Disabled' }}
              </mat-slide-toggle>
            </div>
          }
        </div>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .card-head {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 16px;
      }
      .card-head mat-icon {
        color: #7c3aed;
      }
      .card-head h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
      .card-sub {
        margin: 4px 0 0 0;
        font-size: 13px;
        color: var(--mat-sys-on-surface-variant);
      }
      .seat-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 8px 16px;
        padding: 16px;
        max-height: min(70vh, 560px);
        overflow: auto;
      }
      .seat-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 4px 0;
        border-bottom: 1px solid rgba(15, 23, 42, 0.06);
      }
      .seat-label {
        font-weight: 500;
        font-size: 14px;
      }
      .zv-page-lead {
        margin: -4px 0 16px 0;
        font-size: 14px;
        color: var(--mat-sys-on-surface-variant);
        max-width: 640px;
      }
    `,
  ],
})
export class AdminSeatsComponent {
  private readonly api = inject(AdminStudyService);
  private readonly snack = inject(MatSnackBar);

  readonly loading = signal(false);
  readonly seats = signal<SeatResponse[]>([]);
  readonly patchingIds = signal(new Set<number>());

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api.listSeats().subscribe({
      next: (rows) => {
        this.seats.set(rows);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.snack.open(err.error?.detail ?? 'Could not load seats', 'Dismiss', {
          duration: 4000,
        });
      },
    });
  }

  onToggle(seat: SeatResponse, ev: MatSlideToggleChange): void {
    if (ev.checked === seat.is_enabled) return;
    const next = new Set(this.patchingIds());
    next.add(seat.id);
    this.patchingIds.set(next);

    this.api.patchSeat(seat.id, { is_enabled: ev.checked }).subscribe({
      next: (updated) => {
        this.seats.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
        const done = new Set(this.patchingIds());
        done.delete(seat.id);
        this.patchingIds.set(done);
        this.snack.open(
          updated.is_enabled ? `Seat ${updated.id} is bookable again` : `Seat ${updated.id} disabled`,
          'Dismiss',
          { duration: 2500 },
        );
      },
      error: (err: HttpErrorResponse) => {
        const done = new Set(this.patchingIds());
        done.delete(seat.id);
        this.patchingIds.set(done);
        this.snack.open(err.error?.detail ?? 'Update failed', 'Dismiss', { duration: 4000 });
        this.reload();
      },
    });
  }
}

import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AdminStudyService } from '../../core/api/admin-study.service';

@Component({
  selector: 'zv-admin-pricing',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="zv-page">
      <h2 class="zv-page-title">Pricing configuration</h2>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      <mat-card>
        <form [formGroup]="form" (ngSubmit)="save()" class="form">
          <h3>Base prices (NPR, Rs.)</h3>
          <div class="grid3">
            <mat-form-field appearance="outline">
              <mat-label>Daily</mat-label>
              <input matInput type="number" formControlName="daily_base_price" min="0" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Weekly</mat-label>
              <input matInput type="number" formControlName="weekly_base_price" min="0" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Monthly</mat-label>
              <input matInput type="number" formControlName="monthly_base_price" min="0" />
            </mat-form-field>
          </div>

          <mat-divider />

          <h3>Discounts (%)</h3>
          <div class="grid3">
            <mat-form-field appearance="outline">
              <mat-label>Daily</mat-label>
              <input
                matInput
                type="number"
                formControlName="daily_discount_percent"
                min="0"
                max="100"
              />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Weekly</mat-label>
              <input
                matInput
                type="number"
                formControlName="weekly_discount_percent"
                min="0"
                max="100"
              />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Monthly</mat-label>
              <input
                matInput
                type="number"
                formControlName="monthly_discount_percent"
                min="0"
                max="100"
              />
            </mat-form-field>
          </div>

          <mat-divider />

          <h3>Rules</h3>
          <div class="grid3">
            <mat-form-field appearance="outline">
              <mat-label>ANYTIME surcharge (%)</mat-label>
              <input
                matInput
                type="number"
                formControlName="anytime_surcharge_percent"
                min="0"
                max="100"
              />
            </mat-form-field>
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
      </mat-card>
    </div>
  `,
  styles: [
    `
      .form {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      h3 {
        margin: 0;
        font-weight: 500;
      }
      .grid3 {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
      }
      .actions {
        display: flex;
        gap: 12px;
        margin-top: 8px;
      }
    `,
  ],
})
export class AdminPricingComponent {
  private readonly api = inject(AdminStudyService);
  private readonly fb = inject(FormBuilder);
  private readonly snack = inject(MatSnackBar);

  readonly loading = signal(false);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    daily_base_price: [0, [Validators.required, Validators.min(0)]],
    weekly_base_price: [0, [Validators.required, Validators.min(0)]],
    monthly_base_price: [0, [Validators.required, Validators.min(0)]],
    daily_discount_percent: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    weekly_discount_percent: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    monthly_discount_percent: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    anytime_surcharge_percent: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    reservation_timeout_minutes: [30, [Validators.required, Validators.min(1)]],
    business_open_time: ['09:00', Validators.required],
    business_close_time: ['21:00', Validators.required],
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api.getPricing().subscribe({
      next: (p) => {
        this.form.patchValue(p);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.snack.open(err.error?.detail ?? 'Failed to load pricing', 'Dismiss', {
          duration: 4000,
        });
      },
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.api.updatePricing(this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.snack.open('Pricing updated', 'Dismiss', { duration: 3000 });
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.snack.open(err.error?.detail ?? 'Save failed', 'Dismiss', { duration: 4000 });
      },
    });
  }
}

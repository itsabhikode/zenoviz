import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';

import { AdminRolesService } from '../../core/api/admin-roles.service';

@Component({
  selector: 'zv-admin-roles',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSnackBarModule,
    MatTabsModule,
  ],
  template: `
    <div class="zv-page">
      <h2 class="zv-page-title">Roles</h2>

      <mat-tab-group>
        <mat-tab label="Admin members">
          <div class="tab">
            <div class="zv-flex-row">
              <button mat-stroked-button (click)="loadMembers()">
                <mat-icon>refresh</mat-icon>
                Reload
              </button>
              <span class="muted">
                {{ members().length }} user(s) with <code>admin</code>
              </span>
            </div>
            @if (members().length === 0) {
              <p class="muted">No users hold the admin role yet.</p>
            } @else {
              <div class="chip-grid">
                @for (id of members(); track id) {
                  <mat-chip highlighted>{{ id }}</mat-chip>
                }
              </div>
            }
          </div>
        </mat-tab>

        <mat-tab label="Grant by email">
          <div class="tab">
            <p class="muted">
              Look up a user by email (Cognito <code>AdminGetUser</code>) and grant them a role.
              Equivalent to finding them in the Users list and clicking "Grant admin".
            </p>
            <form [formGroup]="grantForm" (ngSubmit)="grantByEmail()" class="form">
              <mat-form-field appearance="outline">
                <mat-label>User email</mat-label>
                <input matInput type="email" formControlName="email" />
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Role</mat-label>
                <input matInput formControlName="role" />
              </mat-form-field>
              <div class="actions">
                <button
                  mat-flat-button
                  color="primary"
                  type="submit"
                  [disabled]="grantForm.invalid || busy()"
                >
                  Grant
                </button>
                <button
                  mat-stroked-button
                  type="button"
                  (click)="revokeByEmail()"
                  [disabled]="grantForm.invalid || busy()"
                >
                  Revoke
                </button>
              </div>
            </form>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [
    `
      .tab {
        padding: 16px;
      }
      .chip-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }
      .form {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        flex-wrap: wrap;
      }
      .form mat-form-field {
        min-width: 240px;
      }
      .actions {
        display: flex;
        gap: 8px;
        padding-top: 8px;
      }
      .muted {
        color: var(--mat-sys-on-surface-variant);
        font-size: 14px;
      }
    `,
  ],
})
export class AdminRolesComponent {
  private readonly api = inject(AdminRolesService);
  private readonly fb = inject(FormBuilder);
  private readonly snack = inject(MatSnackBar);

  readonly members = signal<string[]>([]);
  readonly busy = signal(false);

  readonly grantForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['admin', Validators.required],
  });

  constructor() {
    this.loadMembers();
  }

  loadMembers(): void {
    this.api.membersOf('admin').subscribe({
      next: (res) => this.members.set(res.user_ids),
      error: (err: HttpErrorResponse) =>
        this.snack.open(err.error?.detail ?? 'Failed to load', 'Dismiss', {
          duration: 4000,
        }),
    });
  }

  grantByEmail(): void {
    if (this.grantForm.invalid) return;
    this.busy.set(true);
    const { email, role } = this.grantForm.getRawValue();
    this.api.grant({ email, role }).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.snack.open(
          res.changed ? `Granted ${role} to ${email}` : `${email} already has ${role}`,
          'Dismiss',
          { duration: 3000 },
        );
        this.loadMembers();
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.snack.open(err.error?.detail ?? 'Grant failed', 'Dismiss', { duration: 4000 });
      },
    });
  }

  revokeByEmail(): void {
    if (this.grantForm.invalid) return;
    this.busy.set(true);
    const { email, role } = this.grantForm.getRawValue();
    this.api.revoke({ email, role }).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.snack.open(
          res.changed ? `Revoked ${role} from ${email}` : `${email} didn't have ${role}`,
          'Dismiss',
          { duration: 3000 },
        );
        this.loadMembers();
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.snack.open(err.error?.detail ?? 'Revoke failed', 'Dismiss', {
          duration: 4000,
        });
      },
    });
  }
}

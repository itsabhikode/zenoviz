import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { debounceTime } from 'rxjs';

import { AdminUsersService } from '../../core/api/admin-users.service';
import { AuthService } from '../../core/api/auth.service';
import { UserAdminSummary } from '../../core/api/models';

@Component({
  selector: 'zv-admin-users',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTableModule,
  ],
  template: `
    <div class="zv-page">
      <div class="zv-flex-row">
        <h2 class="zv-page-title">Users</h2>
        <span class="zv-spacer"></span>
        <mat-form-field appearance="outline" class="search">
          <mat-label>Search by email prefix</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [formControl]="emailFilter" placeholder="alice" />
        </mat-form-field>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      <mat-card>
        <table mat-table [dataSource]="users()" class="full-width">
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>Email</th>
            <td mat-cell *matCellDef="let u">
              <div class="user-cell">
                <div>{{ u.email ?? '—' }}</div>
                <small class="muted">{{ u.user_id }}</small>
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let u">
              {{ (u.given_name ?? '') + ' ' + (u.family_name ?? '') | titlecase }}
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let u">
              <mat-chip [color]="statusColor(u.status)" highlighted>{{ u.status }}</mat-chip>
              @if (!u.enabled) {
                <mat-chip color="warn" highlighted>disabled</mat-chip>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="roles">
            <th mat-header-cell *matHeaderCellDef>Roles</th>
            <td mat-cell *matCellDef="let u">
              @if (u.roles.length === 0) {
                <span class="muted">—</span>
              } @else {
                @for (r of u.roles; track r) {
                  <mat-chip color="accent" highlighted>{{ r }}</mat-chip>
                }
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="created">
            <th mat-header-cell *matHeaderCellDef>Created</th>
            <td mat-cell *matCellDef="let u">
              {{ u.created_at ? (u.created_at | date: 'mediumDate') : '—' }}
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let u">
              <button mat-icon-button [matMenuTriggerFor]="menu" aria-label="Actions">
                <mat-icon>more_vert</mat-icon>
              </button>
              <mat-menu #menu="matMenu">
                @if (!u.roles.includes('admin')) {
                  <button mat-menu-item (click)="grant(u, 'admin')">
                    <mat-icon>admin_panel_settings</mat-icon>
                    <span>Grant admin</span>
                  </button>
                } @else {
                  <button
                    mat-menu-item
                    (click)="revoke(u, 'admin')"
                    [disabled]="isSelf(u)"
                  >
                    <mat-icon>remove_moderator</mat-icon>
                    <span>Revoke admin</span>
                  </button>
                }
              </mat-menu>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>

        <div class="pagination">
          <button
            mat-stroked-button
            (click)="loadPage(previousToken())"
            [disabled]="!previousToken()"
          >
            <mat-icon>chevron_left</mat-icon> Previous
          </button>
          <button
            mat-stroked-button
            (click)="loadPage(nextToken())"
            [disabled]="!nextToken()"
          >
            Next <mat-icon>chevron_right</mat-icon>
          </button>
        </div>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
      }
      .search {
        width: 280px;
      }
      .user-cell {
        display: flex;
        flex-direction: column;
      }
      .muted {
        color: var(--mat-sys-on-surface-variant);
        font-size: 12px;
      }
      .pagination {
        padding: 12px 16px;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
    `,
  ],
})
export class AdminUsersComponent {
  private readonly api = inject(AdminUsersService);
  private readonly snack = inject(MatSnackBar);
  private readonly auth = inject(AuthService);

  readonly users = signal<UserAdminSummary[]>([]);
  readonly loading = signal(false);
  readonly nextToken = signal<string | null>(null);
  readonly tokenHistory = signal<(string | null)[]>([null]);
  readonly columns = ['email', 'name', 'status', 'roles', 'created', 'actions'];

  readonly emailFilter = new FormControl<string>('', { nonNullable: true });

  constructor() {
    this.loadPage(null);
    this.emailFilter.valueChanges.pipe(debounceTime(300)).subscribe(() => {
      this.tokenHistory.set([null]);
      this.loadPage(null);
    });
  }

  previousToken(): string | null {
    const h = this.tokenHistory();
    return h.length >= 2 ? h[h.length - 2] : null;
  }

  loadPage(token: string | null): void {
    this.loading.set(true);
    this.api
      .list({
        limit: 25,
        paginationToken: token,
        emailPrefix: this.emailFilter.value || null,
      })
      .subscribe({
        next: (res) => {
          this.users.set(res.users);
          this.nextToken.set(res.next_pagination_token);
          if (
            token !== null &&
            this.tokenHistory()[this.tokenHistory().length - 1] !== token
          ) {
            this.tokenHistory.update((h) => [...h, token]);
          }
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.snack.open(err.error?.detail ?? 'Failed to load users', 'Dismiss', {
            duration: 4000,
          });
        },
      });
  }

  isSelf(u: UserAdminSummary): boolean {
    return u.user_id === this.auth.currentUser()?.user_id;
  }

  grant(u: UserAdminSummary, role: string): void {
    this.api.grantRole(u.user_id, role).subscribe({
      next: () => {
        this.snack.open(`Granted ${role} to ${u.email ?? u.user_id}`, 'Dismiss', {
          duration: 3000,
        });
        this.users.update((list) =>
          list.map((x) =>
            x.user_id === u.user_id && !x.roles.includes(role)
              ? { ...x, roles: [...x.roles, role].sort() }
              : x,
          ),
        );
      },
      error: (err: HttpErrorResponse) =>
        this.snack.open(err.error?.detail ?? 'Grant failed', 'Dismiss', { duration: 4000 }),
    });
  }

  revoke(u: UserAdminSummary, role: string): void {
    this.api.revokeRole(u.user_id, role).subscribe({
      next: () => {
        this.snack.open(`Revoked ${role} from ${u.email ?? u.user_id}`, 'Dismiss', {
          duration: 3000,
        });
        this.users.update((list) =>
          list.map((x) =>
            x.user_id === u.user_id
              ? { ...x, roles: x.roles.filter((r) => r !== role) }
              : x,
          ),
        );
      },
      error: (err: HttpErrorResponse) =>
        this.snack.open(err.error?.detail ?? 'Revoke failed', 'Dismiss', {
          duration: 4000,
        }),
    });
  }

  statusColor(status: string): 'primary' | 'accent' | 'warn' | undefined {
    if (status === 'CONFIRMED') return 'primary';
    if (status === 'UNCONFIRMED' || status === 'FORCE_CHANGE_PASSWORD') return 'accent';
    return undefined;
  }
}

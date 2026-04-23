import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/api/auth.service';
import { ZV_OAUTH_STATE, ZV_OAUTH_VERIFIER } from '../../core/auth/cognito-oauth';

@Component({
  selector: 'zv-oauth-callback',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatProgressBarModule, RouterLink],
  template: `
    <div class="wrap">
      @if (loading()) {
        <p>Completing sign-in…</p>
        <mat-progress-bar mode="indeterminate" />
      } @else if (errorMsg()) {
        <p class="err">{{ errorMsg() }}</p>
        <a mat-flat-button color="primary" routerLink="/login">Back to sign in</a>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: grid;
        min-height: 40vh;
        place-items: center;
        padding: 24px;
      }
      .wrap {
        max-width: 420px;
        text-align: center;
      }
      .err {
        color: var(--mat-sys-error);
        margin-bottom: 16px;
      }
    `,
  ],
})
export class OAuthCallbackComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly errorMsg = signal<string | null>(null);

  constructor() {
    const qp = this.route.snapshot.queryParamMap;
    const oauthErr = qp.get('error');
    if (oauthErr) {
      this.loading.set(false);
      this.errorMsg.set(qp.get('error_description') ?? oauthErr);
      return;
    }

    const code = qp.get('code');
    const state = qp.get('state');
    const expected = sessionStorage.getItem(ZV_OAUTH_STATE);
    if (!code || !state || !expected || state !== expected) {
      this.loading.set(false);
      this.errorMsg.set('Invalid or expired sign-in attempt. Please try again.');
      sessionStorage.removeItem(ZV_OAUTH_VERIFIER);
      sessionStorage.removeItem(ZV_OAUTH_STATE);
      return;
    }

    this.auth.exchangeHostedUiCode(code).subscribe({
      next: () => {
        const returnPath = this.auth.consumeOAuthReturnPath();
        this.auth.me().subscribe({
          next: () => void this.router.navigateByUrl(returnPath ?? '/app/my-bookings'),
          error: () => void this.router.navigateByUrl(returnPath ?? '/app/my-bookings'),
        });
      },
      error: (e: unknown) => {
        this.loading.set(false);
        if (e instanceof HttpErrorResponse) {
          const body = e.error as { error_description?: string; message?: string } | null;
          this.errorMsg.set(
            body?.error_description ?? body?.message ?? e.message ?? 'Sign-in failed.',
          );
          return;
        }
        this.errorMsg.set(e instanceof Error ? e.message : 'Sign-in failed.');
      },
    });
  }
}

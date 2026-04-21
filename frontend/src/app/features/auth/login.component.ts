import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/api/auth.service';

@Component({
  selector: 'zv-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="auth-shell">
      <aside class="hero">
        <div class="hero-inner">
          <div class="brand">
            <div class="brand-mark"><mat-icon>event_seat</mat-icon></div>
            <span>Zenoviz</span>
          </div>
          <h1>Book your study seat in seconds.</h1>
          <p>
            Reserve a quiet spot by the hour, the week, or the month. Skip the
            front-desk back-and-forth.
          </p>
          <ul class="features">
            <li><mat-icon>bolt</mat-icon> Live availability</li>
            <li><mat-icon>verified</mat-icon> Admin-approved payments</li>
            <li><mat-icon>schedule</mat-icon> Transparent pricing</li>
          </ul>
        </div>
      </aside>

      <section class="card-side">
        <div class="auth-card-wrap">
          <div class="auth-card">
            <div class="card-head">
              <h2>Welcome back</h2>
              <p>Sign in to manage your bookings</p>
            </div>

            @if (submitting()) {
              <mat-progress-bar mode="indeterminate" class="card-progress" />
            }

            <form
              [formGroup]="form"
              (ngSubmit)="submit()"
              class="auth-form"
              autocomplete="on"
            >
              <mat-form-field appearance="outline">
                <mat-label>Email</mat-label>
                <input
                  matInput
                  type="email"
                  formControlName="email"
                  autocomplete="username"
                />
                @if (form.controls.email.hasError('required')) {
                  <mat-error>Email is required</mat-error>
                }
                @if (form.controls.email.hasError('email')) {
                  <mat-error>Enter a valid email</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Password</mat-label>
                <input
                  matInput
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="password"
                  autocomplete="current-password"
                />
                <button
                  mat-icon-button
                  matSuffix
                  type="button"
                  (click)="showPassword.set(!showPassword())"
                  [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                >
                  <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (form.controls.password.hasError('required')) {
                  <mat-error>Password is required</mat-error>
                }
              </mat-form-field>

              <div class="forgot-row">
                <a routerLink="/forgot-password">Forgot password?</a>
              </div>

              @if (errorMsg()) {
                <div class="error-banner">{{ errorMsg() }}</div>
              }

              <button
                mat-flat-button
                color="primary"
                type="submit"
                class="submit-btn"
                [disabled]="submitting() || form.invalid"
              >
                {{ submitting() ? 'Signing in…' : 'Sign in' }}
              </button>

              <div class="alt">
                New here? <a routerLink="/register">Create an account</a>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .auth-shell {
        min-height: 100vh;
        min-height: 100dvh;
        max-width: 100%;
        overflow-x: clip;
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
      }
      @media (max-width: 900px) {
        .auth-shell {
          grid-template-columns: 1fr;
        }
      }
      .hero {
        position: relative;
        color: #fff;
        background: var(--zv-gradient-brand);
        overflow: hidden;
      }
      .hero::before {
        content: '';
        position: absolute;
        inset: -20%;
        background:
          radial-gradient(600px 400px at 20% 20%, rgba(255, 255, 255, 0.22), transparent 60%),
          radial-gradient(500px 350px at 80% 80%, rgba(255, 255, 255, 0.14), transparent 60%);
        pointer-events: none;
      }
      @media (max-width: 900px) {
        .hero {
          display: none;
        }
      }
      .hero-inner {
        position: relative;
        height: 100%;
        padding: 56px 64px;
        display: flex;
        flex-direction: column;
        gap: 32px;
        justify-content: center;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 700;
        letter-spacing: -0.02em;
        font-size: 18px;
      }
      .brand-mark {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.18);
        display: grid;
        place-items: center;
        backdrop-filter: blur(8px);
      }
      .brand-mark mat-icon {
        color: #fff;
      }
      .hero h1 {
        margin: 0;
        font-size: 40px;
        line-height: 1.1;
        letter-spacing: -0.03em;
        font-weight: 700;
        max-width: 520px;
      }
      .hero p {
        margin: 0;
        font-size: 16px;
        opacity: 0.88;
        max-width: 460px;
        line-height: 1.5;
      }
      .features {
        list-style: none;
        padding: 0;
        margin: 12px 0 0;
        display: grid;
        gap: 10px;
      }
      .features li {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        opacity: 0.92;
      }
      .features li mat-icon {
        background: rgba(255, 255, 255, 0.16);
        border-radius: 50%;
        padding: 4px;
        font-size: 18px;
        width: 26px;
        height: 26px;
        display: grid;
        place-items: center;
      }
      .card-side {
        display: grid;
        place-items: center;
        padding: max(20px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
          max(24px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
      }
      @media (min-width: 901px) {
        .card-side {
          padding: 32px 24px;
        }
      }
      .auth-card-wrap {
        width: 100%;
        max-width: 420px;
      }
      .auth-card {
        background: var(--mat-sys-surface);
        border-radius: var(--zv-radius-xl);
        border: 1px solid rgba(15, 23, 42, 0.06);
        box-shadow: var(--zv-shadow-lg);
        overflow: hidden;
      }
      .card-head {
        padding: 28px 28px 4px;
      }
      .card-head h2 {
        margin: 0;
        font-size: 24px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }
      .card-head p {
        margin: 6px 0 0 0;
        color: var(--mat-sys-on-surface-variant);
        font-size: 14px;
      }
      .card-progress {
        margin-top: 12px;
      }
      .auth-form {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 20px 28px 28px;
      }
      .forgot-row {
        text-align: right;
        margin: -4px 0 4px;
      }
      .forgot-row a {
        font-size: 13px;
        color: var(--mat-sys-primary);
        font-weight: 500;
        text-decoration: none;
      }
      .forgot-row a:hover {
        text-decoration: underline;
      }
      .submit-btn {
        height: 48px;
        font-size: 15px !important;
        margin-top: 8px;
      }
      .error-banner {
        background: var(--mat-sys-error-container);
        color: var(--mat-sys-on-error-container);
        padding: 10px 14px;
        border-radius: 10px;
        font-size: 13px;
        margin: 4px 0;
      }
      .alt {
        text-align: center;
        font-size: 14px;
        margin-top: 14px;
        color: var(--mat-sys-on-surface-variant);
      }
      .alt a {
        color: var(--mat-sys-primary);
        font-weight: 500;
        text-decoration: none;
      }
      .alt a:hover {
        text-decoration: underline;
      }
    `,
  ],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  readonly submitting = signal(false);
  readonly showPassword = signal(false);
  readonly errorMsg = signal<string | null>(null);

  submit(): void {
    if (this.form.invalid) return;
    this.errorMsg.set(null);
    this.submitting.set(true);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => {
        this.auth.me().subscribe({
          next: () => this.goAfterLogin(),
          error: () => this.goAfterLogin(),
        });
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMsg.set(this.readableError(err));
      },
    });
  }

  private goAfterLogin(): void {
    const returnTo =
      this.route.snapshot.queryParamMap.get('returnTo') ?? '/app/my-bookings';
    this.router.navigateByUrl(returnTo);
  }

  private readableError(err: HttpErrorResponse): string {
    if (err.status === 401) return 'Invalid email or password.';
    if (err.status === 403) return 'Account not verified. Check your email for the code.';
    return err.error?.detail ?? 'Sign in failed. Please try again.';
  }
}

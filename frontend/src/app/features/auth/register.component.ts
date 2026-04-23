import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/api/auth.service';
import { RegisterResponse } from '../../core/api/models';

@Component({
  selector: 'zv-register',
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
    MatSelectModule,
  ],
  template: `
    <div class="auth-shell">
      <aside class="hero">
        <div class="hero-inner">
          <div class="brand">
            <div class="brand-mark"><mat-icon>event_seat</mat-icon></div>
            <span>Zenoviz</span>
          </div>
          <h1>Create your account.</h1>
          <p>
            Sign up once and book any seat, any time. Cognito sends a one-time
            verification code (email or SMS — your pool chooses).
          </p>
          <ul class="features">
            <li><mat-icon>mail_lock</mat-icon> Verified via Cognito</li>
            <li><mat-icon>event_seat</mat-icon> Instant seat reservations</li>
            <li><mat-icon>receipt_long</mat-icon> Upload payment proof in-app</li>
          </ul>
        </div>
      </aside>

      <section class="card-side">
        <div class="auth-card-wrap">
          <div class="auth-card">
            <div class="card-head">
              <h2>Create your account</h2>
              <p>Verified via Cognito (email or SMS)</p>
            </div>

            @if (submitting()) {
              <mat-progress-bar mode="indeterminate" class="card-progress" />
            }

            @if (success(); as s) {
              <div class="success-banner">
                <mat-icon class="check">{{
                  s.delivery_medium === 'SMS' ? 'sms' : 'mark_email_read'
                }}</mat-icon>
                <p class="success-title">{{ s.message }}</p>
                @if (s.verification_destination) {
                  <p class="success-body">
                    Verification code sent via
                    <strong>{{ s.delivery_medium }}</strong> to
                    <strong>{{ s.verification_destination }}</strong
                    >.
                  </p>
                }
                <a routerLink="/login" mat-flat-button color="primary">Go to sign in</a>
              </div>
            } @else {
              @if (auth.googleOAuthAvailable) {
                <div class="oauth-block">
                  <button
                    mat-stroked-button
                    type="button"
                    class="google-btn"
                    (click)="signUpWithGoogle()"
                    [disabled]="submitting()"
                  >
                    Continue with Google
                  </button>
                  <div class="oauth-divider"><span>or register with email</span></div>
                </div>
              }
              <form [formGroup]="form" (ngSubmit)="submit()" class="auth-form">
                <div class="row">
                  <mat-form-field appearance="outline">
                    <mat-label>First name</mat-label>
                    <input matInput formControlName="given_name" />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Last name</mat-label>
                    <input matInput formControlName="family_name" />
                  </mat-form-field>
                </div>

                <mat-form-field appearance="outline">
                  <mat-label>Email</mat-label>
                  <input
                    matInput
                    type="email"
                    formControlName="email"
                    autocomplete="email"
                  />
                  @if (form.controls.email.hasError('email')) {
                    <mat-error>Enter a valid email</mat-error>
                  }
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Phone (E.164, e.g. +977 98XXXXXXX)</mat-label>
                  <input matInput formControlName="phone_number" />
                  @if (form.controls.phone_number.hasError('pattern')) {
                    <mat-error>Use +country code followed by digits (no spaces)</mat-error>
                  }
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Gender</mat-label>
                  <mat-select formControlName="gender">
                    <mat-option value="male">Male</mat-option>
                    <mat-option value="female">Female</mat-option>
                    <mat-option value="other">Other</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Password</mat-label>
                  <input matInput type="password" formControlName="password" />
                  <mat-hint
                    >At least 8 chars with upper, lower, digit, and symbol.</mat-hint
                  >
                  @if (form.controls.password.hasError('minlength')) {
                    <mat-error>Minimum 8 characters</mat-error>
                  }
                </mat-form-field>

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
                  {{ submitting() ? 'Creating…' : 'Create account' }}
                </button>

                <div class="alt">
                  Already have an account? <a routerLink="/login">Sign in</a>
                </div>
              </form>
            }
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
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
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
        max-width: 520px;
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
      .row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
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
      .success-banner {
        padding: 28px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 10px;
      }
      .success-banner .check {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #10b981;
      }
      .success-title {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }
      .success-body {
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
        font-size: 14px;
        line-height: 1.5;
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
      .oauth-block {
        padding: 8px 28px 0;
      }
      .google-btn {
        width: 100%;
        height: 48px;
      }
      .oauth-divider {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 18px 0 6px;
        color: var(--mat-sys-outline);
        font-size: 13px;
      }
      .oauth-divider::before,
      .oauth-divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: rgba(15, 23, 42, 0.12);
      }
    `,
  ],
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);

  readonly form = this.fb.nonNullable.group({
    given_name: ['', Validators.required],
    family_name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone_number: [
      '+977',
      [Validators.required, Validators.pattern(/^\+[1-9]\d{6,14}$/)],
    ],
    gender: ['male' as 'male' | 'female' | 'other', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  readonly submitting = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly success = signal<RegisterResponse | null>(null);

  signUpWithGoogle(): void {
    void this.auth.startGoogleOAuth(null);
  }

  submit(): void {
    if (this.form.invalid) return;
    this.errorMsg.set(null);
    this.submitting.set(true);
    this.auth.register(this.form.getRawValue()).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.success.set(res);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMsg.set(err.error?.detail ?? 'Registration failed.');
      },
    });
  }
}

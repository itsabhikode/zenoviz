import { CommonModule, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
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
import { BookingsService } from '../../core/api/bookings.service';
import { PricingConfigResponse } from '../../core/api/models';

@Component({
  selector: 'zv-login',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
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
    <div class="auth-shell" [class.mobile-login]="showLogin()">
      <aside class="hero">
        <div class="hero-inner">
          <div class="brand">
            <div class="brand-mark"><mat-icon>event_seat</mat-icon></div>
            <span>Zenoviz</span>
          </div>
          <h1>Book your study seat in seconds.</h1>

          @if (pricing()) {
            <div class="pricing-banner">

              <div class="pricing-header">
                <span class="pricing-title">Study Room pricing</span>
                <span class="currency-pill">NPR · per day</span>
              </div>

              <div class="pricing-grid">
                <div class="pg-cell pg-label"></div>
                <div class="pg-cell pg-col-head">Daily</div>
                <div class="pg-cell pg-col-head pg-weekly">
                  <span>Weekly</span>
                  @if (weeklyAnytimeSaving() > 0) {
                    <span class="pg-save">Save {{ weeklyAnytimeSaving() }}%</span>
                  }
                </div>
                <div class="pg-cell pg-col-head">
                  <span>Monthly</span>
                  @if (monthlyAnytimeSaving() > 0) {
                    <span class="pg-save">Save {{ monthlyAnytimeSaving() }}%</span>
                  }
                </div>

                <!-- Anytime -->
                <div class="pg-cell pg-row-label">
                  <div>
                    <div class="pg-plan-name">Anytime <span class="pg-badge">Popular</span></div>
                    <div class="pg-plan-sub">Unlimited hours</div>
                  </div>
                </div>
                <div class="pg-cell pg-price-cell">
                  <div class="pg-price-main">{{ pricing()!.anytime_daily_price }}</div>
                  <div class="pg-price-sub">per day</div>
                </div>
                <div class="pg-cell pg-price-cell pg-weekly">
                  <div class="pg-price-main">{{ pricing()!.anytime_weekly_price }}</div>
                  <div class="pg-price-sub">per day</div>
                  <div class="pg-price-period">{{ pricing()!.anytime_weekly_price * 7 | number }} / wk</div>
                </div>
                <div class="pg-cell pg-price-cell">
                  <div class="pg-price-main">{{ pricing()!.anytime_monthly_price }}</div>
                  <div class="pg-price-sub">per day</div>
                  <div class="pg-price-period">{{ pricing()!.anytime_monthly_price * 30 | number }} / mo</div>
                </div>

                <!-- 3-hour slot -->
                <div class="pg-cell pg-row-label pg-divider">
                  <div>
                    <div class="pg-plan-name">3-hour slot</div>
                    <div class="pg-plan-sub">One session / day</div>
                  </div>
                </div>
                <div class="pg-cell pg-price-cell pg-divider">
                  <div class="pg-price-main">{{ pricing()!.timeslot_daily_price }}</div>
                  <div class="pg-price-sub">per day</div>
                </div>
                <div class="pg-cell pg-price-cell pg-weekly pg-divider">
                  <div class="pg-price-main">{{ pricing()!.timeslot_weekly_price }}</div>
                  <div class="pg-price-sub">per day</div>
                  <div class="pg-price-period">{{ pricing()!.timeslot_weekly_price * 7 | number }} / wk</div>
                </div>
                <div class="pg-cell pg-price-cell pg-divider">
                  <div class="pg-price-main">{{ pricing()!.timeslot_monthly_price }}</div>
                  <div class="pg-price-sub">per day</div>
                  <div class="pg-price-period">{{ pricing()!.timeslot_monthly_price * 30 | number }} / mo</div>
                </div>

                <!-- Locker add-on -->
                <div class="pg-cell pg-row-label pg-addon">
                  <div>
                    <div class="pg-addon-name">+ Locker</div>
                    <div class="pg-plan-sub">Optional add-on</div>
                  </div>
                </div>
                <div class="pg-cell pg-price-cell pg-addon">
                  <div class="pg-addon-price">+ {{ pricing()!.locker_daily_price }}</div>
                  <div class="pg-price-sub">per day</div>
                </div>
                <div class="pg-cell pg-price-cell pg-weekly pg-addon">
                  <div class="pg-addon-price">+ {{ pricing()!.locker_weekly_price }}</div>
                  <div class="pg-price-sub">per day</div>
                </div>
                <div class="pg-cell pg-price-cell pg-addon">
                  <div class="pg-addon-price">+ {{ pricing()!.locker_monthly_price }}</div>
                  <div class="pg-price-sub">per day</div>
                </div>
              </div>

              <div class="pricing-features">
                <span class="pf-tag">High-speed Wi-Fi</span>
                <span class="pf-tag">Charging stations</span>
                <span class="pf-tag">Drinking water</span>
                <span class="pf-tag">Open seating</span>
              </div>

            </div>
          }

          <button type="button" class="book-now-btn" (click)="showLogin.set(true)">Book now</button>

        </div>
      </aside>

      <section class="card-side">
        <div class="auth-card-wrap">
          <div class="auth-card">
            <div class="card-head">
              <button type="button" class="back-to-home" (click)="showLogin.set(false)">
                <div class="brand-mark-sm"><mat-icon>event_seat</mat-icon></div>
                <span>Zenoviz</span>
              </button>
              <h2>Welcome back</h2>
              <p>Sign in to manage your bookings</p>
            </div>

            @if (auth.googleOAuthAvailable) {
              <div class="oauth-block">
                <button
                  mat-stroked-button
                  type="button"
                  class="google-btn"
                  (click)="signInWithGoogle()"
                  [disabled]="submitting()"
                >
                  Continue with Google
                </button>
                <div class="oauth-divider"><span>or</span></div>
              </div>
            }

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
        overflow-y: auto;
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
      .hero-inner {
        position: relative;
        min-height: 100%;
        padding: 48px 48px;
        display: flex;
        flex-direction: column;
        gap: 24px;
        justify-content: center;
      }
      @media (max-width: 900px) {
        .hero-inner {
          padding: 32px 20px;
          justify-content: flex-start;
        }
      }
      .book-now-btn {
        display: none;
        border: none;
        cursor: pointer;
        align-self: stretch;
        text-align: center;
        background: #fff;
        color: #1a1a1a;
        font-size: 15px;
        font-weight: 600;
        padding: 14px 0;
        border-radius: 10px;
        margin-top: 4px;
      }
      @media (max-width: 900px) {
        .book-now-btn { display: block; }
      }
      .back-to-home {
        display: none;
        align-items: center;
        gap: 8px;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        margin-bottom: 16px;
        font-size: 16px;
        font-weight: 700;
        color: var(--mat-sys-on-surface);
        letter-spacing: -0.02em;
      }
      @media (max-width: 900px) {
        .back-to-home { display: flex; }
      }
      .brand-mark-sm {
        width: 30px;
        height: 30px;
        border-radius: 8px;
        background: var(--zv-gradient-brand);
        display: grid;
        place-items: center;
      }
      .brand-mark-sm mat-icon {
        color: #fff;
        font-size: 18px;
        width: 18px;
        height: 18px;
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
        font-size: 32px;
        line-height: 1.15;
        letter-spacing: -0.03em;
        font-weight: 700;
        max-width: 480px;
      }

      /* ── Pricing banner ── */
      .pricing-banner {
        background: rgba(255,255,255,0.10);
        border: 0.5px solid rgba(255,255,255,0.22);
        border-radius: 12px;
        overflow: hidden;
        backdrop-filter: blur(6px);
      }
      .pricing-header {
        padding: 12px 16px;
        border-bottom: 0.5px solid rgba(255,255,255,0.15);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .pricing-title {
        font-size: 13px;
        font-weight: 700;
        color: #fff;
        letter-spacing: 0.01em;
      }
      .currency-pill {
        font-size: 11px;
        color: rgba(255,255,255,0.8);
        background: rgba(255,255,255,0.15);
        padding: 3px 9px;
        border-radius: 6px;
        border: 0.5px solid rgba(255,255,255,0.25);
      }
      .pricing-grid {
        display: grid;
        grid-template-columns: 130px repeat(3, minmax(0,1fr));
      }
      .pg-cell {
        padding: 8px 10px;
        border-bottom: 0.5px solid rgba(255,255,255,0.15);
        font-size: 12px;
        color: rgba(255,255,255,0.9);
      }
      .pg-label { border-right: 0.5px solid rgba(255,255,255,0.15); }
      .pg-col-head {
        text-align: center;
        font-size: 11px;
        font-weight: 700;
        color: rgba(255,255,255,0.85);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
      }
      .pg-save {
        font-size: 10px;
        color: #86efac;
        font-weight: 600;
        text-transform: none;
        letter-spacing: 0;
      }
      .pg-weekly {
        background: rgba(255,255,255,0.08);
        border-left: 0.5px solid rgba(255,255,255,0.15);
        border-right: 0.5px solid rgba(255,255,255,0.15);
      }
      .pg-row-label {
        border-right: 0.5px solid rgba(255,255,255,0.15);
        display: flex;
        align-items: center;
      }
      .pg-plan-name {
        font-size: 12px;
        font-weight: 600;
        color: #fff;
        display: flex;
        align-items: center;
        gap: 5px;
        flex-wrap: wrap;
      }
      .pg-plan-sub {
        font-size: 10px;
        color: rgba(255,255,255,0.65);
        margin-top: 2px;
      }
      .pg-badge {
        font-size: 9px;
        background: rgba(255,255,255,0.22);
        color: #fff;
        padding: 1px 6px;
        border-radius: 4px;
      }
      .pg-price-cell {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
      }
      .pg-price-main {
        font-size: 17px;
        font-weight: 600;
        color: #fff;
        line-height: 1;
      }
      .pg-price-sub {
        font-size: 10px;
        color: rgba(255,255,255,0.65);
      }
      .pg-price-period {
        font-size: 10px;
        color: rgba(255,255,255,0.5);
        margin-top: 1px;
      }
      .pg-divider {
        border-bottom: 0.5px solid rgba(255,255,255,0.25);
      }
      .pg-addon {
        border-bottom: none;
      }
      .pg-addon-name {
        font-size: 11px;
        font-weight: 600;
        color: rgba(255,255,255,0.75);
      }
      .pg-addon-price {
        font-size: 14px;
        font-weight: 600;
        color: rgba(255,255,255,0.75);
        line-height: 1;
      }
      .pricing-features {
        padding: 10px 14px;
        border-top: 0.5px solid rgba(255,255,255,0.12);
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
      }
      .pf-tag {
        font-size: 10px;
        padding: 2px 8px;
        border-radius: 5px;
        background: rgba(255,255,255,0.15);
        color: rgba(255,255,255,0.85);
        border: 0.5px solid rgba(255,255,255,0.25);
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
      @media (max-width: 900px) {
        /* default: show hero, hide login card */
        .card-side { display: none; }
        /* after "Book now": hide hero, show login card */
        .auth-shell.mobile-login .hero { display: none; }
        .auth-shell.mobile-login .card-side { display: grid; min-height: 100dvh; }
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
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly bookings = inject(BookingsService);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  readonly submitting = signal(false);
  readonly showPassword = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly pricing = signal<PricingConfigResponse | null>(null);
  readonly showLogin = signal(false);

  ngOnInit(): void {
    this.bookings.publicPricing().subscribe({
      next: (p) => this.pricing.set(p),
      error: () => { /* silently ignore — pricing banner just stays hidden */ },
    });
  }

  weeklyAnytimeSaving(): number {
    const p = this.pricing();
    if (!p || p.anytime_daily_price === 0) return 0;
    return Math.round((1 - p.anytime_weekly_price / p.anytime_daily_price) * 100);
  }

  monthlyAnytimeSaving(): number {
    const p = this.pricing();
    if (!p || p.anytime_daily_price === 0) return 0;
    return Math.round((1 - p.anytime_monthly_price / p.anytime_daily_price) * 100);
  }

  signInWithGoogle(): void {
    const returnTo = this.route.snapshot.queryParamMap.get('returnTo');
    void this.auth.startGoogleOAuth(returnTo);
  }

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

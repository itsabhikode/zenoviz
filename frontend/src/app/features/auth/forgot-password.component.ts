import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/api/auth.service';
import { ForgotPasswordResponse } from '../../core/api/models';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const pw = control.get('new_password')?.value as string | undefined;
  const cf = control.get('confirm_password')?.value as string | undefined;
  if (!pw || !cf) return null;
  return pw === cf ? null : { mismatch: true };
}

@Component({
  selector: 'zv-forgot-password',
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
    MatSnackBarModule,
  ],
  template: `
    <div class="auth-shell">
      <aside class="hero">
        <div class="hero-inner">
          <div class="brand">
            <div class="brand-mark"><mat-icon>event_seat</mat-icon></div>
            <span>Zenoviz</span>
          </div>
          <h1>Reset your password.</h1>
          <p>
            We’ll send a verification code to your email or phone (whichever Cognito uses for
            your account). Enter the code and choose a new password.
          </p>
        </div>
      </aside>

      <section class="card-side">
        <div class="auth-card-wrap">
          <div class="auth-card">
            <div class="card-head">
              <h2>{{ step() === 1 ? 'Forgot password' : 'Set new password' }}</h2>
              <p>
                {{
                  step() === 1
                    ? 'Enter the email you used to register.'
                    : 'Use the code from your message and pick a strong new password.'
                }}
              </p>
            </div>

            @if (submitting()) {
              <mat-progress-bar mode="indeterminate" class="card-progress" />
            }

            @if (step() === 1) {
              <form [formGroup]="emailForm" (ngSubmit)="submitEmail()" class="auth-form">
                <mat-form-field appearance="outline">
                  <mat-label>Email</mat-label>
                  <input matInput type="email" formControlName="email" autocomplete="username" />
                  @if (emailForm.controls.email.hasError('required')) {
                    <mat-error>Email is required</mat-error>
                  }
                  @if (emailForm.controls.email.hasError('email')) {
                    <mat-error>Enter a valid email</mat-error>
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
                  [disabled]="submitting() || emailForm.invalid"
                >
                  {{ submitting() ? 'Sending…' : 'Send reset code' }}
                </button>

                <div class="alt">
                  <a routerLink="/login">Back to sign in</a>
                </div>
              </form>
            } @else {
              @if (requestResponse(); as info) {
                <div class="info-banner">
                  {{ info.message }}
                  @if (info.verification_destination && info.delivery_medium) {
                    <span class="info-sub">
                      Sent via {{ info.delivery_medium }} to {{ info.verification_destination }}.
                    </span>
                  }
                </div>
              }

              <form [formGroup]="resetForm" (ngSubmit)="submitReset()" class="auth-form">
                <mat-form-field appearance="outline" class="readonly-email">
                  <mat-label>Email</mat-label>
                  <input matInput [value]="emailForReset()" readonly />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Verification code</mat-label>
                  <input matInput formControlName="confirmation_code" autocomplete="one-time-code" />
                  @if (resetForm.controls.confirmation_code.hasError('required')) {
                    <mat-error>Code is required</mat-error>
                  }
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>New password</mat-label>
                  <input
                    matInput
                    [type]="showPassword() ? 'text' : 'password'"
                    formControlName="new_password"
                    autocomplete="new-password"
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
                  @if (resetForm.controls.new_password.hasError('required')) {
                    <mat-error>Password is required</mat-error>
                  }
                  @if (resetForm.controls.new_password.hasError('minlength')) {
                    <mat-error>At least 8 characters</mat-error>
                  }
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Confirm new password</mat-label>
                  <input
                    matInput
                    [type]="showPassword2() ? 'text' : 'password'"
                    formControlName="confirm_password"
                    autocomplete="new-password"
                  />
                  <button
                    mat-icon-button
                    matSuffix
                    type="button"
                    (click)="showPassword2.set(!showPassword2())"
                    [attr.aria-label]="showPassword2() ? 'Hide password' : 'Show password'"
                  >
                    <mat-icon>{{ showPassword2() ? 'visibility_off' : 'visibility' }}</mat-icon>
                  </button>
                  @if (resetForm.controls.confirm_password.hasError('required')) {
                    <mat-error>Confirm your password</mat-error>
                  }
                </mat-form-field>

                @if (resetForm.errors?.['mismatch'] && resetForm.touched) {
                  <div class="error-banner">Passwords do not match.</div>
                }

                @if (errorMsg()) {
                  <div class="error-banner">{{ errorMsg() }}</div>
                }

                <button
                  mat-flat-button
                  color="primary"
                  type="submit"
                  class="submit-btn"
                  [disabled]="submitting() || resetForm.invalid"
                >
                  {{ submitting() ? 'Updating…' : 'Update password' }}
                </button>

                <div class="alt">
                  <button mat-button type="button" (click)="goStep1()">Use a different email</button>
                  ·
                  <a routerLink="/login">Sign in</a>
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
      @media (max-width: 900px) {
        .hero {
          display: none;
        }
      }
      .hero-inner {
        padding: 56px 64px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        justify-content: center;
        min-height: 100%;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 700;
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
      .hero h1 {
        margin: 0;
        font-size: 36px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }
      .hero p {
        margin: 0;
        opacity: 0.9;
        max-width: 460px;
        line-height: 1.5;
      }
      .card-side {
        display: grid;
        place-items: center;
        padding: 24px 16px;
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
      }
      .card-head {
        padding: 28px 28px 4px;
      }
      .card-head h2 {
        margin: 0;
        font-size: 24px;
        font-weight: 700;
      }
      .card-head p {
        margin: 6px 0 0;
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
      .readonly-email input {
        color: var(--mat-sys-on-surface-variant);
      }
      .submit-btn {
        height: 48px;
        margin-top: 8px;
      }
      .info-banner {
        margin: 16px 28px 0;
        padding: 12px 14px;
        border-radius: 10px;
        background: rgba(59, 130, 246, 0.1);
        color: var(--mat-sys-on-surface);
        font-size: 13px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .info-sub {
        font-size: 12px;
        opacity: 0.85;
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
    `,
  ],
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);

  readonly step = signal<1 | 2>(1);
  readonly emailForReset = signal('');
  readonly requestResponse = signal<ForgotPasswordResponse | null>(null);
  readonly submitting = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly showPassword2 = signal(false);

  readonly emailForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly resetForm = this.fb.nonNullable.group(
    {
      confirmation_code: ['', [Validators.required, Validators.minLength(4)]],
      new_password: ['', [Validators.required, Validators.minLength(8)]],
      confirm_password: ['', [Validators.required]],
    },
    { validators: [passwordsMatch] },
  );

  submitEmail(): void {
    if (this.emailForm.invalid) return;
    this.errorMsg.set(null);
    this.submitting.set(true);
    const email = this.emailForm.getRawValue().email;
    this.auth.forgotPassword(email).subscribe({
      next: (res) => {
        this.emailForReset.set(email);
        this.requestResponse.set(res);
        this.step.set(2);
        this.submitting.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMsg.set(err.error?.detail ?? 'Could not send reset code. Try again.');
      },
    });
  }

  submitReset(): void {
    if (this.resetForm.invalid) return;
    this.errorMsg.set(null);
    this.submitting.set(true);
    const v = this.resetForm.getRawValue();
    this.auth
      .confirmForgotPassword(this.emailForReset(), v.confirmation_code, v.new_password)
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.snack.open('Password updated. Sign in with your new password.', 'OK', {
            duration: 5000,
          });
          void this.router.navigate(['/login']);
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          this.errorMsg.set(err.error?.detail ?? 'Could not reset password.');
        },
      });
  }

  goStep1(): void {
    this.step.set(1);
    this.requestResponse.set(null);
    this.errorMsg.set(null);
    this.resetForm.reset();
  }
}

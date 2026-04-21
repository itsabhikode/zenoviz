import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TokenStorage } from '../auth/token-storage';
import {
  ApiMessageResponse,
  ForgotPasswordResponse,
  LoginTokens,
  MeResponse,
  RefreshTokenResponse,
  RegisterRequest,
  RegisterResponse,
} from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(TokenStorage);
  private readonly router = inject(Router);
  private readonly base = `${environment.apiBaseUrl}/auth`;

  readonly currentUser = signal<MeResponse | null>(null);

  /**
   * Preferred display name for the logged-in user, falling back gracefully:
   * full name → given name → email → short user id → em dash. Components read
   * this instead of `currentUser().email` so the account menu, greetings, etc.
   * all format consistently and never show a bare "—" unless we truly have
   * nothing to show.
   */
  readonly displayName = computed<string>(() => {
    const u = this.currentUser();
    if (!u) return '—';
    const given = (u.given_name ?? '').trim();
    const family = (u.family_name ?? '').trim();
    const full = `${given} ${family}`.trim();
    if (full) return full;
    if (given) return given;
    if (u.email) return u.email;
    if (u.user_id) return u.user_id.slice(0, 8);
    return '—';
  });

  readonly displayEmail = computed<string>(() => this.currentUser()?.email || '');

  login(email: string, password: string): Observable<LoginTokens> {
    return this.http.post<LoginTokens>(`${this.base}/login`, { email, password }).pipe(
      tap((res) => this.storage.setTokens(res.access_token, res.refresh_token)),
    );
  }

  register(body: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.base}/register`, body);
  }

  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(`${this.base}/forgot-password`, { email });
  }

  confirmForgotPassword(
    email: string,
    confirmationCode: string,
    newPassword: string,
  ): Observable<ApiMessageResponse> {
    return this.http.post<ApiMessageResponse>(`${this.base}/confirm-forgot-password`, {
      email,
      confirmation_code: confirmationCode,
      new_password: newPassword,
    });
  }

  logout(): void {
    const token = this.storage.accessToken;
    if (token) {
      this.http
        .post(`${this.base}/logout`, {}, { headers: { Authorization: `Bearer ${token}` } })
        .subscribe({
          next: () => this.completeLogout(),
          error: () => this.completeLogout(),
        });
    } else {
      this.completeLogout();
    }
  }

  private completeLogout(): void {
    this.storage.clear();
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  refresh(): Observable<RefreshTokenResponse> {
    const refresh = this.storage.refreshToken;
    return this.http
      .post<RefreshTokenResponse>(`${this.base}/refresh`, { refresh_token: refresh })
      .pipe(tap((res) => this.storage.setAccessToken(res.access_token)));
  }

  me(): Observable<MeResponse> {
    return this.http
      .get<MeResponse>(`${this.base}/me`)
      .pipe(tap((res) => this.currentUser.set(res)));
  }

  hasRole(role: string): boolean {
    return this.currentUser()?.roles.includes(role) ?? false;
  }
}

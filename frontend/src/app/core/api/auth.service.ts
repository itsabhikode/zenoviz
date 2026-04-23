import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, finalize, tap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ZV_OAUTH_RETURN,
  ZV_OAUTH_STATE,
  ZV_OAUTH_VERIFIER,
  buildGoogleAuthorizeUrl,
  cognitoTokenUrl,
  newOAuthState,
  newPkceVerifier,
  pkceChallengeS256,
} from '../auth/cognito-oauth';
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

  /** True when Cognito Hosted UI env vars are set so Google OAuth can run. */
  readonly googleOAuthAvailable =
    !!environment.cognitoHostedUiDomain && !!environment.cognitoAppClientId;

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

  /**
   * Starts Cognito Hosted UI with the Google identity provider (PKCE). Redirects the browser.
   */
  async startGoogleOAuth(returnTo: string | null): Promise<void> {
    if (!this.googleOAuthAvailable) return;
    const verifier = newPkceVerifier();
    const state = newOAuthState();
    sessionStorage.setItem(ZV_OAUTH_VERIFIER, verifier);
    sessionStorage.setItem(ZV_OAUTH_STATE, state);
    if (returnTo) {
      sessionStorage.setItem(ZV_OAUTH_RETURN, returnTo);
    } else {
      sessionStorage.removeItem(ZV_OAUTH_RETURN);
    }
    const challenge = await pkceChallengeS256(verifier);
    const url = buildGoogleAuthorizeUrl({
      hostedUiDomain: environment.cognitoHostedUiDomain,
      clientId: environment.cognitoAppClientId,
      redirectUri: environment.oauthRedirectUri,
      codeChallenge: challenge,
      state,
      identityProvider: environment.cognitoGoogleIdentityProvider,
    });
    window.location.href = url;
  }

  /**
   * Exchanges the authorization code from `/auth/callback` for Cognito tokens (Hosted UI + PKCE).
   */
  exchangeHostedUiCode(code: string): Observable<LoginTokens> {
    if (!this.googleOAuthAvailable) {
      return throwError(() => new Error('Google sign-in is not configured'));
    }
    const verifier = sessionStorage.getItem(ZV_OAUTH_VERIFIER);
    if (!verifier) {
      return throwError(() => new Error('Sign-in session expired. Try again.'));
    }
    const tokenUrl = cognitoTokenUrl(environment.cognitoHostedUiDomain);
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: environment.cognitoAppClientId,
      code,
      redirect_uri: environment.oauthRedirectUri,
      code_verifier: verifier,
    });
    return this.http
      .post<LoginTokens>(tokenUrl, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .pipe(
        tap((res) => this.storage.setTokens(res.access_token, res.refresh_token)),
        finalize(() => {
          sessionStorage.removeItem(ZV_OAUTH_VERIFIER);
          sessionStorage.removeItem(ZV_OAUTH_STATE);
        }),
      );
  }

  /** Path to navigate after OAuth success (from login/register `returnTo`). */
  consumeOAuthReturnPath(): string | null {
    const path = sessionStorage.getItem(ZV_OAUTH_RETURN);
    sessionStorage.removeItem(ZV_OAUTH_RETURN);
    return path;
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

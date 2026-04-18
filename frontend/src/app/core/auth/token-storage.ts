import { Injectable } from '@angular/core';

const ACCESS_KEY = 'zv.access_token';
const REFRESH_KEY = 'zv.refresh_token';

@Injectable({ providedIn: 'root' })
export class TokenStorage {
  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  setTokens(access: string, refresh?: string | null): void {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) {
      localStorage.setItem(REFRESH_KEY, refresh);
    }
  }

  setAccessToken(access: string): void {
    localStorage.setItem(ACCESS_KEY, access);
  }

  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }
}

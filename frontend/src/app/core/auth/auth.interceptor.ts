import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../api/auth.service';
import { TokenStorage } from './token-storage';

/** Paths that must never be retried with a refreshed token to avoid infinite loops. */
const NO_RETRY_PATHS = ['/auth/login', '/auth/refresh', '/auth/register'];

function _isNoRetry(url: string): boolean {
  return NO_RETRY_PATHS.some((p) => url.includes(p));
}

function _doLogout(storage: TokenStorage, router: Router): void {
  storage.clear();
  if (router.url !== '/login') {
    router.navigate(['/login'], { queryParams: { returnTo: router.url } });
  }
}

function _withBearer(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const storage = inject(TokenStorage);
  const router = inject(Router);
  const auth = inject(AuthService);

  const token = storage.accessToken;
  const authed = token ? _withBearer(req, token) : req;

  return next(authed).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || _isNoRetry(req.url)) {
        return throwError(() => err);
      }

      const refresh = storage.refreshToken;
      if (!refresh) {
        _doLogout(storage, router);
        return throwError(() => err);
      }

      // Attempt a silent token refresh, then replay the original request once.
      return auth.refresh().pipe(
        switchMap((res) => {
          const retried = _withBearer(req, res.access_token);
          return next(retried);
        }),
        catchError(() => {
          _doLogout(storage, router);
          return throwError(() => err);
        }),
      );
    }),
  );
};

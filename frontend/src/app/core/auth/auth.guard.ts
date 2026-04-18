import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthService } from '../api/auth.service';
import { TokenStorage } from './token-storage';

export const authGuard: CanActivateFn = (_route, state) => {
  const storage = inject(TokenStorage);
  const router = inject(Router);

  if (!storage.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnTo: state.url } });
  }
  return true;
};

export const adminGuard: CanActivateFn = (_route, state) => {
  const storage = inject(TokenStorage);
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!storage.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnTo: state.url } });
  }

  if (auth.currentUser()?.roles.includes('admin')) {
    return true;
  }

  return auth.me().pipe(
    map((me) =>
      me.roles.includes('admin') ? true : router.createUrlTree(['/app/my-bookings']),
    ),
    catchError(() => of(router.createUrlTree(['/app/my-bookings']))),
  );
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { BookingsService } from '../api/bookings.service';
import { hasBlockingBooking } from './booking-rules';
import { UserBookingPolicyService } from './user-booking-policy.service';

/** Blocks `/app/book` when the user already has an active reservation (edit only). */
export const bookRouteGuard: CanActivateFn = () => {
  const api = inject(BookingsService);
  const router = inject(Router);
  const policy = inject(UserBookingPolicyService);

  return api.mine().pipe(
    map((list) => {
      policy.setFromBookings(list);
      if (hasBlockingBooking(list)) {
        return router.createUrlTree(['/app/my-bookings'], {
          queryParams: { notice: 'one-booking' },
        });
      }
      return true;
    }),
    catchError(() => of(true)),
  );
};

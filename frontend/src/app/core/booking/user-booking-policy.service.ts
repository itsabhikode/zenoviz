import { Injectable, inject, signal } from '@angular/core';

import { BookingsService } from '../api/bookings.service';
import { BookingResponse } from '../api/models';
import { hasBlockingBooking } from './booking-rules';

/**
 * Tracks whether the signed-in user may open "Book a seat" or must only edit
 * an existing reservation (one active booking at a time).
 */
@Injectable({ providedIn: 'root' })
export class UserBookingPolicyService {
  private readonly api = inject(BookingsService);

  readonly blocksNewBooking = signal(false);

  setFromBookings(bookings: readonly BookingResponse[]): void {
    this.blocksNewBooking.set(hasBlockingBooking(bookings));
  }

  refreshFromApi(): void {
    this.api.mine().subscribe({
      next: (list) => this.setFromBookings(list),
      error: () => this.blocksNewBooking.set(false),
    });
  }
}

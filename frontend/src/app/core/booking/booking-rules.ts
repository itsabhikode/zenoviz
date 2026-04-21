import { BookingResponse } from '../api/models';

/** Local calendar date YYYY-MM-DD (user's browser). */
export function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * True if this booking counts as the user's single active reservation — they must
 * use Edit instead of creating another booking.
 */
export function bookingBlocksNewReservation(
  b: BookingResponse,
  todayIso: string,
): boolean {
  if (b.status === 'RESERVED' || b.status === 'PAYMENT_PENDING') {
    return true;
  }
  if (b.status === 'COMPLETED') {
    return b.end_date >= todayIso;
  }
  return false;
}

export function hasBlockingBooking(
  bookings: readonly BookingResponse[],
  todayIso: string = todayIsoLocal(),
): boolean {
  return bookings.some((b) => bookingBlocksNewReservation(b, todayIso));
}

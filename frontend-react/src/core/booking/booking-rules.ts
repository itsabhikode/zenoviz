import type { BookingResponse } from '@/core/api/models'

export function todayIsoLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function bookingBlocksNewReservation(b: BookingResponse, todayIso: string): boolean {
  if (b.status === 'RESERVED' || b.status === 'PAYMENT_PENDING') return true
  if (b.status === 'COMPLETED') return b.end_date >= todayIso
  return false
}

export function hasBlockingBooking(
  bookings: readonly BookingResponse[],
  todayIso: string = todayIsoLocal(),
): boolean {
  return bookings.some((b) => bookingBlocksNewReservation(b, todayIso))
}

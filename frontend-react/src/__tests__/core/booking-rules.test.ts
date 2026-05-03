import { describe, it, expect } from 'vitest'
import { bookingBlocksNewReservation, hasBlockingBooking } from '@/core/booking/booking-rules'
import type { BookingResponse } from '@/core/api/models'

function makeBooking(overrides: Partial<BookingResponse>): BookingResponse {
  return {
    id: 'test-id',
    user_id: 'user-1',
    seat_id: 1,
    start_date: '2026-01-01',
    end_date: '2026-01-31',
    access_type: 'anytime',
    start_time: '09:00',
    end_time: '18:00',
    category: 'MONTHLY',
    duration_days: 30,
    status: 'COMPLETED',
    reserved_until: null,
    final_price: '3000',
    paid_amount: '3000',
    amount_due: '0',
    with_locker: false,
    breakdown: {
      category: 'MONTHLY',
      access_type: 'anytime',
      duration_days: '30',
      per_day_rate: '100',
      base: '3000',
      locker_per_day: '0',
      locker_fee: '0',
      total: '3000',
    },
    payment_proof_path: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: null,
    ...overrides,
  }
}

const TODAY = '2026-05-03'

describe('bookingBlocksNewReservation', () => {
  it('RESERVED status always blocks', () => {
    const b = makeBooking({ status: 'RESERVED', end_date: '2025-01-01' })
    expect(bookingBlocksNewReservation(b, TODAY)).toBe(true)
  })

  it('PAYMENT_PENDING status always blocks', () => {
    const b = makeBooking({ status: 'PAYMENT_PENDING', end_date: '2025-01-01' })
    expect(bookingBlocksNewReservation(b, TODAY)).toBe(true)
  })

  it('COMPLETED with future end_date blocks', () => {
    const b = makeBooking({ status: 'COMPLETED', end_date: '2026-06-01' })
    expect(bookingBlocksNewReservation(b, TODAY)).toBe(true)
  })

  it('COMPLETED with end_date equal to today blocks', () => {
    const b = makeBooking({ status: 'COMPLETED', end_date: TODAY })
    expect(bookingBlocksNewReservation(b, TODAY)).toBe(true)
  })

  it('COMPLETED with past end_date does not block', () => {
    const b = makeBooking({ status: 'COMPLETED', end_date: '2026-01-01' })
    expect(bookingBlocksNewReservation(b, TODAY)).toBe(false)
  })

  it('EXPIRED does not block', () => {
    const b = makeBooking({ status: 'EXPIRED', end_date: '2026-06-01' })
    expect(bookingBlocksNewReservation(b, TODAY)).toBe(false)
  })

  it('REJECTED does not block', () => {
    const b = makeBooking({ status: 'REJECTED', end_date: '2026-06-01' })
    expect(bookingBlocksNewReservation(b, TODAY)).toBe(false)
  })
})

describe('hasBlockingBooking', () => {
  it('returns false for empty list', () => {
    expect(hasBlockingBooking([], TODAY)).toBe(false)
  })

  it('returns true when list has one blocking booking', () => {
    const bookings = [makeBooking({ status: 'RESERVED' })]
    expect(hasBlockingBooking(bookings, TODAY)).toBe(true)
  })

  it('returns false when all bookings are non-blocking', () => {
    const bookings = [
      makeBooking({ status: 'EXPIRED' }),
      makeBooking({ status: 'REJECTED' }),
      makeBooking({ status: 'COMPLETED', end_date: '2025-12-31' }),
    ]
    expect(hasBlockingBooking(bookings, TODAY)).toBe(false)
  })

  it('returns true when mixed — one blocking among non-blocking', () => {
    const bookings = [
      makeBooking({ status: 'EXPIRED' }),
      makeBooking({ status: 'PAYMENT_PENDING' }),
    ]
    expect(hasBlockingBooking(bookings, TODAY)).toBe(true)
  })
})

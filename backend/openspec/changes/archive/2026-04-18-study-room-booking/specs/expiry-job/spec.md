## ADDED Requirements

### Requirement: Expired reservations are automatically released

The system SHALL run a background loop that periodically identifies `RESERVED` bookings whose `reserved_until` timestamp is in the past, marks them `EXPIRED`, and deletes their seat slot rows so the seat can be rebooked.

#### Scenario: Overdue reservation is expired and seat released

- **WHEN** a booking has status `reserved` and `reserved_until < now`
- **THEN** the expiry job transitions it to `expired`, sets `reserved_until` to null, and deletes the associated `seat_booking_days` rows

#### Scenario: Already-paid booking is not expired

- **WHEN** a booking has status `payment_pending` or `completed`
- **THEN** the expiry job does not modify it regardless of the `reserved_until` value

#### Scenario: Job is safe to run multiple times

- **WHEN** the expiry job runs on a booking it has already marked `expired`
- **THEN** the booking is not modified again (idempotent — status filter excludes already-expired bookings)

#### Scenario: Seat becomes available after expiry

- **WHEN** an expiry job has run and marked a reservation as `expired`
- **THEN** a subsequent availability check for the same seat, dates, and access type returns `available: true`

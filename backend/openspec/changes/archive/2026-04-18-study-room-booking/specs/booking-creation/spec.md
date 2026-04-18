## ADDED Requirements

### Requirement: User can create an atomic, concurrency-safe booking

The system SHALL accept a booking creation request from an authenticated user, acquire a row-level lock on the seat record, re-verify availability inside the transaction, persist the booking and slot rows atomically, freeze the price at creation time, and return a `RESERVED` booking with a `reserved_until` timestamp.

#### Scenario: Successful booking creation

- **WHEN** `POST /study-room/bookings` is called with a valid and available seat/date-range/access combination
- **THEN** the system returns HTTP 201 with status `reserved`, a UUID booking id, `final_price`, `breakdown`, and `reserved_until` = now + active config `reservation_timeout_minutes`

#### Scenario: Double-booking rejected under concurrency

- **WHEN** two concurrent requests attempt to book the same seat, date, and timeslot
- **THEN** exactly one succeeds with HTTP 201; the other receives HTTP 400 indicating unavailability

#### Scenario: ANYTIME booking blocks all subsequent timeslot bookings

- **WHEN** a seat is booked as ANYTIME for a date
- **THEN** any attempt to book a TIMESLOT for the same seat and date returns HTTP 400

#### Scenario: Partial availability rejects the full booking

- **WHEN** a booking covers 3 days but the seat is unavailable on the second day
- **THEN** the system returns HTTP 400 and no booking is created

#### Scenario: Price is captured at booking time

- **WHEN** a booking is created and the admin subsequently changes the pricing configuration
- **THEN** the booking's `final_price` and `breakdown` remain unchanged

#### Scenario: Past start date rejected

- **WHEN** start_date is before today (UTC)
- **THEN** the system returns HTTP 400

#### Scenario: Missing timeslot_index for TIMESLOT booking

- **WHEN** access_type is `timeslot` and `timeslot_index` is absent
- **THEN** the system returns HTTP 400

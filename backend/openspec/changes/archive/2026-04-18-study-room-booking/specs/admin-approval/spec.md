## ADDED Requirements

### Requirement: Admin can approve or reject a payment-pending booking

The system SHALL allow an admin (identified by `X-Admin-Api-Key` header) to approve or reject a booking that is in `PAYMENT_PENDING` status. Approval transitions the booking to `COMPLETED`. Rejection transitions it to `REJECTED` and releases the seat slots so the seat can be rebooked.

#### Scenario: Admin lists pending payment bookings

- **WHEN** `GET /admin/study-room/bookings/pending-payments` is called with a valid admin key
- **THEN** the system returns HTTP 200 with a list of all `PAYMENT_PENDING` bookings in ascending creation order

#### Scenario: Admin approves a payment

- **WHEN** `POST /admin/study-room/bookings/{id}/approve` is called with a valid admin key for a `PAYMENT_PENDING` booking
- **THEN** the system returns HTTP 200, booking status is `completed`, and seat slots remain locked

#### Scenario: Admin rejects a payment

- **WHEN** `POST /admin/study-room/bookings/{id}/reject` is called with a valid admin key for a `PAYMENT_PENDING` booking
- **THEN** the system returns HTTP 200, booking status is `rejected`, and the seat slots are deleted so the seat is available again

#### Scenario: Approval rejected for wrong status

- **WHEN** the booking is not in `payment_pending` status
- **THEN** the system returns HTTP 400

#### Scenario: Missing or invalid admin key

- **WHEN** the `X-Admin-Api-Key` header is absent or does not match the configured key
- **THEN** the system returns HTTP 403

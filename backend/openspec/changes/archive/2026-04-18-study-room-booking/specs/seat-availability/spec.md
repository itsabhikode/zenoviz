## ADDED Requirements

### Requirement: User can check seat availability with a price preview

The system SHALL accept an availability check request for a specific seat, date range, and access type; determine the booking category from the duration; compute the price from the active pricing configuration; and report whether the seat is available for the entire range.

#### Scenario: Seat is fully available for timeslot

- **WHEN** `POST /study-room/availability` is called with a valid seat_id, start_date ≤ end_date, both in the future, access_type `timeslot`, and a valid timeslot_index
- **THEN** the system returns HTTP 200 with `available: true`, `category` (daily/weekly/monthly), `duration_days`, `final_price`, and a full `breakdown` object

#### Scenario: Seat has a conflicting timeslot booking

- **WHEN** the same seat already has a `TIMESLOT` booking for the same timeslot_index on at least one date in the range
- **THEN** the system returns HTTP 200 with `available: false` and a non-null `reason`

#### Scenario: ANYTIME booking blocks all timeslots on a date

- **WHEN** the seat has an `ANYTIME` booking on any date in the requested range and the request is for a TIMESLOT
- **THEN** the system returns HTTP 200 with `available: false`

#### Scenario: Missing timeslot_index for TIMESLOT access

- **WHEN** access_type is `timeslot` and `timeslot_index` is absent
- **THEN** the system returns HTTP 400

#### Scenario: timeslot_index provided for ANYTIME access

- **WHEN** access_type is `anytime` and `timeslot_index` is present
- **THEN** the system returns HTTP 400

#### Scenario: start_date is in the past

- **WHEN** start_date is before today (UTC)
- **THEN** the system returns HTTP 400

#### Scenario: end_date is before start_date

- **WHEN** end_date < start_date
- **THEN** the system returns HTTP 400

#### Scenario: Category boundary at 7 days

- **WHEN** duration_days is 7 (end_date = start_date + 6)
- **THEN** category is `weekly` (not `daily`)

#### Scenario: No active pricing configuration

- **WHEN** no pricing configuration with `is_active = true` exists
- **THEN** the system returns HTTP 400

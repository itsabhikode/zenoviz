## ADDED Requirements

### Requirement: Admin can manage the active pricing configuration

The system SHALL allow an admin to replace the active pricing configuration with new values. Only one configuration SHALL be active at a time. The new configuration takes effect immediately for new bookings; existing bookings are unaffected.

#### Scenario: Admin updates pricing

- **WHEN** `PUT /admin/study-room/pricing` is called with a valid admin key and a complete pricing body
- **THEN** the system returns HTTP 200 with the new active configuration; all previous configurations are deactivated

#### Scenario: Admin reads active pricing

- **WHEN** `GET /admin/study-room/pricing` is called with a valid admin key
- **THEN** the system returns HTTP 200 with the currently active pricing configuration

#### Scenario: Pricing body with invalid discount percent

- **WHEN** any `*_discount_percent` or `anytime_surcharge_percent` is negative or greater than 100
- **THEN** the system returns HTTP 422

#### Scenario: Pricing body with invalid reservation timeout

- **WHEN** `reservation_timeout_minutes` is less than 1 or greater than 10080 (7 days)
- **THEN** the system returns HTTP 422

#### Scenario: Price breakdown formula

- **WHEN** a booking is created under an active pricing config
- **THEN** `discounted_price = base_price - (base_price * discount_percent / 100)`, `surcharge = discounted_price * anytime_surcharge_percent / 100` (0 for TIMESLOT), `final_price = discounted_price + surcharge`, all rounded to 2 decimal places

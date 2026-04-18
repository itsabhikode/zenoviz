## 1. Project Setup

- [x] 1.1 Add `aiosqlite`, `asyncpg`, `greenlet`, `python-multipart` to `pyproject.toml` and run `uv sync`
- [x] 1.2 Create `src/config/app_settings.py` with `AppSettings` (DATABASE_URL, ADMIN_API_KEY, PAYMENT_UPLOAD_DIR, BOOKING_EXPIRY_INTERVAL_SECONDS, MAX_PAYMENT_PROOF_BYTES)
- [x] 1.3 Create `src/db/base.py` with `DeclarativeBase`
- [x] 1.4 Create `src/db/session.py` with `init_engine`, `create_tables`, `get_session` (one-transaction-per-request), `get_async_session_maker`
- [x] 1.5 Add `tests/conftest.py` forcing `DATABASE_URL=sqlite+aiosqlite:///:memory:` so tests never require Postgres

## 2. ORM Models

- [x] 2.1 Create `src/models/orm/study_room.py` with `Seat`, `PricingConfig`, `Booking`, `SeatBookingDay` ORM models
- [x] 2.2 Add `UNIQUE(seat_id, booking_date, slot_key)` constraint on `SeatBookingDay` as double-booking safety net
- [x] 2.3 Define `BookingStatus` enum with `RESERVED`, `PAYMENT_PENDING`, `COMPLETED`, `REJECTED`, `EXPIRED` values

## 3. Domain Layer

- [x] 3.1 Create `src/domain/study_room_rules.py` with `duration_days`, `category_for_duration`, `iter_booking_dates`, `slot_keys_for_booking`, `expand_day_slot_rows`
- [x] 3.2 Create `src/domain/study_pricing.py` with `PricingConfigSnapshot`, `compute_stored_breakdown` implementing the discount → surcharge → final price formula

## 4. Repository Layer

- [x] 4.1 Create `src/repositories/study_repository.py` with `AbstractStudyRepository` ABC
- [x] 4.2 Create `src/repositories/impl/study_repository_sqlalchemy.py` with `SqlAlchemyStudyRepository`
- [x] 4.3 Implement `lock_seat_row` using `SELECT … FOR UPDATE` for concurrency safety
- [x] 4.4 Implement `load_booked_slots` returning `{date: set[slot_key]}`
- [x] 4.5 Implement `expire_reserved_past` atomically updating `RESERVED → EXPIRED` and deleting `SeatBookingDay` rows
- [x] 4.6 Implement `seed_if_empty` to create 65 seats and a default pricing config on first startup

## 5. Service Layer

- [x] 5.1 Create `src/services/booking_service.py` with `BookingService`
- [x] 5.2 Implement `check_availability` (no write; reads pricing + slots, returns price preview)
- [x] 5.3 Implement `create_booking` (lock seat → check conflicts → insert Booking + SeatBookingDay rows)
- [x] 5.4 Implement `upload_payment_proof` (validate file, write to disk, set `PAYMENT_PENDING`)
- [x] 5.5 Implement `approve_payment` (set `COMPLETED`)
- [x] 5.6 Implement `reject_payment` (delete slot rows, set `REJECTED`)
- [x] 5.7 Implement `update_pricing` (deactivate all, insert new active config)

## 6. API Models

- [x] 6.1 Create `src/models/study_api.py` with `AvailabilityCheckRequest`, `AvailabilityCheckResponse`, `CreateBookingRequest`, `BookingResponse`, `UpdatePricingRequest`, `PricingConfigResponse`, `RejectPaymentBody`

## 7. Routes

- [x] 7.1 Create `src/routes/bookings.py` with user routes: `POST /study-room/availability`, `POST /study-room/bookings`, `POST /study-room/bookings/{id}/payment-proof`, `GET /study-room/bookings`
- [x] 7.2 Create `src/routes/admin_study.py` with admin routes: `GET /admin/study-room/bookings/pending-payments`, `POST .../approve`, `POST .../reject`, `PUT/GET /admin/study-room/pricing`

## 8. Dependency Injection

- [x] 8.1 Add `get_app_settings`, `get_study_repo`, `get_booking_service` DI providers to `src/dependencies.py`
- [x] 8.2 Add `require_admin_key` dependency that validates `X-Admin-Api-Key` header

## 9. Application Lifespan & Background Job

- [x] 9.1 Update `src/main.py` with `lifespan` context manager: init engine, create tables, seed, start expiry task
- [x] 9.2 Create `src/jobs/expiry.py` with `expiry_background_loop` and `run_expire_reserved_once`

## 10. Tests

- [x] 10.1 Write `tests/study/test_domain_study.py` covering duration boundaries, category assignment, and pricing formula
- [x] 10.2 Write `tests/study/test_booking_flow.py` covering: availability → booking, ANYTIME blocks TIMESLOT, validation errors, payment → admin approve, admin reject (seat released), expiry job, pricing update

## 11. Code Quality

- [ ] 11.1 Remove inline imports inside functions (`src/main.py`, `src/db/session.py`, `src/dependencies.py`)
- [ ] 11.2 Remove direct `session.flush()` calls from `BookingService` — session is managed by the DI layer; services must only call repository methods
- [ ] 11.3 Run full test suite and confirm 0 failures

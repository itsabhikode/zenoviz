## Why

The application has user authentication but no way for authenticated users to book seats in a study room. A complete booking backend is needed that enforces availability, captures payments, and lets admins approve or reject them—all concurrency-safe and with admin-controlled pricing.

## What Changes

- Add async SQLAlchemy database layer (engine, session, ORM base, SQLite/Postgres support)
- Add `seats`, `pricing_configs`, `bookings`, and `seat_booking_days` ORM models
- Add domain rules for duration-based category assignment, slot conflict detection, and pricing computation
- Add `AbstractStudyRepository` ABC + SQLAlchemy implementation
- Add `BookingService` orchestrating availability checks, atomic booking creation, payment upload, and admin actions
- Add user routes: `POST /study-room/availability`, `POST /study-room/bookings`, `POST /study-room/bookings/{id}/payment-proof`, `GET /study-room/bookings`
- Add admin routes: `GET /admin/study-room/bookings/pending-payments`, `POST .../approve`, `POST .../reject`, `PUT/GET /admin/study-room/pricing`
- Add background expiry job that periodically marks timed-out `RESERVED` bookings as `EXPIRED` and releases their seat slots
- Seed 65 seats and a default pricing config on first startup

## Capabilities

### New Capabilities

- `seat-availability`: Check whether a seat is free for a date range and access type; returns price breakdown
- `booking-creation`: Atomically reserve a seat for a date range, storing a price snapshot; returns `RESERVED` status with `reserved_until`
- `payment-proof`: Allow a user to upload an image proving payment, transitioning booking to `PAYMENT_PENDING`
- `admin-approval`: Admin can approve (→ `COMPLETED`) or reject (→ `REJECTED`, seat released) a pending-payment booking
- `pricing-config`: Admin can replace the active pricing configuration (base prices, discounts, anytime surcharge, reservation timeout)
- `expiry-job`: Background loop that expires overdue `RESERVED` bookings and releases their seat slots

### Modified Capabilities

## Impact

- **New dependencies**: `aiosqlite`, `asyncpg`, `greenlet`, `python-multipart` added to `pyproject.toml`
- **New env vars**: `DATABASE_URL`, `ADMIN_API_KEY`, `PAYMENT_UPLOAD_DIR`, `BOOKING_EXPIRY_INTERVAL_SECONDS`
- **New files**: `src/config/app_settings.py`, `src/db/base.py`, `src/db/session.py`, `src/models/orm/study_room.py`, `src/models/study_api.py`, `src/domain/study_room_rules.py`, `src/domain/study_pricing.py`, `src/repositories/study_repository.py`, `src/repositories/impl/study_repository_sqlalchemy.py`, `src/services/booking_service.py`, `src/routes/bookings.py`, `src/routes/admin_study.py`, `src/jobs/expiry.py`
- **Modified files**: `src/main.py` (lifespan, router registration), `src/dependencies.py` (new DI providers), `tests/conftest.py` (force in-memory SQLite for tests)
- **Storage**: Payment proof images stored on disk under `PAYMENT_UPLOAD_DIR`

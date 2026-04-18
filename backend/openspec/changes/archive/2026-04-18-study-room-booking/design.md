## Context

Zenoviz is a Python 3.13 / FastAPI service. Authentication via AWS Cognito is already in place; every request carries a validated `CurrentUser`. The booking system adds a relational data layer (SQLAlchemy 2 async) on top, using either SQLite (dev/test) or Postgres (production) without changing the auth layer.

There are 65 fixed seats, 8 timeslots per seat per day, and an ANYTIME access type that blocks an entire day. Concurrency is the principal risk: two simultaneous requests must not double-book the same slot.

## Goals / Non-Goals

**Goals:**
- Atomic, concurrency-safe booking creation using a SELECT FOR UPDATE row lock on the seat record
- Admin-controlled pricing with the computed price snapshot frozen at booking time (never recomputed)
- Full booking lifecycle: `RESERVED` → `PAYMENT_PENDING` → `COMPLETED` or `REJECTED`, with automatic `EXPIRED` transition for timed-out reservations
- Background expiry job that is safe to run multiple times (idempotent via status filter)
- Clean layered architecture: domain → repository ABC → SQLAlchemy impl → service → route

**Non-Goals:**
- Real-time seat map UI
- Email notifications on booking events
- Alembic migration files (tables created via `create_all` at startup; Alembic is a future concern)
- Multi-seat (group) bookings in a single transaction

## Decisions

**D1 — Row-level lock via `SELECT … FOR UPDATE` on `seats`**
Each `create_booking` request acquires a write lock on the target `Seat` row before querying `seat_booking_days`. This prevents two concurrent requests from both observing an empty slot and both inserting. Alternative considered: optimistic locking (version column + retry). Rejected because it shifts retry complexity to the caller and gives a worse UX (conflict error after work).

**D2 — `seat_booking_days` uniqueness constraint as the last safety net**
`UNIQUE(seat_id, booking_date, slot_key)` at the database level means even if the application-level lock is bypassed (e.g., a bug), the database will reject the second insert with an `IntegrityError`. The application converts this to HTTP 409.

**D3 — One transaction per HTTP request via `get_session` dependency**
`get_session` wraps `session.begin()` so the entire request is one transaction that commits on clean exit and rolls back on exception. Services must never call `session.begin()` themselves — they operate inside the already-open transaction. This keeps the transaction boundary at the DI layer, not scattered through service code.

**D4 — Price snapshot stored as JSON at booking creation; never recomputed**
`Booking.price_breakdown` (JSON column) captures the full pricing arithmetic at the moment of booking. `Booking.final_price` is a `NUMERIC(12,2)` copy of the final value for queries. If pricing config changes, existing bookings are unaffected.

**D5 — `ANYTIME` uses a single sentinel slot key `"ANYTIME"`; timeslots use `"0"`–`"7"`**
Availability conflict logic: an ANYTIME booking conflicts with any existing row for the seat/date. A TIMESLOT booking conflicts with an ANYTIME row or the same timeslot index. This is enforced in both the application layer (`_slots_conflict`) and implicitly by the unique constraint.

**D6 — Admin key via `X-Admin-Api-Key` header**
Simple and stateless for now. The key lives in `AppSettings` (env var). Alternative: a Cognito group claim. Rejected for this phase because it requires Cognito group setup and complicates the DI graph; can be added later without breaking the route interface.

**D7 — SQLite for dev/test, Postgres for production**
`DATABASE_URL` in `.env` selects the driver. Tests force `sqlite+aiosqlite:///:memory:` via `conftest.py` so they never require a running database. The `FOR UPDATE` lock silently degrades on SQLite (no row-level locking), which is acceptable for unit tests where concurrency is not exercised.

## Risks / Trade-offs

- **SQLite `FOR UPDATE` is a no-op** → Production on Postgres is needed for true concurrency safety. Tests cover the logic path but not the lock itself.
- **Payment proofs stored on local disk** → Lost if the container restarts without a volume mount. Mitigation: move to S3/object storage as a follow-up; the `payment_proof_path` column stores an opaque path that can be switched to a URL.
- **`create_all` at startup** → Fine for early development; must be replaced with Alembic migrations before the first schema-breaking change in production.
- **Single expiry loop per process** → If multiple server processes run, each will run the expiry job. The `FOR UPDATE` (Postgres) / status filter prevents double-expiry, but each process incurs the DB round-trip overhead.

## Open Questions

- Should rejected bookings allow the user to rebook immediately, or enforce a cool-down period? (Current implementation: immediate rebook is allowed.)
- Should the admin pricing update be validated against existing `RESERVED` bookings to warn if timeout changes would immediately expire them? (Current: no warning.)

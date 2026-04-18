# User Registration with Postgres Persistence — Design

**Date:** 2026-04-18
**Status:** Approved

## Problem

The `/auth/register` endpoint only passes `email` and `password` to Cognito, which fails
because the User Pool requires `name.givenName`, `name.familyName`, `phoneNumbers`, and
`aws:cognito:system.gender`. Additionally, user profile data has no local persistence —
Cognito is the only store, making it the implicit source of truth for data that should
live in our own system.

## Goal

1. Fix the Cognito `InvalidParameterException` by passing all required attributes on sign-up.
2. Introduce Postgres 17 as the source of truth for user profiles, linked to Cognito by `cognito_sub`.

## Architecture

- **Cognito** handles auth only: email/password sign-up, email verification, token issuance.
  It stores the 4 required attributes to satisfy pool schema constraints.
- **Postgres 17** (Docker) is the source of truth for user profiles.
  The `users` table is keyed on `cognito_sub` (UUID returned by Cognito `sign_up`).
- `RegisterRequest` is extended with `given_name`, `family_name`, `phone_number`, `gender`.
- `AuthService.register` follows a DB-first dual-write: write user row first (within an open
  async session), then call Cognito. SQLAlchemy rolls back automatically if Cognito fails.
  Cognito's `UserSub` is captured and stored as `cognito_sub` before the session commits.

## Data Model

### `users` table

| column         | type                              | constraints                      |
|----------------|-----------------------------------|----------------------------------|
| `id`           | UUID                              | PK, generated server-side        |
| `cognito_sub`  | UUID                              | UNIQUE NOT NULL                  |
| `email`        | VARCHAR                           | UNIQUE NOT NULL                  |
| `given_name`   | VARCHAR                           | NOT NULL                         |
| `family_name`  | VARCHAR                           | NOT NULL                         |
| `phone_number` | VARCHAR                           | NOT NULL                         |
| `gender`       | ENUM(`male`, `female`, `other`)   | NOT NULL, Postgres native enum   |
| `created_at`   | TIMESTAMPTZ                       | NOT NULL, server default `now()` |
| `updated_at`   | TIMESTAMPTZ                       | NOT NULL, server default `now()`, updated on every write |

### `Gender` enum

Defined as a Python `enum.Enum` in `src/domain/user.py` and mirrored as a Postgres native
enum via SQLAlchemy `Enum(Gender)` in the ORM model.

## Registration Flow

```
POST /auth/register
  → RegisterRequest(email, password, given_name, family_name, phone_number, gender)
  → AuthService.register(request)
      1. Open async DB session
      2. Construct User ORM object (cognito_sub not yet known)
      3. session.add(user)  ← pending, not committed
      4. CognitoClient.register(email, password, given_name, family_name, phone_number, gender)
           → Cognito returns UserSub
      5. user.cognito_sub = UserSub
      6. session.commit()
  → MessageResponse("Registration successful. Please check your email to verify your account.")
```

On failure at step 4 or 6 → session rolls back, no partial state in DB.

## Error Handling

| Failure                              | Behaviour                                                       |
|--------------------------------------|-----------------------------------------------------------------|
| Cognito `UsernameExistsException`    | `ValueError("Email already registered")` → HTTP 409            |
| Cognito attribute / schema error     | `ClientError` bubbles → HTTP 500                               |
| DB unique violation on email         | `IntegrityError` caught in service → `ValueError` → HTTP 409   |
| DB commit failure after Cognito ok   | Session rolls back; Cognito account exists but is unverified — user retries cleanly |

## New / Changed Files

### New
- `docker-compose.yml` — Postgres 17 service
- `src/models/user.py` — SQLAlchemy ORM `User` model + `Gender` enum column type
- `src/repositories/impl/user.py` — `UserRepository(AbstractUserRepository)`
- `alembic.ini` + `alembic/` — migration scaffolding
- `alembic/versions/001_create_users_table.py` — initial migration

### Changed
- `src/domain/user.py` — add `Gender(enum.Enum)` value object
- `src/models/auth.py` — add `given_name`, `family_name`, `phone_number`, `gender` to `RegisterRequest`
- `src/clients/base.py` — update `AbstractCognitoClient.register` signature
- `src/clients/impl/cognito.py` — pass `UserAttributes` to Cognito `sign_up`; capture and return `UserSub`
- `src/repositories/base.py` — add `AbstractUserRepository` ABC with `create` method
- `src/services/auth_service.py` — accept `AbstractUserRepository`; orchestrate DB write + Cognito call
- `src/dependencies.py` — add async DB session factory, `get_user_repository`, update `get_auth_service`

## Testing

- `tests/clients/test_cognito_client.py` — extend mock tests to assert `UserAttributes` shape; assert `UserSub` is returned
- `tests/services/test_auth_service.py` — mock `AbstractCognitoClient` + `AbstractUserRepository`; assert DB write precedes Cognito call; assert rollback path on Cognito failure
- `tests/routes/test_auth_routes.py` — extend existing route tests for new required request fields

## Infrastructure

`docker-compose.yml` exposes Postgres 17 on `localhost:5432`. Connection string read from `.env`
via `DATABASE_URL`. `CognitoSettings` is extended (or a separate `DatabaseSettings` added) to
include `database_url`. SQLAlchemy async engine uses `asyncpg` driver.

# Zenoviz — Study Room Booking System

A full-stack study room booking platform. Members reserve seats by time slot or full day/week/month, upload UPI payment proofs, and admins approve or reject payments. Built with FastAPI + Angular.

```
zenoviz/
├── backend/        FastAPI · SQLAlchemy 2 · AWS Cognito · Python 3.13
├── frontend/       Angular 19 · Angular Material · TypeScript strict
├── docs/           Design docs and specs
└── CLAUDE.md       Project constitution
```

---

## Features

**Members**
- Register and log in via AWS Cognito
- Check seat availability by date range, time slot, and access type
- Book a seat (timeslot or anytime); receive a price breakdown before confirming
- Edit a pending booking (date, time, seat)
- Upload a UPI payment proof screenshot to move a booking to payment-pending

**Admins**
- View all bookings and filter by status
- Approve payments (full or partial credit); reject with automatic seat release
- Manage pricing: daily / weekly / monthly base prices, discounts, surcharge, business hours
- Configure UPI payment settings and upload a QR code image
- Manage user roles (assign / revoke)
- List and inspect all Cognito users

---

## Quick start

### Backend

```bash
cd backend
uv sync
cp .env.example .env        # fill in Cognito + DB credentials
uv run uvicorn src.main:app --reload
```

API docs available at **http://localhost:8000/docs**

### Frontend

```bash
cd frontend
npm install
npm start                   # http://localhost:4200
```

The frontend proxies API calls to `http://localhost:8000` by default (configurable in `frontend/src/environments/environment.ts`).

### Both together

```bash
# Terminal 1 — backend
cd backend && uv run uvicorn src.main:app --reload

# Terminal 2 — frontend
cd frontend && npm start
```

---

## Backend environment variables

Copy `backend/.env.example` and fill in:

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLAlchemy async URL — `postgresql+asyncpg://...` for prod, `sqlite+aiosqlite:///./dev.db` for local |
| `COGNITO_USER_POOL_ID` | e.g. `us-east-1_XXXXXXXX` |
| `COGNITO_APP_CLIENT_ID` | Cognito App Client ID |
| `COGNITO_REGION` | AWS region, e.g. `us-east-1` |
| `COGNITO_JWKS_URL` | `https://cognito-idp.{region}.amazonaws.com/{pool_id}/.well-known/jwks.json` |
| `BOOTSTRAP_ADMINS` | Comma-separated Cognito emails or subs that receive the `admin` role on first login |
| `PAYMENT_UPLOAD_DIR` | Directory for payment proof images (default: `./data/payment_proofs`) |
| `PAYMENT_QR_DIR` | Directory for QR code images (default: `./data/payment_qr`) |

---

## API overview

| Prefix | Description |
|---|---|
| `POST /auth/register` | Create a new account |
| `POST /auth/login` | Obtain access + refresh tokens |
| `POST /auth/logout` | Invalidate the access token |
| `POST /auth/refresh` | Exchange a refresh token for a new access token |
| `GET  /auth/me` | Current user profile + roles |
| `POST /study-room/availability` | Check seat availability and get a price quote |
| `POST /study-room/bookings` | Create a booking |
| `PUT  /study-room/bookings/{id}` | Edit a pending booking |
| `POST /study-room/bookings/{id}/payment-proof` | Upload payment proof |
| `GET  /study-room/bookings` | List own bookings |
| `GET  /study-room/payment-settings` | Fetch UPI payment details for checkout |
| `GET  /study-room/payment-settings/qr` | Fetch QR image |
| `GET  /admin/study/bookings` | List all bookings (admin) |
| `POST /admin/study/bookings/{id}/approve` | Approve payment (full or partial) |
| `POST /admin/study/bookings/{id}/reject` | Reject and release seat |
| `PUT  /admin/study/pricing` | Update pricing config |
| `PUT  /admin/study/payment-settings` | Update UPI details |
| `POST /admin/study/payment-settings/qr` | Upload QR image |
| `GET  /admin/users` | List Cognito users |
| `POST /admin/users/{id}/roles` | Assign a role |
| `DELETE /admin/users/{id}/roles/{role}` | Revoke a role |

---

## Running tests

```bash
cd backend && uv run pytest          # 128 tests, SQLite in-memory
```

Tests mirror the `src/` folder structure under `tests/`. No real Cognito or Postgres connection required.

---

## Architecture

```
src/
  clients/        AbstractCognitoClient ABC + boto3 implementation
  domain/         Pure Python — pricing rules, booking rules, value objects
  models/         Pydantic request/response schemas + SQLAlchemy ORM models
  repositories/   ABCs + SQLAlchemy / local-filesystem implementations
  routes/         FastAPI routers — input validation and one service call only
  services/       Orchestration — calls repos and clients, owns business flow
  jobs/           Background tasks (reservation expiry)
  dependencies.py FastAPI Depends() wiring; JWT/JWKS validation
  main.py         App entry point and lifespan
```

**Rules enforced throughout:**
- Services never touch `AsyncSession` directly — all DB access via repository ABCs
- No external API calls from services — Cognito access goes through `AbstractCognitoClient`
- All file I/O goes through `AbstractStorageRepository` — services never call `Path.write_bytes()`
- Routes return Pydantic schemas, never ORM models
- Every function has a type annotation; `async def` everywhere

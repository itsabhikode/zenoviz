# Zenoviz — Project Constitution

Monorepo: `backend/` (FastAPI + Python) and `frontend/` (Angular + TS).

## Backend stack
- Python 3.13, FastAPI, SQLAlchemy 2.x, Pydantic v2
- pytest + pytest-asyncio for all tests
- Alembic for migrations
- uv for dependency management

## Frontend stack
- Angular 19 (standalone components, signals where appropriate)
- Angular Material 19
- npm, TypeScript strict mode

## Workflow (non-negotiable order)
1. New feature → /opsx:propose "idea" FIRST — no code before approval
2. Implementation → Superpowers writing-plans skill breaks tasks down
3. Every task → TDD: red (failing test) → green (implement) → refactor
4. Done → /opsx:archive to save specs

## Superpowers skills (always required)
- **brainstorming** — invoke before ANY code change, including small modifications and refactors, not just new features
- **test-driven-development** — invoke before writing any implementation code; "too simple to test" is never a valid reason to skip
- **verification-before-completion** — invoke before claiming work is done

## Backend folder structure
```
backend/src/
  routes/        # FastAPI APIRouter only — no business logic here
  services/      # Orchestration — calls repos and clients
  repositories/  # All DB access via ABCs + SQLAlchemy impls
  clients/       # All 3rd party API calls via ABCs + httpx/boto3 impls
  models/        # SQLAlchemy ORM models + Pydantic request/response schemas
  domain/        # Pure Python — entities, value objects, no I/O
  jobs/          # Background tasks
  dependencies.py  # FastAPI Depends() wiring — the DI container
backend/tests/   # Mirrors src/ structure patterns (strictly enforced)
```

### Dependency Injection
- ALL dependencies injected via __init__ constructors
- NEVER instantiate services/repos/clients inside another class
- Use FastAPI Depends() in routes to wire everything together

### Repository pattern
- Every repo has an ABC in repositories/
- SQLAlchemy implementation in repositories/impl/
- Services ONLY call repo methods — never touch Session directly

### Client pattern (3rd party APIs)
- Every external API has an ABC in clients/base.py
- Concrete implementations in clients/impl/
- NEVER call httpx/boto3 directly from services

### Domain layer
- Pure Python classes only — no SQLAlchemy, no Pydantic, no FastAPI
- Contains business entities and value objects
- No I/O of any kind

### Routes
- Only validate input (Pydantic) and call one service method
- Return Pydantic response schemas — never ORM models directly
- All dependency injection via FastAPI Depends()

## Frontend folder structure
```
frontend/src/app/
  core/
    api/         # One service per backend router, typed models
    auth/        # Token storage, interceptor, guards
    layout/      # Shell (sidenav + toolbar)
  features/
    auth/        # login, register
    bookings/    # my-bookings, create-booking
    admin/       # users, roles, pricing, payments
  app.config.ts  # Providers: router, HTTP, Material
  app.routes.ts  # Top-level route tree
```

### Frontend conventions
- **Standalone components only** — no NgModules.
- **One API service per backend router.** Never call `HttpClient` from components directly.
- **Reactive forms** for anything with more than one field.
- **Route guards** enforce auth and role (`authGuard`, `adminGuard`).
- **HTTP interceptor** injects the Cognito access token; 401 responses clear storage and route to `/login`.

## Code standards
- Type hints required on ALL Python functions/methods; TS `strict: true`
- No global mutable state
- No inline imports inside functions (Python); group/order imports consistently (TS)
- Async everywhere in backend (async def for all routes, services, repos, clients)

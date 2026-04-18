# Zenoviz — Backend

FastAPI service with AWS Cognito authentication and a PostgreSQL-backed
study-room booking domain.

## Stack

- Python 3.13, FastAPI, SQLAlchemy 2.x (async), Pydantic v2
- AWS Cognito (register, login, logout, refresh, role-based admin)
- pytest + pytest-asyncio
- uv for dependency management

## Setup

```bash
uv sync
cp .env.example .env
# fill in your Cognito + DB values
```

Required environment variables:

| Variable | Description |
|---|---|
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID (e.g. `us-east-1_XXXXXX`) |
| `COGNITO_APP_CLIENT_ID` | Cognito App Client ID |
| `COGNITO_REGION` | AWS region (e.g. `us-east-1`) |
| `COGNITO_JWKS_URL` | JWKS endpoint for token validation |
| `DATABASE_URL` | async SQLAlchemy URL (`postgresql+asyncpg://...` or `sqlite+aiosqlite:///...`) |
| `BOOTSTRAP_ADMINS` | comma-separated Cognito subs or emails that get the `admin` role on first login |

## Running

```bash
uv run uvicorn src.main:app --reload
```

API docs: http://localhost:8000/docs

## Tests

```bash
uv run pytest
```

## Structure

```
src/
  clients/       AbstractCognitoClient + boto3 implementation
  domain/        Pure Python domain objects and business rules
  models/        Pydantic request/response schemas + SQLAlchemy ORM
  repositories/  ABCs + SQLAlchemy implementations
  routes/        FastAPI routers (no business logic)
  services/      Orchestration layer
  jobs/          Background jobs (e.g. reservation expiry)
  dependencies.py  FastAPI Depends() wiring + JWT validation
  main.py        App entry point
tests/           Mirrors src/ structure
openspec/        Architecture + change specs
```

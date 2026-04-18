## Context

The application is a Python 3.13 / FastAPI service with no authentication today. All routes are public. We need to add user identity management without building credential storage, hashing, or email verification infrastructure ourselves. AWS Cognito is the chosen provider because it is already part of the team's AWS footprint and handles token signing, JWKS rotation, and email delivery natively.

The project enforces a strict layered architecture: routes call services, services call repositories and clients, and all external I/O is hidden behind ABCs. Adding Cognito must follow this same pattern.

## Goals / Non-Goals

**Goals:**
- Register, login, logout, and token-refresh via Cognito User Pools
- JWT validation at the FastAPI dependency layer (`get_current_user`) — no per-route auth logic
- A single `AbstractCognitoClient` ABC so the real httpx/boto3 implementation can be swapped for a stub in tests
- Environment-driven configuration (no secrets in source)
- Every new route and the auth dependency covered by tests (TDD)

**Non-Goals:**
- Social / federated login (Google, GitHub, etc.)
- MFA enrollment or TOTP flows
- Admin user management (create/disable users from backend)
- Migrating existing users (there are none yet)
- Custom Cognito Lambda triggers

## Decisions

### 1. Cognito API via boto3, not the HTTP REST API directly

**Decision:** Use `boto3` (`cognito-idp` client) for all Cognito calls (InitiateAuth, SignUp, GlobalSignOut, etc.).

**Rationale:** boto3 handles AWS request signing, retries, and endpoint resolution automatically. Direct HTTP would require reimplementing SigV4 signing.

**Alternative considered:** `warrant` library — unmaintained since 2021; rejected.

### 2. JWT validation via `python-jose` + JWKS endpoint

**Decision:** Validate Cognito-issued JWTs locally using `python-jose[cryptography]` and Cognito's public JWKS URL (`https://cognito-idp.<region>.amazonaws.com/<pool-id>/.well-known/jwks.json`). Keys are fetched once at startup and cached.

**Rationale:** Calling Cognito's `GetUser` API on every request adds ~50–150 ms of latency per call. Local JWT verification is O(1) after key fetch.

**Alternative considered:** `GetUser` API per request — rejected for latency; acceptable only for revocation checks.

**Revocation note:** Cognito access tokens are valid until expiry even after logout. GlobalSignOut invalidates refresh tokens. This is an accepted trade-off (standard for JWTs); session-level revocation would require a Redis blocklist (out of scope).

### 3. CognitoClient as an ABC in `clients/base.py`

**Decision:** Define `AbstractCognitoClient` with async methods (`register`, `login`, `logout`, `refresh_token`). Concrete implementation in `clients/impl/cognito.py` wraps boto3 with `asyncio.to_thread` (boto3 is sync).

**Rationale:** Follows existing project conventions; allows `FakeCognitoClient` in tests without hitting AWS.

### 4. Token delivery via response body (not cookies)

**Decision:** Return `access_token`, `refresh_token`, and `token_type` in the JSON response body on login/refresh. Client is responsible for storage.

**Rationale:** Cookie-based delivery requires CSRF handling; out of scope for this API-first service.

### 5. Protected routes use `Depends(get_current_user)`

**Decision:** A single `get_current_user` dependency in `dependencies.py` validates the `Authorization: Bearer <token>` header and returns a `CurrentUser` domain object. Routes opt in by declaring it in their signature.

**Rationale:** Consistent with FastAPI idioms; zero auth logic in route handlers.

## Risks / Trade-offs

- **Token revocation gap** → Mitigation: Short access token TTL (15 min, configurable in Cognito). For high-sensitivity operations, add explicit `GetUser` validation later.
- **boto3 is synchronous** → Mitigation: Wrap all calls with `asyncio.to_thread`; add integration tests to catch blocking behavior.
- **JWKS cache stale after key rotation** → Mitigation: Catch `JWTError` on key mismatch and re-fetch JWKS once before failing; log a warning.
- **Cognito cold start** → No mitigation needed; boto3 client is instantiated at app startup.
- **Test coverage of real Cognito** → Mitigation: `FakeCognitoClient` covers unit tests; a separate integration test suite (opt-in via env flag) can target a real Cognito User Pool.

## Migration Plan

1. Add `boto3`, `python-jose[cryptography]` to `requirements.txt` / `pyproject.toml`
2. Add environment variables to `.env.example` and CI secrets
3. Deploy new auth routes behind `/auth/` prefix — no existing routes change
4. Enable `Depends(get_current_user)` on routes that need protection (done per-route, no big-bang migration)
5. Rollback: remove the `auth` router registration from `main.py`; no DB migrations involved

## Open Questions

- Should access tokens use Cognito's default 1-hour TTL, or should we configure a shorter window (e.g., 15 min)?
- Do we need a `GET /auth/me` endpoint to expose the current user's profile?
- Will any existing routes require authentication immediately, or do we ship auth routes first and protect others in follow-up tasks?

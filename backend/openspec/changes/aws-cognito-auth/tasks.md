## 1. Project Setup

- [x] 1.1 Add `boto3`, `python-jose[cryptography]` to project dependencies
- [x] 1.2 Add `COGNITO_USER_POOL_ID`, `COGNITO_APP_CLIENT_ID`, `COGNITO_REGION`, `COGNITO_JWKS_URL` to `.env.example` and load them in app config
- [x] 1.3 Create `src/clients/` directory structure with `__init__.py` and `impl/__init__.py`

## 2. Cognito Client ABC and Implementation

- [x] 2.1 Define `AbstractCognitoClient` ABC in `src/clients/base.py` with async methods: `register`, `login`, `logout`, `refresh_token`
- [x] 2.2 Implement `CognitoClient` in `src/clients/impl/cognito.py` wrapping boto3 `cognito-idp` with `asyncio.to_thread`
- [x] 2.3 Write unit tests for `CognitoClient` using a `FakeCognitoClient` stub (no real AWS calls)

## 3. Domain Objects

- [x] 3.1 Create `CurrentUser` value object in `src/domain/` with `user_id: str` and `email: str` fields
- [x] 3.2 Create Pydantic request schemas in `src/models/`: `RegisterRequest`, `LoginRequest`, `RefreshRequest`
- [x] 3.3 Create Pydantic response schemas: `LoginResponse`, `RefreshResponse`, `MessageResponse`

## 4. Auth Service

- [x] 4.1 Create `AuthService` in `src/services/auth_service.py` with `__init__(self, cognito: AbstractCognitoClient)`
- [x] 4.2 Implement `register(request: RegisterRequest) -> MessageResponse` on `AuthService`
- [x] 4.3 Implement `login(request: LoginRequest) -> LoginResponse` on `AuthService`
- [x] 4.4 Implement `logout(access_token: str) -> MessageResponse` on `AuthService`
- [x] 4.5 Implement `refresh(request: RefreshRequest) -> RefreshResponse` on `AuthService`
- [x] 4.6 Write unit tests for all `AuthService` methods using `FakeCognitoClient`

## 5. JWT Validation Dependency

- [x] 5.1 Implement JWKS fetching and caching in `src/dependencies.py` (fetch on startup, cache in module-level variable)
- [x] 5.2 Implement `get_current_user` FastAPI dependency that validates Bearer token using `python-jose` and cached JWKS; returns `CurrentUser`
- [x] 5.3 Add JWKS re-fetch-on-unknown-kid retry logic in `get_current_user`
- [x] 5.4 Write unit tests for `get_current_user` covering valid token, expired token, missing header, wrong issuer, and kid-rotation scenarios

## 6. Auth Routes

- [x] 6.1 Create `src/routes/auth.py` with `APIRouter(prefix="/auth", tags=["auth"])`
- [x] 6.2 Implement `POST /auth/register` route — calls `AuthService.register`, returns 201
- [x] 6.3 Implement `POST /auth/login` route — calls `AuthService.login`, returns 200 with tokens
- [x] 6.4 Implement `POST /auth/logout` route — requires `Depends(get_current_user)`, calls `AuthService.logout`
- [x] 6.5 Implement `POST /auth/refresh` route — calls `AuthService.refresh`, returns new access token
- [x] 6.6 Register `auth_router` in `main.py` (or app factory)

## 7. Route-Level Tests

- [x] 7.1 Write integration tests for `POST /auth/register` covering all scenarios in the spec (success, duplicate, weak password, invalid email, missing fields)
- [x] 7.2 Write integration tests for `POST /auth/login` (success, wrong password, unregistered, unverified, missing fields)
- [x] 7.3 Write integration tests for `POST /auth/logout` (success, missing token, expired token)
- [x] 7.4 Write integration tests for `POST /auth/refresh` (success, invalid token, revoked token, missing field)
- [x] 7.5 Write integration tests confirming unprotected routes remain accessible without a token

## 8. Wire Dependency Injection

- [x] 8.1 Add `get_cognito_client` provider to `src/dependencies.py` using FastAPI `Depends()` pattern
- [x] 8.2 Add `get_auth_service` provider that injects `get_cognito_client` into `AuthService`
- [x] 8.3 Update auth routes to inject `AuthService` via `Depends(get_auth_service)`
- [x] 8.4 Verify all tests pass with the full DI wiring in place

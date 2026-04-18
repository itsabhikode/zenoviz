## Why

The application currently has no authentication layer, leaving all routes open and user identity unmanaged. Integrating AWS Cognito provides a managed, scalable identity platform that handles secure credential storage, token lifecycle, and MFA readiness without building auth infrastructure from scratch.

## What Changes

- Add a Cognito client wrapper (`AbstractCognitoClient` + httpx/boto3 implementation) for all Cognito API calls
- Add `AuthService` that orchestrates register, login, logout, and token refresh flows
- Add `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/refresh` routes
- Add a `get_current_user` FastAPI dependency that validates Cognito JWTs and injects user identity
- Add a `protected` route decorator pattern using `Depends(get_current_user)` to guard existing and future routes
- Store Cognito User Pool ID and App Client ID in environment config (no secrets in code)

## Capabilities

### New Capabilities
- `user-registration`: Sign up with email + password, confirm account via Cognito verification email
- `user-login`: Authenticate with email + password, receive access + refresh tokens
- `user-logout`: Invalidate the current session via Cognito global sign-out
- `token-refresh`: Exchange a valid refresh token for a new access token
- `protected-routes`: JWT validation middleware/dependency that gates any route behind authentication

### Modified Capabilities

## Impact

- **New dependencies**: `boto3` (or `warrant`/`python-jose`) for Cognito API calls and JWT verification; `python-jose[cryptography]` for JWKS-based token validation
- **New environment variables**: `COGNITO_USER_POOL_ID`, `COGNITO_APP_CLIENT_ID`, `COGNITO_REGION`, `COGNITO_JWKS_URL`
- **New files**: `src/clients/base.py` (Cognito ABC), `src/clients/impl/cognito.py`, `src/services/auth_service.py`, `src/routes/auth.py`, `src/dependencies.py` (extended with `get_current_user`)
- **Existing routes**: Any route that needs protection gains `current_user: User = Depends(get_current_user)` — no functional change to unprotected routes

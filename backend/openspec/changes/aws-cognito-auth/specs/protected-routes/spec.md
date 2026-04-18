## ADDED Requirements

### Requirement: Routes can require authentication via a FastAPI dependency
The system SHALL provide a `get_current_user` FastAPI dependency in `src/dependencies.py` that validates the `Authorization: Bearer <access_token>` header against Cognito's JWKS and returns a `CurrentUser` domain object. Routes declare this dependency in their signature to enforce authentication.

#### Scenario: Valid token on protected route
- **WHEN** a request is made to a protected route with a valid, non-expired Cognito access token in the `Authorization` header
- **THEN** the dependency resolves successfully and the route handler receives a `CurrentUser` object containing at minimum `user_id` (Cognito sub) and `email`

#### Scenario: Missing Authorization header on protected route
- **WHEN** a request is made to a protected route with no `Authorization` header
- **THEN** the system returns HTTP 401 with `{"detail": "Not authenticated"}`

#### Scenario: Malformed Bearer token
- **WHEN** a request is made to a protected route with an `Authorization` header that is not a valid JWT
- **THEN** the system returns HTTP 401 with `{"detail": "Invalid token"}`

#### Scenario: Expired access token
- **WHEN** a request is made to a protected route with a Cognito access token whose expiry (`exp` claim) is in the past
- **THEN** the system returns HTTP 401 with `{"detail": "Token has expired"}`

#### Scenario: Token signed by wrong issuer
- **WHEN** a request is made to a protected route with a JWT signed by a key not in the Cognito JWKS endpoint
- **THEN** the system returns HTTP 401 with `{"detail": "Invalid token"}`

#### Scenario: JWKS key rotation recovery
- **WHEN** token validation fails due to a key ID (`kid`) not found in the cached JWKS and a re-fetch of the JWKS resolves the key
- **THEN** the dependency retries validation with the refreshed keys and succeeds if the token is otherwise valid

#### Scenario: Unprotected route remains accessible without a token
- **WHEN** a request is made to a route that does NOT declare `get_current_user` in its dependencies
- **THEN** the system processes the request normally regardless of the presence or absence of an Authorization header

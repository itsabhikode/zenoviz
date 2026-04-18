## ADDED Requirements

### Requirement: Authenticated user can log out
The system SHALL accept a logout request from an authenticated user, call Cognito GlobalSignOut via `AbstractCognitoClient.logout` to invalidate all refresh tokens for the session, and return a success response. The caller is responsible for discarding the access token client-side.

#### Scenario: Successful logout
- **WHEN** a POST request is made to `/auth/logout` with a valid `Authorization: Bearer <access_token>` header
- **THEN** the system calls Cognito GlobalSignOut and returns HTTP 200 with `{"message": "Logged out successfully"}`

#### Scenario: Missing or invalid token
- **WHEN** a POST request is made to `/auth/logout` without a valid Bearer token
- **THEN** the system returns HTTP 401 with `{"detail": "Not authenticated"}`

#### Scenario: Already-expired token
- **WHEN** a POST request is made to `/auth/logout` with an expired access token
- **THEN** the system returns HTTP 401 with `{"detail": "Token has expired"}`

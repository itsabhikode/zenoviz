## ADDED Requirements

### Requirement: Client can exchange a refresh token for a new access token
The system SHALL accept a refresh token, forward it to Cognito via `AbstractCognitoClient.refresh_token`, and return a new access token. The refresh token itself is not rotated (Cognito default).

#### Scenario: Successful refresh
- **WHEN** a POST request is made to `/auth/refresh` with a valid, non-expired refresh token in the request body
- **THEN** the system returns HTTP 200 with `{"access_token": "<new_jwt>", "token_type": "bearer"}`

#### Scenario: Invalid refresh token
- **WHEN** a POST request is made to `/auth/refresh` with a malformed or tampered refresh token
- **THEN** the system returns HTTP 401 with `{"detail": "Invalid or expired refresh token"}`

#### Scenario: Expired or revoked refresh token
- **WHEN** a POST request is made to `/auth/refresh` with a refresh token that has been revoked (e.g., after GlobalSignOut) or exceeded its TTL
- **THEN** the system returns HTTP 401 with `{"detail": "Invalid or expired refresh token"}`

#### Scenario: Missing refresh token
- **WHEN** a POST request is made to `/auth/refresh` without a refresh token field
- **THEN** the system returns HTTP 422 with a validation error

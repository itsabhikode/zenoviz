## ADDED Requirements

### Requirement: User can log in with email and password
The system SHALL accept login credentials, authenticate them against Cognito via `AbstractCognitoClient.login`, and return Cognito-issued tokens in the response body.

#### Scenario: Successful login
- **WHEN** a POST request is made to `/auth/login` with a valid, verified email and correct password
- **THEN** the system returns HTTP 200 with `{"access_token": "<jwt>", "refresh_token": "<token>", "token_type": "bearer"}`

#### Scenario: Wrong password
- **WHEN** a POST request is made to `/auth/login` with a registered email but incorrect password
- **THEN** the system returns HTTP 401 with `{"detail": "Invalid credentials"}`

#### Scenario: Unregistered email
- **WHEN** a POST request is made to `/auth/login` with an email not present in the User Pool
- **THEN** the system returns HTTP 401 with `{"detail": "Invalid credentials"}` (same message as wrong password to avoid user enumeration)

#### Scenario: Unverified account
- **WHEN** a POST request is made to `/auth/login` with credentials for an account that has not completed email verification
- **THEN** the system returns HTTP 403 with `{"detail": "Account not verified. Please check your email."}`

#### Scenario: Missing credentials
- **WHEN** a POST request is made to `/auth/login` with email or password absent
- **THEN** the system returns HTTP 422 with a validation error

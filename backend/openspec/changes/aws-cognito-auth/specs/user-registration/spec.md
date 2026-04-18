## ADDED Requirements

### Requirement: User can register with email and password
The system SHALL accept a registration request containing an email address and password, forward it to Cognito via `AbstractCognitoClient.register`, and return a success response. Cognito delivers a verification email automatically; the backend does not send email directly.

#### Scenario: Successful registration
- **WHEN** a POST request is made to `/auth/register` with a valid email and password meeting Cognito's password policy
- **THEN** the system returns HTTP 201 with `{"message": "Registration successful. Please check your email to verify your account."}`

#### Scenario: Duplicate email
- **WHEN** a POST request is made to `/auth/register` with an email already registered in the User Pool
- **THEN** the system returns HTTP 409 with an error message indicating the email is already in use

#### Scenario: Invalid email format
- **WHEN** a POST request is made to `/auth/register` with a malformed email address
- **THEN** the system returns HTTP 422 with a validation error

#### Scenario: Password too weak
- **WHEN** a POST request is made to `/auth/register` with a password that does not meet Cognito's password policy (e.g., too short, missing required character classes)
- **THEN** the system returns HTTP 400 with an error message describing the policy violation

#### Scenario: Missing required fields
- **WHEN** a POST request is made to `/auth/register` with email or password absent
- **THEN** the system returns HTTP 422 with a validation error listing missing fields

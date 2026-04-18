## ADDED Requirements

### Requirement: User can upload a payment proof image

The system SHALL accept an image file upload for a `RESERVED` booking owned by the authenticated user, validate the file type and size, persist the file to the configured upload directory, and transition the booking to `PAYMENT_PENDING`.

#### Scenario: Successful payment proof upload

- **WHEN** `POST /study-room/bookings/{id}/payment-proof` is called with a png/jpg/jpeg/webp image within the size limit, for a `RESERVED` booking belonging to the current user
- **THEN** the system returns HTTP 200, the booking status is `payment_pending`, and `payment_proof_path` is set

#### Scenario: Upload rejected for wrong booking status

- **WHEN** the booking status is not `reserved` (e.g., already `payment_pending` or `completed`)
- **THEN** the system returns HTTP 400

#### Scenario: Upload rejected if reservation has expired

- **WHEN** the booking is `reserved` but `reserved_until` is in the past at the time of upload
- **THEN** the system returns HTTP 400

#### Scenario: Upload rejected for another user's booking

- **WHEN** the booking belongs to a different user_id than the authenticated user
- **THEN** the system returns HTTP 400

#### Scenario: Unsupported file type rejected

- **WHEN** the uploaded file has an extension other than .png, .jpg, .jpeg, .webp
- **THEN** the system returns HTTP 400

#### Scenario: File exceeding size limit rejected

- **WHEN** the uploaded file is larger than `max_payment_proof_bytes` (default 5 MB)
- **THEN** the system returns HTTP 400

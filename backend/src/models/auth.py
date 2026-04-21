from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr = Field(examples=["you@example.com"])
    password: str = Field(min_length=1, examples=["Str0ng!pass"])
    given_name: str = Field(
        min_length=1,
        max_length=2048,
        description="Given name (maps to Cognito `given_name`).",
        examples=["Ada"],
    )
    family_name: str = Field(
        min_length=1,
        max_length=2048,
        description="Family name (maps to Cognito `family_name`).",
        examples=["Lovelace"],
    )
    phone_number: str = Field(
        min_length=1,
        max_length=2048,
        description="Phone in E.164 format, e.g. +14155552671 (Cognito `phone_number`).",
        examples=["+14155552671"],
    )
    gender: str = Field(
        min_length=1,
        max_length=2048,
        description="Gender value required by your Cognito pool (Cognito `gender`).",
        examples=["female"],
    )


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str
    verification_destination: str | None = None
    delivery_medium: str | None = None


class ConfirmForgotPasswordRequest(BaseModel):
    email: EmailStr
    confirmation_code: str = Field(min_length=1, max_length=2048)
    new_password: str = Field(min_length=1, max_length=2048)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MessageResponse(BaseModel):
    message: str


class MeResponse(BaseModel):
    user_id: str
    email: str
    roles: list[str]
    # Profile fields enriched from Cognito so the UI can greet the user by name.
    # They are optional because Cognito lookups can fail — we still return
    # whatever we have rather than 500-ing.
    given_name: str | None = None
    family_name: str | None = None
    phone_number: str | None = None


class RegisterResponse(BaseModel):
    message: str
    user_sub: str | None = Field(
        default=None,
        description="Cognito `sub` for the new user.",
    )
    user_confirmed: bool | None = Field(
        default=None,
        description="If true, Cognito did not require email/SMS verification for this sign-up.",
    )
    verification_destination: str | None = Field(
        default=None,
        description="Masked destination Cognito reports sending the verification code to.",
    )
    delivery_medium: str | None = Field(
        default=None,
        description="How Cognito sent the code: EMAIL, SMS, etc. If null, check pool/SES configuration.",
    )

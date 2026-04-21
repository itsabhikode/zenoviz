from src.clients.base import AbstractCognitoClient
from src.models.auth import (
    ConfirmForgotPasswordRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
    RegisterResponse,
)


def _pending_verification_message(delivery_medium: str | None) -> str:
    """Human-readable hint; Cognito picks EMAIL vs SMS from user pool settings."""

    intro = (
        "Registration successful. A verification code was sent; see verification_destination "
        "and delivery_medium."
    )
    medium = (delivery_medium or "").upper()
    if medium == "SMS":
        return (
            f"{intro} If SMS never arrives, check AWS SNS (SMS monthly spending limit), "
            "that your user pool has an SMS IAM role allowed to publish to SNS, E.164 phone "
            "format, and regional SMS rules (some regions require sender or template registration)."
        )
    if medium == "EMAIL":
        return (
            f"{intro} If nothing arrives, check spam and Cognito/SES (SES sandbox only sends "
            "to verified identities)."
        )
    return (
        f"{intro} If nothing arrives, review Cognito sign-up verification attributes for your user pool."
    )


class AuthService:
    def __init__(self, cognito: AbstractCognitoClient) -> None:
        self.cognito = cognito

    async def register(self, request: RegisterRequest) -> RegisterResponse:
        result = await self.cognito.register(
            str(request.email),
            request.password,
            given_name=request.given_name,
            family_name=request.family_name,
            phone_number=request.phone_number,
            gender=request.gender,
        )
        if result.user_confirmed:
            message = "Registration successful. Your account is already confirmed and ready to use."
        else:
            message = _pending_verification_message(result.delivery_medium)
        return RegisterResponse(
            message=message,
            user_sub=result.user_sub,
            user_confirmed=result.user_confirmed,
            verification_destination=result.verification_destination,
            delivery_medium=result.delivery_medium,
        )

    async def login(self, request: LoginRequest) -> LoginResponse:
        tokens = await self.cognito.login(request.email, request.password)
        return LoginResponse(
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
        )

    async def logout(self, access_token: str) -> MessageResponse:
        await self.cognito.logout(access_token)
        return MessageResponse(message="Logged out successfully")

    async def refresh(self, request: RefreshRequest) -> RefreshResponse:
        tokens = await self.cognito.refresh_token(request.refresh_token)
        return RefreshResponse(access_token=tokens["access_token"])

    async def forgot_password(self, request: ForgotPasswordRequest) -> ForgotPasswordResponse:
        outcome = await self.cognito.forgot_password(str(request.email))
        generic_message = (
            "If that email is registered, you will receive a reset code shortly."
        )
        if not outcome.code_sent:
            return ForgotPasswordResponse(message=generic_message)
        intro = (
            "A verification code was sent; see verification_destination and delivery_medium."
        )
        return ForgotPasswordResponse(
            message=intro,
            verification_destination=outcome.verification_destination,
            delivery_medium=outcome.delivery_medium,
        )

    async def confirm_forgot_password(
        self, request: ConfirmForgotPasswordRequest
    ) -> MessageResponse:
        await self.cognito.confirm_forgot_password(
            str(request.email),
            request.confirmation_code.strip(),
            request.new_password,
        )
        return MessageResponse(
            message="Password updated. You can sign in with your new password."
        )

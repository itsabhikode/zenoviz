from src.clients.base import AbstractCognitoClient
from src.models.auth import (
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
    RegisterResponse,
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
            message = (
                "Registration successful. A verification code was sent; see verification_destination "
                "and delivery_medium. If nothing arrives, check spam and your Cognito/SES email settings "
                "(SES sandbox only delivers to verified identities)."
            )
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

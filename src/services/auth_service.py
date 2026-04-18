from src.clients.base import AbstractCognitoClient
from src.models.auth import (
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
)


class AuthService:
    def __init__(self, cognito: AbstractCognitoClient) -> None:
        self.cognito = cognito

    async def register(self, request: RegisterRequest) -> MessageResponse:
        await self.cognito.register(request.email, request.password)
        return MessageResponse(
            message="Registration successful. Please check your email to verify your account."
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

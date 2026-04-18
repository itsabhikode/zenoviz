import asyncio

import boto3
from botocore.exceptions import ClientError

from src.clients.base import AbstractCognitoClient


class CognitoClient(AbstractCognitoClient):
    def __init__(self, user_pool_id: str, app_client_id: str, region: str) -> None:
        self._user_pool_id = user_pool_id
        self._app_client_id = app_client_id
        self._boto_client = boto3.client("cognito-idp", region_name=region)

    async def register(self, email: str, password: str) -> None:
        try:
            await asyncio.to_thread(
                self._boto_client.sign_up,
                ClientId=self._app_client_id,
                Username=email,
                Password=password,
            )
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code == "UsernameExistsException":
                raise ValueError("Email already registered") from exc
            if code == "InvalidPasswordException":
                raise ValueError(f"Invalid password: {exc.response['Error']['Message']}") from exc
            raise

    async def login(self, email: str, password: str) -> dict[str, str]:
        try:
            response = await asyncio.to_thread(
                self._boto_client.initiate_auth,
                AuthFlow="USER_PASSWORD_AUTH",
                AuthParameters={"USERNAME": email, "PASSWORD": password},
                ClientId=self._app_client_id,
            )
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code == "NotAuthorizedException":
                raise ValueError("Invalid credentials") from exc
            if code == "UserNotConfirmedException":
                raise PermissionError("Account not verified") from exc
            raise
        auth_result = response["AuthenticationResult"]
        return {
            "access_token": auth_result["AccessToken"],
            "refresh_token": auth_result["RefreshToken"],
        }

    async def logout(self, access_token: str) -> None:
        await asyncio.to_thread(
            self._boto_client.global_sign_out,
            AccessToken=access_token,
        )

    async def refresh_token(self, refresh_token: str) -> dict[str, str]:
        try:
            response = await asyncio.to_thread(
                self._boto_client.initiate_auth,
                AuthFlow="REFRESH_TOKEN_AUTH",
                AuthParameters={"REFRESH_TOKEN": refresh_token},
                ClientId=self._app_client_id,
            )
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code == "NotAuthorizedException":
                raise ValueError("Invalid or expired refresh token") from exc
            raise
        auth_result = response["AuthenticationResult"]
        return {"access_token": auth_result["AccessToken"]}

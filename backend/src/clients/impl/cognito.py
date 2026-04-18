import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

import boto3
from botocore.exceptions import ClientError

from src.clients.base import (
    AbstractCognitoClient,
    CognitoRegisterResult,
    CognitoUserPage,
    CognitoUserSummary,
)

logger = logging.getLogger(__name__)


class CognitoClient(AbstractCognitoClient):
    def __init__(self, user_pool_id: str, app_client_id: str, region: str) -> None:
        self._user_pool_id = user_pool_id
        self._app_client_id = app_client_id
        self._boto_client = boto3.client("cognito-idp", region_name=region)

    async def register(
        self,
        email: str,
        password: str,
        *,
        given_name: str,
        family_name: str,
        phone_number: str,
        gender: str,
    ) -> CognitoRegisterResult:
        user_attributes = [
            {"Name": "email", "Value": email},
            {"Name": "given_name", "Value": given_name},
            {"Name": "family_name", "Value": family_name},
            {"Name": "phone_number", "Value": phone_number},
            {"Name": "gender", "Value": gender},
        ]
        try:
            response = await asyncio.to_thread(
                self._boto_client.sign_up,
                ClientId=self._app_client_id,
                Username=email,
                Password=password,
                UserAttributes=user_attributes,
            )
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code == "UsernameExistsException":
                raise ValueError("Email already registered") from exc
            if code == "InvalidPasswordException":
                raise ValueError(f"Invalid password: {exc.response['Error']['Message']}") from exc
            if code == "InvalidParameterException":
                raise ValueError(
                    f"Invalid registration parameter: {exc.response['Error']['Message']}"
                ) from exc
            raise

        details = response.get("CodeDeliveryDetails") or {}
        destination = details.get("Destination")
        medium = details.get("DeliveryMedium")
        if destination or medium:
            logger.info(
                "Cognito sign_up verification: medium=%s destination=%s user_confirmed=%s",
                medium,
                destination,
                response.get("UserConfirmed"),
            )

        return CognitoRegisterResult(
            user_sub=response["UserSub"],
            user_confirmed=bool(response.get("UserConfirmed")),
            verification_destination=destination,
            delivery_medium=medium,
        )

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

    async def resolve_sub_by_email(self, email: str) -> str | None:
        try:
            response = await asyncio.to_thread(
                self._boto_client.admin_get_user,
                UserPoolId=self._user_pool_id,
                Username=email,
            )
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code in ("UserNotFoundException", "ResourceNotFoundException"):
                return None
            raise
        for attr in response.get("UserAttributes", []):
            if attr.get("Name") == "sub":
                return attr.get("Value")
        return None

    async def list_users(
        self,
        *,
        limit: int = 50,
        pagination_token: str | None = None,
        email_prefix: str | None = None,
    ) -> CognitoUserPage:
        kwargs: dict[str, Any] = {
            "UserPoolId": self._user_pool_id,
            "Limit": max(1, min(limit, 60)),
        }
        if pagination_token:
            kwargs["PaginationToken"] = pagination_token
        if email_prefix:
            escaped = email_prefix.replace('"', '\\"')
            kwargs["Filter"] = f'email ^= "{escaped}"'

        response = await asyncio.to_thread(self._boto_client.list_users, **kwargs)
        users = [_parse_list_users_entry(item) for item in response.get("Users", [])]
        return CognitoUserPage(
            users=users,
            next_pagination_token=response.get("PaginationToken"),
        )

    async def get_user_by_sub(self, user_id: str) -> CognitoUserSummary | None:
        try:
            response = await asyncio.to_thread(
                self._boto_client.admin_get_user,
                UserPoolId=self._user_pool_id,
                Username=user_id,
            )
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code in ("UserNotFoundException", "ResourceNotFoundException"):
                return None
            raise
        return _parse_admin_get_user(response)


def _attrs_to_dict(attrs: list[dict[str, str]] | None) -> dict[str, str]:
    return {a["Name"]: a.get("Value", "") for a in (attrs or [])}


def _parse_created_at(raw: Any) -> datetime | None:
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
    return None


def _build_summary(
    *,
    username: str,
    attrs: dict[str, str],
    status: str,
    enabled: bool,
    created_at: datetime | None,
) -> CognitoUserSummary:
    return CognitoUserSummary(
        user_id=attrs.get("sub", username),
        username=username,
        email=attrs.get("email") or None,
        email_verified=(attrs.get("email_verified", "false").lower() == "true"),
        given_name=attrs.get("given_name") or None,
        family_name=attrs.get("family_name") or None,
        phone_number=attrs.get("phone_number") or None,
        status=status,
        enabled=enabled,
        created_at=created_at,
    )


def _parse_list_users_entry(item: dict[str, Any]) -> CognitoUserSummary:
    return _build_summary(
        username=item.get("Username", ""),
        attrs=_attrs_to_dict(item.get("Attributes")),
        status=item.get("UserStatus", "UNKNOWN"),
        enabled=bool(item.get("Enabled", True)),
        created_at=_parse_created_at(item.get("UserCreateDate")),
    )


def _parse_admin_get_user(response: dict[str, Any]) -> CognitoUserSummary:
    return _build_summary(
        username=response.get("Username", ""),
        attrs=_attrs_to_dict(response.get("UserAttributes")),
        status=response.get("UserStatus", "UNKNOWN"),
        enabled=bool(response.get("Enabled", True)),
        created_at=_parse_created_at(response.get("UserCreateDate")),
    )

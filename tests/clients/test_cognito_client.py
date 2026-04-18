"""Unit tests for CognitoClient via FakeCognitoClient stub."""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from src.clients.base import AbstractCognitoClient
from src.clients.impl.cognito import CognitoClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_client(pool_id: str = "us-east-1_TEST", app_client_id: str = "CLIENTID") -> CognitoClient:
    return CognitoClient(user_pool_id=pool_id, app_client_id=app_client_id, region="us-east-1")


def _client_error(code: str) -> ClientError:
    return ClientError({"Error": {"Code": code, "Message": code}}, "op")


# ---------------------------------------------------------------------------
# Interface contract
# ---------------------------------------------------------------------------

def test_cognito_client_is_abstract_subclass() -> None:
    assert issubclass(CognitoClient, AbstractCognitoClient)


# ---------------------------------------------------------------------------
# register
# ---------------------------------------------------------------------------

async def test_register_calls_sign_up() -> None:
    client = _make_client()
    mock_boto = MagicMock()
    mock_boto.sign_up = MagicMock(return_value={"UserSub": "abc-123"})

    with patch.object(client, "_boto_client", mock_boto):
        await client.register("user@example.com", "SecurePass1!")

    mock_boto.sign_up.assert_called_once_with(
        ClientId="CLIENTID",
        Username="user@example.com",
        Password="SecurePass1!",
    )


async def test_register_raises_value_error_on_username_exists() -> None:
    client = _make_client()
    mock_boto = MagicMock()
    mock_boto.sign_up = MagicMock(side_effect=_client_error("UsernameExistsException"))

    with patch.object(client, "_boto_client", mock_boto):
        with pytest.raises(ValueError, match="already registered"):
            await client.register("user@example.com", "SecurePass1!")


async def test_register_raises_value_error_on_invalid_password() -> None:
    client = _make_client()
    mock_boto = MagicMock()
    mock_boto.sign_up = MagicMock(side_effect=_client_error("InvalidPasswordException"))

    with patch.object(client, "_boto_client", mock_boto):
        with pytest.raises(ValueError, match="password"):
            await client.register("user@example.com", "weak")


# ---------------------------------------------------------------------------
# login
# ---------------------------------------------------------------------------

async def test_login_returns_tokens() -> None:
    client = _make_client()
    mock_boto = MagicMock()
    mock_boto.initiate_auth = MagicMock(return_value={
        "AuthenticationResult": {
            "AccessToken": "access_tok",
            "RefreshToken": "refresh_tok",
        }
    })

    with patch.object(client, "_boto_client", mock_boto):
        result = await client.login("user@example.com", "SecurePass1!")

    assert result == {"access_token": "access_tok", "refresh_token": "refresh_tok"}


async def test_login_raises_value_error_on_not_authorized() -> None:
    client = _make_client()
    mock_boto = MagicMock()
    mock_boto.initiate_auth = MagicMock(side_effect=_client_error("NotAuthorizedException"))

    with patch.object(client, "_boto_client", mock_boto):
        with pytest.raises(ValueError, match="Invalid credentials"):
            await client.login("user@example.com", "wrong")


async def test_login_raises_permission_error_on_user_not_confirmed() -> None:
    client = _make_client()
    mock_boto = MagicMock()
    mock_boto.initiate_auth = MagicMock(side_effect=_client_error("UserNotConfirmedException"))

    with patch.object(client, "_boto_client", mock_boto):
        with pytest.raises(PermissionError, match="not verified"):
            await client.login("user@example.com", "SecurePass1!")


# ---------------------------------------------------------------------------
# logout
# ---------------------------------------------------------------------------

async def test_logout_calls_global_sign_out() -> None:
    client = _make_client()
    mock_boto = MagicMock()
    mock_boto.global_sign_out = MagicMock(return_value={})

    with patch.object(client, "_boto_client", mock_boto):
        await client.logout("access_tok")

    mock_boto.global_sign_out.assert_called_once_with(AccessToken="access_tok")


# ---------------------------------------------------------------------------
# refresh_token
# ---------------------------------------------------------------------------

async def test_refresh_token_returns_new_access_token() -> None:
    client = _make_client()
    mock_boto = MagicMock()
    mock_boto.initiate_auth = MagicMock(return_value={
        "AuthenticationResult": {"AccessToken": "new_access_tok"}
    })

    with patch.object(client, "_boto_client", mock_boto):
        result = await client.refresh_token("refresh_tok")

    assert result == {"access_token": "new_access_tok"}
    mock_boto.initiate_auth.assert_called_once_with(
        AuthFlow="REFRESH_TOKEN_AUTH",
        AuthParameters={"REFRESH_TOKEN": "refresh_tok"},
        ClientId="CLIENTID",
    )


async def test_refresh_token_raises_value_error_on_not_authorized() -> None:
    client = _make_client()
    mock_boto = MagicMock()
    mock_boto.initiate_auth = MagicMock(side_effect=_client_error("NotAuthorizedException"))

    with patch.object(client, "_boto_client", mock_boto):
        with pytest.raises(ValueError, match="Invalid or expired refresh token"):
            await client.refresh_token("bad_tok")

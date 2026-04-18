"""Unit tests for AuthService using FakeCognitoClient."""
import pytest

from src.clients.base import AbstractCognitoClient, CognitoRegisterResult
from src.models.auth import LoginRequest, RefreshRequest, RegisterRequest
from src.services.auth_service import AuthService


# ---------------------------------------------------------------------------
# Fake
# ---------------------------------------------------------------------------

class FakeCognitoClient(AbstractCognitoClient):
    def __init__(self) -> None:
        self.registered: list[dict[str, str]] = []
        self.logged_in: list[tuple[str, str]] = []
        self.logged_out: list[str] = []
        self.refreshed: list[str] = []

        # Control responses / errors
        self.register_error: Exception | None = None
        self.login_tokens: dict[str, str] = {
            "access_token": "fake_access",
            "refresh_token": "fake_refresh",
        }
        self.login_error: Exception | None = None
        self.refresh_tokens: dict[str, str] = {"access_token": "new_fake_access"}
        self.refresh_error: Exception | None = None

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
        if self.register_error:
            raise self.register_error
        self.registered.append(
            {
                "email": email,
                "password": password,
                "given_name": given_name,
                "family_name": family_name,
                "phone_number": phone_number,
                "gender": gender,
            }
        )
        return CognitoRegisterResult(
            user_sub="00000000-0000-0000-0000-000000000099",
            user_confirmed=False,
            verification_destination="u***@example.com",
            delivery_medium="EMAIL",
        )

    async def login(self, email: str, password: str) -> dict[str, str]:
        if self.login_error:
            raise self.login_error
        self.logged_in.append((email, password))
        return self.login_tokens

    async def logout(self, access_token: str) -> None:
        self.logged_out.append(access_token)

    async def refresh_token(self, refresh_token: str) -> dict[str, str]:
        if self.refresh_error:
            raise self.refresh_error
        self.refreshed.append(refresh_token)
        return self.refresh_tokens

    async def resolve_sub_by_email(self, email: str) -> str | None:
        return None

    async def list_users(self, **_: object):  # type: ignore[override]
        from src.clients.base import CognitoUserPage

        return CognitoUserPage(users=[], next_pagination_token=None)

    async def get_user_by_sub(self, user_id: str):  # type: ignore[override]
        return None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _service() -> tuple[AuthService, FakeCognitoClient]:
    fake = FakeCognitoClient()
    svc = AuthService(cognito=fake)
    return svc, fake


# ---------------------------------------------------------------------------
# register
# ---------------------------------------------------------------------------

async def test_register_success_returns_message() -> None:
    svc, fake = _service()
    response = await svc.register(
        RegisterRequest(
            email="u@example.com",
            password="Pass1!",
            given_name="Ada",
            family_name="Lovelace",
            phone_number="+14155552671",
            gender="female",
        )
    )
    assert "successful" in response.message.lower()
    assert response.user_sub == "00000000-0000-0000-0000-000000000099"
    assert response.user_confirmed is False
    assert response.verification_destination == "u***@example.com"
    assert response.delivery_medium == "EMAIL"
    assert fake.registered == [
        {
            "email": "u@example.com",
            "password": "Pass1!",
            "given_name": "Ada",
            "family_name": "Lovelace",
            "phone_number": "+14155552671",
            "gender": "female",
        }
    ]


async def test_register_propagates_value_error() -> None:
    svc, fake = _service()
    fake.register_error = ValueError("Email already registered")
    with pytest.raises(ValueError, match="already registered"):
        await svc.register(
            RegisterRequest(
                email="u@example.com",
                password="Pass1!",
                given_name="A",
                family_name="B",
                phone_number="+10000000000",
                gender="x",
            )
        )


# ---------------------------------------------------------------------------
# login
# ---------------------------------------------------------------------------

async def test_login_success_returns_tokens() -> None:
    svc, _ = _service()
    response = await svc.login(LoginRequest(email="u@example.com", password="Pass1!"))
    assert response.access_token == "fake_access"
    assert response.refresh_token == "fake_refresh"
    assert response.token_type == "bearer"


async def test_login_propagates_value_error() -> None:
    svc, fake = _service()
    fake.login_error = ValueError("Invalid credentials")
    with pytest.raises(ValueError, match="Invalid credentials"):
        await svc.login(LoginRequest(email="u@example.com", password="wrong"))


async def test_login_propagates_permission_error() -> None:
    svc, fake = _service()
    fake.login_error = PermissionError("not verified")
    with pytest.raises(PermissionError):
        await svc.login(LoginRequest(email="u@example.com", password="Pass1!"))


# ---------------------------------------------------------------------------
# logout
# ---------------------------------------------------------------------------

async def test_logout_success_returns_message() -> None:
    svc, fake = _service()
    response = await svc.logout("access_tok")
    assert "success" in response.message.lower()
    assert fake.logged_out == ["access_tok"]


# ---------------------------------------------------------------------------
# refresh
# ---------------------------------------------------------------------------

async def test_refresh_success_returns_new_token() -> None:
    svc, _ = _service()
    response = await svc.refresh(RefreshRequest(refresh_token="ref_tok"))
    assert response.access_token == "new_fake_access"
    assert response.token_type == "bearer"


async def test_refresh_propagates_value_error() -> None:
    svc, fake = _service()
    fake.refresh_error = ValueError("Invalid or expired refresh token")
    with pytest.raises(ValueError, match="refresh token"):
        await svc.refresh(RefreshRequest(refresh_token="bad_tok"))

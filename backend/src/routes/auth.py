import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.clients.base import AbstractCognitoClient
from src.dependencies import (
    get_auth_service,
    get_cognito_client,
    get_current_user,
    get_user_roles,
)
from src.domain.user import CurrentUser
from src.models.auth import (
    ConfirmForgotPasswordRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LoginResponse,
    MeResponse,
    MessageResponse,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
    RegisterResponse,
)
from src.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

_bearer = HTTPBearer(auto_error=False)
_logger = logging.getLogger(__name__)


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> RegisterResponse:
    try:
        return await auth_service.register(request)
    except ValueError as exc:
        msg = str(exc)
        if "already" in msg.lower():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg) from exc


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    request: ForgotPasswordRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> ForgotPasswordResponse:
    """Always returns 200 with a generic message when email is unknown (no enumeration)."""
    try:
        return await auth_service.forgot_password(request)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/confirm-forgot-password", response_model=MessageResponse)
async def confirm_forgot_password(
    request: ConfirmForgotPasswordRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> MessageResponse:
    try:
        return await auth_service.confirm_forgot_password(request)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/login")
async def login(
    request: LoginRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> LoginResponse:
    try:
        return await auth_service.login(request)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.post("/logout")
async def logout(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> MessageResponse:
    assert credentials is not None  # guaranteed: get_current_user raises 401 first
    return await auth_service.logout(credentials.credentials)


@router.post("/refresh")
async def refresh(
    request: RefreshRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> RefreshResponse:
    try:
        return await auth_service.refresh(request)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.get("/me")
async def me(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    roles: Annotated[frozenset[str], Depends(get_user_roles)],
    cognito: Annotated[AbstractCognitoClient, Depends(get_cognito_client)],
) -> MeResponse:
    # Cognito access tokens don't carry the `email`/`given_name`/`family_name`
    # claims (those live on ID tokens), so we enrich from the user pool using
    # the `sub` we got from the verified access-token payload.
    email = current_user.email
    given_name: str | None = None
    family_name: str | None = None
    phone_number: str | None = None
    try:
        profile = await cognito.get_user_by_sub(current_user.user_id)
    except Exception as exc:  # noqa: BLE001 — best-effort enrichment
        _logger.warning("Cognito profile lookup failed for %s: %s", current_user.user_id, exc)
        profile = None
    if profile is not None:
        email = profile.email or email
        given_name = profile.given_name
        family_name = profile.family_name
        phone_number = profile.phone_number
    return MeResponse(
        user_id=current_user.user_id,
        email=email,
        roles=sorted(roles),
        given_name=given_name,
        family_name=family_name,
        phone_number=phone_number,
    )

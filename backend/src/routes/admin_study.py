from __future__ import annotations

import asyncio
import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from src.clients.base import AbstractCognitoClient, CognitoUserSummary
from src.dependencies import (
    get_booking_service,
    get_cognito_client,
    get_current_user,
    require_admin,
)
from src.domain.user import CurrentUser
from src.models.orm.study_room import Booking
from src.models.study_api import (
    AdminApproveRequest,
    BookingResponse,
    PaymentSettingsResponse,
    PricingConfigResponse,
    UpdatePaymentSettingsRequest,
    UpdatePricingRequest,
    UserSummaryResponse,
)
from src.services.booking_service import (
    BookingService,
    booking_to_response,
    payment_settings_to_response,
    pricing_to_response,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/study-room", tags=["admin-study-room"])


def _user_summary(summary: CognitoUserSummary) -> UserSummaryResponse:
    return UserSummaryResponse(
        user_id=summary.user_id,
        email=summary.email,
        given_name=summary.given_name,
        family_name=summary.family_name,
        phone_number=summary.phone_number,
    )


async def _fetch_user_map(
    cognito: AbstractCognitoClient, user_ids: set[str]
) -> dict[str, UserSummaryResponse]:
    """Batch-fetch Cognito profiles for the given subs.

    Any individual failure is logged and that user is simply omitted from the
    map — the booking row falls back to raw `user_id` on the client. This keeps
    the admin list resilient to deleted/orphaned accounts.
    """
    if not user_ids:
        return {}

    async def _safe(uid: str) -> tuple[str, CognitoUserSummary | None]:
        try:
            return uid, await cognito.get_user_by_sub(uid)
        except Exception as exc:  # pragma: no cover - defensive, logged for ops
            logger.warning("Failed to fetch Cognito user %s: %s", uid, exc)
            return uid, None

    results = await asyncio.gather(*(_safe(uid) for uid in user_ids))
    return {uid: _user_summary(u) for uid, u in results if u is not None}


def _bookings_to_admin_response(
    rows: list[Booking], user_map: dict[str, UserSummaryResponse]
) -> list[BookingResponse]:
    out: list[BookingResponse] = []
    for b in rows:
        payload = booking_to_response(b)
        payload["user"] = user_map.get(b.user_id)
        out.append(BookingResponse.model_validate(payload))
    return out


@router.get("/bookings/pending-payments", response_model=list[BookingResponse])
async def list_pending_payments(
    _: Annotated[None, Depends(require_admin)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
    cognito: Annotated[AbstractCognitoClient, Depends(get_cognito_client)],
) -> list[BookingResponse]:
    rows = await svc.list_pending_payments()
    user_map = await _fetch_user_map(cognito, {b.user_id for b in rows})
    return _bookings_to_admin_response(rows, user_map)


@router.get("/bookings", response_model=list[BookingResponse])
async def list_all_bookings(
    _: Annotated[None, Depends(require_admin)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
    cognito: Annotated[AbstractCognitoClient, Depends(get_cognito_client)],
    status_filter: Annotated[str | None, Query(alias="status")] = None,
) -> list[BookingResponse]:
    try:
        rows = await svc.list_all_bookings(status_filter)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    user_map = await _fetch_user_map(cognito, {b.user_id for b in rows})
    return _bookings_to_admin_response(rows, user_map)


@router.post("/bookings/{booking_id}/approve", response_model=BookingResponse)
async def approve_payment(
    booking_id: UUID,
    _: Annotated[None, Depends(require_admin)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
    cognito: Annotated[AbstractCognitoClient, Depends(get_cognito_client)],
    body: AdminApproveRequest | None = None,
) -> BookingResponse:
    amount = body.amount if body is not None else None
    try:
        b = await svc.approve_payment(booking_id, amount=amount)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    user_map = await _fetch_user_map(cognito, {b.user_id})
    return _bookings_to_admin_response([b], user_map)[0]


@router.post("/bookings/{booking_id}/reject", response_model=BookingResponse)
async def reject_payment(
    booking_id: UUID,
    _: Annotated[None, Depends(require_admin)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
    cognito: Annotated[AbstractCognitoClient, Depends(get_cognito_client)],
) -> BookingResponse:
    try:
        b = await svc.reject_payment(booking_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    user_map = await _fetch_user_map(cognito, {b.user_id})
    return _bookings_to_admin_response([b], user_map)[0]


@router.put("/pricing", response_model=PricingConfigResponse)
async def put_pricing(
    body: UpdatePricingRequest,
    _: Annotated[None, Depends(require_admin)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
) -> PricingConfigResponse:
    try:
        row = await svc.update_pricing(body)
        return pricing_to_response(row)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/pricing", response_model=PricingConfigResponse)
async def get_pricing(
    _: Annotated[None, Depends(require_admin)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
) -> PricingConfigResponse:
    try:
        row = await svc.get_active_pricing_public()
        return pricing_to_response(row)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/payment-settings", response_model=PaymentSettingsResponse)
async def get_admin_payment_settings(
    _: Annotated[None, Depends(require_admin)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
) -> PaymentSettingsResponse:
    row = await svc.get_payment_settings()
    return payment_settings_to_response(row)


@router.put("/payment-settings", response_model=PaymentSettingsResponse)
async def put_payment_settings(
    body: UpdatePaymentSettingsRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _: Annotated[None, Depends(require_admin)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
) -> PaymentSettingsResponse:
    try:
        row = await svc.update_payment_settings(body, user.user_id)
        return payment_settings_to_response(row)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/payment-settings/qr", response_model=PaymentSettingsResponse)
async def upload_payment_qr(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _: Annotated[None, Depends(require_admin)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
    file: UploadFile = File(...),
) -> PaymentSettingsResponse:
    try:
        raw = await file.read()
        row = await svc.upload_payment_qr(
            filename=file.filename or "qr.png",
            data=raw,
            user_id=user.user_id,
            content_type=file.content_type,
        )
        return payment_settings_to_response(row)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

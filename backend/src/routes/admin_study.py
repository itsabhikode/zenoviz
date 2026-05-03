from __future__ import annotations

import asyncio
import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response

from src.clients.base import AbstractCognitoClient, CognitoUserSummary
from src.config.app_settings import AppSettings
from src.dependencies import (
    get_app_settings,
    get_booking_service,
    get_cognito_client,
    get_current_user,
    get_storage_repo,
    get_study_repo,
    require_admin,
)
from src.repositories.impl.study_repository_sqlalchemy import SqlAlchemyStudyRepository
from src.repositories.storage_repository import AbstractStorageRepository
from src.domain.user import CurrentUser
from src.models.orm.study_room import Booking
from src.models.study_api import (
    AdminApproveRequest,
    BookingResponse,
    DashboardStatsResponse,
    GalleryImageResponse,
    PaymentSettingsResponse,
    PricingConfigResponse,
    SeatResponse,
    UpdateGalleryImageRequest,
    UpdatePaymentSettingsRequest,
    UpdatePricingRequest,
    UpdateSeatEnabledRequest,
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


@router.get("/dashboard")
async def get_dashboard_stats(
    _: Annotated[None, Depends(require_admin)],
    repo: Annotated[SqlAlchemyStudyRepository, Depends(get_study_repo)],
    cognito: Annotated[AbstractCognitoClient, Depends(get_cognito_client)],
) -> DashboardStatsResponse:
    from src.services.booking_service import booking_to_response
    stats = await repo.dashboard_stats()
    # Enrich recent bookings
    recent_raw = stats.pop("recent_bookings", [])
    user_map = await _fetch_user_map(cognito, {b.user_id for b in recent_raw})
    recent = []
    for b in recent_raw:
        payload = booking_to_response(b)
        payload["user"] = user_map.get(b.user_id)
        recent.append(BookingResponse.model_validate(payload))
    stats["recent_bookings"] = [r.model_dump() for r in recent]
    return DashboardStatsResponse(**stats)


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


@router.get("/bookings/{booking_id}/payment-proof")
async def download_payment_proof(
    booking_id: UUID,
    _: Annotated[None, Depends(require_admin)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
) -> Response:
    result = await svc.read_payment_proof_for_admin(booking_id)
    if result is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="Payment proof not found"
        )
    data, media_type = result
    return Response(content=data, media_type=media_type)


@router.get("/seats", response_model=list[SeatResponse])
async def list_seats(
    _: Annotated[None, Depends(require_admin)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
) -> list[SeatResponse]:
    rows = await svc.list_seats_admin()
    return [
        SeatResponse(id=s.id, label=s.label, is_enabled=s.is_enabled) for s in rows
    ]


@router.patch("/seats/{seat_id}", response_model=SeatResponse)
async def patch_seat_enabled(
    seat_id: int,
    body: UpdateSeatEnabledRequest,
    _: Annotated[None, Depends(require_admin)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
) -> SeatResponse:
    try:
        s = await svc.set_seat_enabled_admin(seat_id, body.is_enabled)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return SeatResponse(id=s.id, label=s.label, is_enabled=s.is_enabled)


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
    settings: Annotated[AppSettings, Depends(get_app_settings)],
) -> PaymentSettingsResponse:
    row = await svc.get_payment_settings()
    return payment_settings_to_response(row, settings=settings)


@router.put("/payment-settings", response_model=PaymentSettingsResponse)
async def put_payment_settings(
    body: UpdatePaymentSettingsRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _: Annotated[None, Depends(require_admin)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
    settings: Annotated[AppSettings, Depends(get_app_settings)],
) -> PaymentSettingsResponse:
    try:
        row = await svc.update_payment_settings(body, user.user_id)
        return payment_settings_to_response(row, settings=settings)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/payment-settings/qr", response_model=PaymentSettingsResponse)
async def upload_payment_qr(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _: Annotated[None, Depends(require_admin)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
    settings: Annotated[AppSettings, Depends(get_app_settings)],
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
        return payment_settings_to_response(row, settings=settings)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Gallery
# ---------------------------------------------------------------------------

def _gallery_image_url(img: Any, settings: AppSettings) -> str:
    if settings.payment_qr_public_base_url:
        base = settings.payment_qr_public_base_url.rstrip("/")
        return f"{base}/gallery/{img.storage_key.split('/')[-1]}"
    if img.public_url:
        return img.public_url
    return f"/admin/study-room/gallery/{img.id}/image"


def _gallery_to_response(img: Any, settings: AppSettings) -> GalleryImageResponse:
    return GalleryImageResponse(
        id=img.id,
        title=img.title,
        alt_text=img.alt_text,
        image_url=_gallery_image_url(img, settings),
        sort_order=img.sort_order,
        created_at=img.created_at,
    )


@router.get("/gallery", response_model=list[GalleryImageResponse])
async def list_gallery(
    _: Annotated[None, Depends(require_admin)],
    repo: Annotated[SqlAlchemyStudyRepository, Depends(get_study_repo)],
    settings: Annotated[AppSettings, Depends(get_app_settings)],
) -> list[GalleryImageResponse]:
    rows = await repo.list_gallery_images()
    return [_gallery_to_response(r, settings) for r in rows]


@router.post("/gallery", status_code=status.HTTP_201_CREATED, response_model=GalleryImageResponse)
async def upload_gallery_image(
    _: Annotated[None, Depends(require_admin)],
    repo: Annotated[SqlAlchemyStudyRepository, Depends(get_study_repo)],
    storage: Annotated[AbstractStorageRepository, Depends(get_storage_repo)],
    settings: Annotated[AppSettings, Depends(get_app_settings)],
    file: UploadFile = File(...),
    title: str = "",
    alt_text: str = "",
    sort_order: int = 0,
) -> GalleryImageResponse:
    import asyncio
    from datetime import datetime, timezone
    from pathlib import PurePosixPath
    from uuid import uuid4

    raw = await file.read()
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Image too large (max 5MB)")

    ext = PurePosixPath(file.filename or "image.jpg").suffix or ".jpg"
    image_id = uuid4()
    storage_filename = f"{image_id}{ext}"
    storage_key = await asyncio.to_thread(storage.save_gallery_image, storage_filename, raw)

    public_url: str | None = None
    if settings.payment_qr_public_base_url:
        base = settings.payment_qr_public_base_url.rstrip("/")
        public_url = f"{base}/gallery/{storage_filename}"

    from src.models.orm.study_room import GalleryImage
    row = GalleryImage(
        id=image_id,
        title=title,
        alt_text=alt_text,
        storage_key=storage_key,
        content_type=file.content_type or "image/jpeg",
        sort_order=sort_order,
        public_url=public_url,
        created_at=datetime.now(timezone.utc),
    )
    row = await repo.insert_gallery_image(row)
    await repo.session.commit()
    return _gallery_to_response(row, settings)


@router.put("/gallery/{image_id}", response_model=GalleryImageResponse)
async def update_gallery_image_route(
    image_id: UUID,
    body: UpdateGalleryImageRequest,
    _: Annotated[None, Depends(require_admin)],
    repo: Annotated[SqlAlchemyStudyRepository, Depends(get_study_repo)],
    settings: Annotated[AppSettings, Depends(get_app_settings)],
) -> GalleryImageResponse:
    row = await repo.update_gallery_image(image_id, body.title, body.alt_text, body.sort_order)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Gallery image not found")
    await repo.session.commit()
    return _gallery_to_response(row, settings)


@router.delete("/gallery/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_gallery_image_route(
    image_id: UUID,
    _: Annotated[None, Depends(require_admin)],
    repo: Annotated[SqlAlchemyStudyRepository, Depends(get_study_repo)],
    storage: Annotated[AbstractStorageRepository, Depends(get_storage_repo)],
) -> None:
    import asyncio
    row = await repo.delete_gallery_image(image_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Gallery image not found")
    await asyncio.to_thread(storage.delete_gallery_image, row.storage_key)
    await repo.session.commit()


@router.get("/gallery/{image_id}/image")
async def get_gallery_image_file(
    image_id: UUID,
    _: Annotated[None, Depends(require_admin)],
    repo: Annotated[SqlAlchemyStudyRepository, Depends(get_study_repo)],
    storage: Annotated[AbstractStorageRepository, Depends(get_storage_repo)],
) -> Response:
    import asyncio
    row = await repo.get_gallery_image(image_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Gallery image not found")
    data = await asyncio.to_thread(storage.read_gallery_image, row.storage_key)
    if data is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Image file not found")
    return Response(content=data, media_type=row.content_type)

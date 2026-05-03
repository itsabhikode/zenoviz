from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response

from src.config.app_settings import AppSettings
from src.dependencies import get_app_settings, get_booking_service, get_current_user, get_study_repo
from src.domain.user import CurrentUser
from src.models.study_api import (
    AvailabilityCheckRequest,
    AvailabilityCheckResponse,
    BookingResponse,
    CreateBookingRequest,
    GalleryImageResponse,
    PaymentSettingsResponse,
    PricingConfigResponse,
    SeatsAvailabilityRequest,
    SeatsAvailabilityResponse,
)
from src.repositories.impl.study_repository_sqlalchemy import SqlAlchemyStudyRepository
from src.services.booking_service import (
    BookingService,
    booking_to_response,
    payment_settings_to_response,
    pricing_to_response,
)

router = APIRouter(prefix="/study-room", tags=["study-room"])


def _map_http(exc: ValueError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/pricing", response_model=PricingConfigResponse)
async def get_public_pricing(
    svc: Annotated[BookingService, Depends(get_booking_service)],
) -> PricingConfigResponse:
    row = await svc.get_active_pricing_public()
    return pricing_to_response(row)


@router.get("/gallery", response_model=list[GalleryImageResponse])
async def get_public_gallery(
    repo: Annotated[SqlAlchemyStudyRepository, Depends(get_study_repo)],
    settings: Annotated[AppSettings, Depends(get_app_settings)],
) -> list[GalleryImageResponse]:
    from typing import Any
    rows = await repo.list_gallery_images()
    result: list[GalleryImageResponse] = []
    for img in rows:
        if settings.payment_qr_public_base_url:
            base = settings.payment_qr_public_base_url.rstrip("/")
            url = f"{base}/gallery/{img.storage_key.split('/')[-1]}"
        else:
            url = f"/study-room/gallery/{img.id}/image"
        result.append(GalleryImageResponse(
            id=img.id, title=img.title, alt_text=img.alt_text,
            image_url=url, sort_order=img.sort_order, created_at=img.created_at,
        ))
    return result


@router.get("/gallery/{image_id}/image")
async def get_public_gallery_image(
    image_id: UUID,
    repo: Annotated[SqlAlchemyStudyRepository, Depends(get_study_repo)],
) -> Response:
    import asyncio
    from src.dependencies import get_storage_repo as _get_storage_repo
    row = await repo.get_gallery_image(image_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Image not found")
    # Read inline — can't easily inject storage here without Depends chain
    from src.dependencies import get_app_settings as _gas, get_cognito_settings as _gcs
    app_s = _gas()
    cog_s = _gcs()
    if app_s.s3_uploads_bucket:
        from src.repositories.impl.s3_storage_repository import S3StorageRepository
        storage = S3StorageRepository(
            bucket=app_s.s3_uploads_bucket, prefix=app_s.s3_uploads_prefix,
            region=cog_s.cognito_region,
            aws_access_key_id=cog_s.aws_access_key_id,
            aws_secret_access_key=cog_s.aws_secret_access_key,
            aws_session_token=cog_s.aws_session_token,
        )
    else:
        from src.repositories.impl.local_storage_repository import LocalStorageRepository
        storage = LocalStorageRepository(upload_dir=app_s.payment_upload_dir, qr_dir=app_s.payment_qr_dir)
    data = await asyncio.to_thread(storage.read_gallery_image, row.storage_key)
    if data is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Image file not found")
    return Response(content=data, media_type=row.content_type, headers={"Cache-Control": "public, max-age=86400"})


@router.post("/availability", response_model=AvailabilityCheckResponse)
async def post_check_availability(
    body: AvailabilityCheckRequest,
    _: Annotated[CurrentUser, Depends(get_current_user)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
) -> AvailabilityCheckResponse:
    try:
        return await svc.check_availability(body)
    except ValueError as exc:
        raise _map_http(exc) from exc


@router.post("/seats/availability", response_model=SeatsAvailabilityResponse)
async def post_seats_availability(
    body: SeatsAvailabilityRequest,
    _: Annotated[CurrentUser, Depends(get_current_user)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
) -> SeatsAvailabilityResponse:
    try:
        return await svc.seats_availability(body)
    except ValueError as exc:
        raise _map_http(exc) from exc


@router.post("/bookings", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def post_create_booking(
    body: CreateBookingRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
) -> BookingResponse:
    try:
        b = await svc.create_booking(user.user_id, body)
        return BookingResponse.model_validate(booking_to_response(b))
    except ValueError as exc:
        raise _map_http(exc) from exc


@router.put("/bookings/{booking_id}", response_model=BookingResponse)
async def put_update_booking(
    booking_id: UUID,
    body: CreateBookingRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
) -> BookingResponse:
    try:
        b = await svc.update_booking(user.user_id, booking_id, body)
        return BookingResponse.model_validate(booking_to_response(b))
    except ValueError as exc:
        raise _map_http(exc) from exc


@router.post("/bookings/{booking_id}/payment-proof", response_model=BookingResponse)
async def post_payment_proof(
    booking_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
    file: UploadFile = File(...),
) -> BookingResponse:
    try:
        raw = await file.read()
        b = await svc.upload_payment_proof(user.user_id, booking_id, file.filename or "proof.png", raw)
        return BookingResponse.model_validate(booking_to_response(b))
    except ValueError as exc:
        raise _map_http(exc) from exc


@router.get("/bookings", response_model=list[BookingResponse])
async def get_my_bookings(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
) -> list[BookingResponse]:
    rows = await svc.list_my_bookings(user.user_id)
    return [BookingResponse.model_validate(booking_to_response(b)) for b in rows]


@router.get("/bookings/{booking_id}", response_model=BookingResponse)
async def get_booking(
    booking_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
) -> BookingResponse:
    b = await svc.get_my_booking(user.user_id, booking_id)
    if b is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    return BookingResponse.model_validate(booking_to_response(b))


@router.get("/payment-settings", response_model=PaymentSettingsResponse)
async def get_payment_settings(
    _: Annotated[CurrentUser, Depends(get_current_user)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
    settings: Annotated[AppSettings, Depends(get_app_settings)],
) -> PaymentSettingsResponse:
    row = await svc.get_payment_settings()
    return payment_settings_to_response(row, settings=settings)


@router.get("/payment-settings/qr")
async def get_payment_qr(
    _: Annotated[CurrentUser, Depends(get_current_user)],
    svc: Annotated[BookingService, Depends(get_booking_service)],
) -> Response:
    result = await svc.read_payment_qr_bytes()
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No QR uploaded")
    data, content_type = result
    return Response(
        content=data,
        media_type=content_type,
        headers={"Cache-Control": "no-cache"},
    )

from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import UUID

from src.config.app_settings import AppSettings
from src.domain.study_pricing import PricingConfigSnapshot, compute_stored_breakdown
from src.domain.study_room_rules import (
    AccessType,
    category_for_duration,
    duration_days,
    expand_day_slot_rows,
    intervals_overlap,
    iter_booking_dates,
    minute_to_time,
    resolve_window,
)
from src.models.orm.study_room import (
    Booking,
    BookingStatus,
    PaymentSettings,
    PricingConfig,
    SeatBookingDay,
)
from src.models.study_api import (
    AvailabilityCheckRequest,
    AvailabilityCheckResponse,
    CreateBookingRequest,
    PaymentSettingsResponse,
    PriceBreakdownResponse,
    PricingConfigResponse,
    SeatsAvailabilityRequest,
    SeatsAvailabilityResponse,
    UpdatePaymentSettingsRequest,
    UpdatePricingRequest,
)
from src.repositories.study_repository import AbstractStudyRepository


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _today_utc() -> date:
    return _utcnow().date()


def _snapshot_from_pricing(row: PricingConfig) -> PricingConfigSnapshot:
    return PricingConfigSnapshot(
        daily_base_price=row.daily_base_price,
        weekly_base_price=row.weekly_base_price,
        monthly_base_price=row.monthly_base_price,
        daily_discount_percent=row.daily_discount_percent,
        weekly_discount_percent=row.weekly_discount_percent,
        monthly_discount_percent=row.monthly_discount_percent,
        anytime_surcharge_percent=row.anytime_surcharge_percent,
    )


def _breakdown_response(b: dict[str, Any]) -> PriceBreakdownResponse:
    return PriceBreakdownResponse(
        category=str(b["category"]),
        access_type=str(b["access_type"]),
        base_price=str(b["base_price"]),
        discount_percent=str(b["discount_percent"]),
        discounted_price=str(b["discounted_price"]),
        anytime_surcharge_percent=str(b["anytime_surcharge_percent"]),
        surcharge=str(b["surcharge"]),
        final_price=str(b["final_price"]),
    )


TOTAL_SEATS = 65


def _has_conflict(
    new_start: int,
    new_end: int,
    booked_by_date: dict[date, list[tuple[int, int]]],
    dates: list[date],
) -> bool:
    for d in dates:
        for (s, e) in booked_by_date.get(d, ()):
            if intervals_overlap(new_start, new_end, s, e):
                return True
    return False


class BookingService:
    def __init__(self, repo: AbstractStudyRepository, settings: AppSettings) -> None:
        self._repo = repo
        self._settings = settings

    def _validate_dates(self, start: date, end: date) -> int:
        if end < start:
            raise ValueError("end_date must be on or after start_date")
        if start < _today_utc():
            raise ValueError("start_date cannot be in the past")
        return duration_days(start, end)

    def _parse_access(self, raw: str) -> AccessType:
        try:
            return AccessType(raw)
        except ValueError as exc:
            raise ValueError("access_type must be 'timeslot' or 'anytime'") from exc

    async def _resolve_pricing_and_window(
        self,
        access: AccessType,
        start_time: time | None,
        end_time: time | None,
    ) -> tuple[PricingConfig, int, int]:
        pricing = await self._repo.get_active_pricing()
        if pricing is None:
            raise ValueError("No active pricing configuration")
        start_min, end_min = resolve_window(
            access,
            start_time,
            end_time,
            pricing.business_open_minute,
            pricing.business_close_minute,
        )
        return pricing, start_min, end_min

    async def seats_availability(
        self, body: SeatsAvailabilityRequest
    ) -> SeatsAvailabilityResponse:
        """Return the set of seat IDs that already conflict with the requested window.

        Used by the seat-picker UI to render a single-shot grid without 65 round-trips.
        Callers still pass their seat_id through the regular availability/create path,
        which re-locks and re-checks authoritatively.
        """
        access = self._parse_access(body.access_type)
        self._validate_dates(body.start_date, body.end_date)
        _pricing, start_min, end_min = await self._resolve_pricing_and_window(
            access, body.start_time, body.end_time
        )
        dates = iter_booking_dates(body.start_date, body.end_date)
        per_seat = await self._repo.load_booked_intervals_all_seats(dates)

        unavailable: list[int] = []
        for sid, by_date in per_seat.items():
            if _has_conflict(start_min, end_min, by_date, dates):
                unavailable.append(sid)
        unavailable.sort()
        return SeatsAvailabilityResponse(
            total_seats=TOTAL_SEATS,
            unavailable_seat_ids=unavailable,
        )

    async def check_availability(self, body: AvailabilityCheckRequest) -> AvailabilityCheckResponse:
        access = self._parse_access(body.access_type)
        days = self._validate_dates(body.start_date, body.end_date)
        category = category_for_duration(days)
        pricing, start_min, end_min = await self._resolve_pricing_and_window(
            access, body.start_time, body.end_time
        )

        snap = _snapshot_from_pricing(pricing)
        final, breakdown_dict = compute_stored_breakdown(
            category=category,
            access_type=access,
            cfg=snap,
        )
        dates = iter_booking_dates(body.start_date, body.end_date)
        booked = await self._repo.load_booked_intervals(body.seat_id, dates)
        conflict = _has_conflict(start_min, end_min, booked, dates)
        reason = "Seat not available for the requested window" if conflict else None
        return AvailabilityCheckResponse(
            available=not conflict,
            reason=reason,
            duration_days=days,
            category=category.value,
            final_price=str(final),
            breakdown=_breakdown_response(breakdown_dict),
        )

    async def create_booking(self, user_id: str, body: CreateBookingRequest) -> Booking:
        access = self._parse_access(body.access_type)
        days = self._validate_dates(body.start_date, body.end_date)
        category = category_for_duration(days)
        pricing, start_min, end_min = await self._resolve_pricing_and_window(
            access, body.start_time, body.end_time
        )

        snap = _snapshot_from_pricing(pricing)
        final_price, breakdown_dict = compute_stored_breakdown(
            category=category,
            access_type=access,
            cfg=snap,
        )
        dates = iter_booking_dates(body.start_date, body.end_date)
        now = _utcnow()
        reserved_until = now + timedelta(minutes=pricing.reservation_timeout_minutes)

        seat = await self._repo.lock_seat_row(body.seat_id)
        if seat is None:
            raise ValueError("Invalid seat_id")

        booked = await self._repo.load_booked_intervals(body.seat_id, dates)
        if _has_conflict(start_min, end_min, booked, dates):
            raise ValueError("Seat not available for the requested window")

        day_specs = expand_day_slot_rows(body.seat_id, dates, start_min, end_min)
        bid = uuid.uuid4()
        day_rows = [
            SeatBookingDay(
                id=uuid.uuid4(),
                booking_id=bid,
                seat_id=sid,
                booking_date=d,
                start_minute=s,
                end_minute=e,
            )
            for sid, d, s, e in day_specs
        ]

        booking = Booking(
            id=bid,
            user_id=user_id,
            seat_id=body.seat_id,
            start_date=body.start_date,
            end_date=body.end_date,
            access_type=access.value,
            start_minute=start_min,
            end_minute=end_min,
            category=category.value,
            duration_days=days,
            status=BookingStatus.RESERVED.value,
            reserved_until=reserved_until,
            final_price=final_price,
            price_breakdown=breakdown_dict,
            payment_proof_path=None,
            created_at=now,
            updated_at=now,
        )
        await self._repo.insert_booking(booking, day_rows)
        return booking

    async def update_booking(
        self, user_id: str, booking_id: UUID, body: CreateBookingRequest
    ) -> Booking:
        """Modify an existing booking (seat/dates/slot/access type).

        Price-delta rules, by current status:
        - RESERVED / PAYMENT_PENDING: any change allowed. Booking is reset to
          RESERVED, the expiry timer is refreshed, and any uploaded proof is
          discarded (since it was for the old amount).
        - COMPLETED (admin-approved paid): only upgrades or same-price changes
          allowed (new_final >= paid_amount). If new_final == paid_amount we
          keep the booking COMPLETED. If new_final > paid_amount the booking
          flips to RESERVED with a fresh expiry — the user must upload new
          proof for the top-up (new_final - paid_amount), which the admin
          re-approves. A cheaper change is rejected with a clear error.
        - Other statuses (REJECTED/EXPIRED) are not editable.
        """
        booking = await self._repo.get_booking(booking_id)
        if booking is None or booking.user_id != user_id:
            raise ValueError("Booking not found")
        editable = {
            BookingStatus.RESERVED.value,
            BookingStatus.PAYMENT_PENDING.value,
            BookingStatus.COMPLETED.value,
        }
        if booking.status not in editable:
            raise ValueError(
                f"Booking cannot be edited (status: {booking.status.upper()})"
            )

        access = self._parse_access(body.access_type)
        days = self._validate_dates(body.start_date, body.end_date)
        category = category_for_duration(days)
        pricing, start_min, end_min = await self._resolve_pricing_and_window(
            access, body.start_time, body.end_time
        )
        snap = _snapshot_from_pricing(pricing)
        new_final, new_breakdown = compute_stored_breakdown(
            category=category, access_type=access, cfg=snap,
        )

        seat = await self._repo.lock_seat_row(body.seat_id)
        if seat is None:
            raise ValueError("Invalid seat_id")

        dates = iter_booking_dates(body.start_date, body.end_date)
        booked = await self._repo.load_booked_intervals(
            body.seat_id, dates, exclude_booking_id=booking.id
        )
        if _has_conflict(start_min, end_min, booked, dates):
            raise ValueError("Seat not available for the requested window")

        paid = Decimal(booking.paid_amount or 0)
        was_completed = booking.status == BookingStatus.COMPLETED.value
        if was_completed and new_final < paid:
            raise ValueError(
                "Paid bookings cannot be changed to a cheaper plan. "
                f"Already paid ₹{paid}, new total would be ₹{new_final}."
            )

        now = _utcnow()

        # Replace day slots wholesale. Safe because we just checked availability
        # with this booking excluded, and the seat is locked for the txn.
        await self._repo.delete_day_slots_for_booking(booking.id)
        day_specs = expand_day_slot_rows(body.seat_id, dates, start_min, end_min)
        day_rows = [
            SeatBookingDay(
                id=uuid.uuid4(),
                booking_id=booking.id,
                seat_id=sid,
                booking_date=d,
                start_minute=s,
                end_minute=e,
            )
            for sid, d, s, e in day_specs
        ]
        await self._repo.add_day_slots(day_rows)

        booking.seat_id = body.seat_id
        booking.start_date = body.start_date
        booking.end_date = body.end_date
        booking.access_type = access.value
        booking.start_minute = start_min
        booking.end_minute = end_min
        booking.category = category.value
        booking.duration_days = days
        booking.final_price = new_final
        booking.price_breakdown = new_breakdown
        booking.updated_at = now

        if was_completed and new_final == paid:
            # No monetary change — stay COMPLETED, keep proof path intact.
            pass
        else:
            # Either a pre-payment edit or a paid booking that needs a top-up.
            # Reset to RESERVED so the user has time to pay (the delta, for
            # upgrades; the full amount otherwise) and upload fresh proof.
            booking.status = BookingStatus.RESERVED.value
            booking.reserved_until = now + timedelta(
                minutes=pricing.reservation_timeout_minutes
            )
            booking.payment_proof_path = None

        await self._repo.flush()
        return booking

    async def upload_payment_proof(self, user_id: str, booking_id: UUID, filename: str, data: bytes) -> Booking:
        if len(data) > self._settings.max_payment_proof_bytes:
            raise ValueError("File too large")

        ext = Path(filename).suffix.lower()
        if ext not in (".png", ".jpg", ".jpeg", ".webp"):
            raise ValueError("Only png, jpg, jpeg, webp images are allowed")

        booking = await self._repo.get_booking(booking_id)
        if booking is None or booking.user_id != user_id:
            raise ValueError("Booking not found")
        if booking.status != BookingStatus.RESERVED.value:
            raise ValueError("Booking is not awaiting payment proof")
        if booking.reserved_until is not None and _utcnow() > _as_utc_aware(booking.reserved_until):
            raise ValueError("Reservation has expired")

        upload_dir = Path(self._settings.payment_upload_dir)
        upload_dir.mkdir(parents=True, exist_ok=True)
        stored = upload_dir / f"{booking_id}{ext}"
        stored.write_bytes(data)

        booking.payment_proof_path = str(stored.resolve())
        booking.status = BookingStatus.PAYMENT_PENDING.value
        booking.reserved_until = None
        booking.updated_at = _utcnow()
        await self._repo.flush()
        return booking

    async def list_my_bookings(self, user_id: str) -> list[Booking]:
        return await self._repo.list_user_bookings(user_id)

    async def get_my_booking(self, user_id: str, booking_id: UUID) -> Booking | None:
        booking = await self._repo.get_booking(booking_id)
        if booking is None or booking.user_id != user_id:
            return None
        return booking

    async def list_pending_payments(self) -> list[Booking]:
        return await self._repo.list_pending_payment_bookings()

    async def list_all_bookings(self, status: str | None = None) -> list[Booking]:
        """Admin: list every booking in the system, optionally filtered by status.

        Status is matched case-insensitively against the DB enum values
        ("reserved", "payment_pending", etc.) so callers may pass the uppercase
        wire format used by the frontend (e.g. "PAYMENT_PENDING").
        """
        normalized: str | None = None
        if status is not None and status.strip():
            canonical = status.strip().lower()
            valid = {s.value for s in BookingStatus}
            if canonical not in valid:
                raise ValueError(
                    f"Invalid status '{status}'. Valid: {sorted(valid)}"
                )
            normalized = canonical
        return await self._repo.list_all_bookings(normalized)

    async def approve_payment(
        self, booking_id: UUID, amount: Decimal | None = None
    ) -> Booking:
        """Credit an admin-verified payment to a booking.

        `amount` is the value the admin reads off the UPI screenshot. It's
        added cumulatively to `paid_amount` so partial payments and post-edit
        top-ups fold into the same code path:

        - fully paid (paid_amount >= final_price) → status = COMPLETED, proof kept.
        - under-paid (paid_amount < final_price) → status = RESERVED with a
          fresh expiry; the old proof is cleared so the user uploads a new
          screenshot for the remainder.

        `amount=None` means "credit whatever is still owed" — the clean-path
        default when admin just clicks Approve on a matching screenshot.
        """
        booking = await self._repo.get_booking(booking_id)
        if booking is None:
            raise ValueError("Booking not found")
        if booking.status != BookingStatus.PAYMENT_PENDING.value:
            raise ValueError("Booking is not pending payment approval")

        already_paid = Decimal(booking.paid_amount or 0)
        final = Decimal(booking.final_price)
        outstanding = max(final - already_paid, Decimal("0"))
        credit = Decimal(amount) if amount is not None else outstanding
        if credit <= 0:
            raise ValueError("Amount must be greater than zero")

        pricing = await self._repo.get_active_pricing()
        if pricing is None:
            raise ValueError("No active pricing configuration")

        now = _utcnow()
        booking.paid_amount = (already_paid + credit).quantize(Decimal("0.01"))
        booking.updated_at = now

        if booking.paid_amount >= final:
            booking.status = BookingStatus.COMPLETED.value
        else:
            # Partial credit recorded; hand control back to the user to settle
            # the rest. Clearing the proof keeps the pending-payments queue
            # free of stale screenshots that have already been verified.
            booking.status = BookingStatus.RESERVED.value
            booking.reserved_until = now + timedelta(
                minutes=pricing.reservation_timeout_minutes
            )
            booking.payment_proof_path = None

        await self._repo.flush()
        return booking

    async def reject_payment(self, booking_id: UUID) -> Booking:
        booking = await self._repo.get_booking(booking_id)
        if booking is None:
            raise ValueError("Booking not found")
        if booking.status != BookingStatus.PAYMENT_PENDING.value:
            raise ValueError("Booking is not pending payment approval")
        await self._repo.delete_day_slots_for_booking(booking_id)
        booking.status = BookingStatus.REJECTED.value
        booking.updated_at = _utcnow()
        await self._repo.flush()
        return booking

    async def update_pricing(self, body: UpdatePricingRequest) -> PricingConfig:
        now = _utcnow()
        open_min = body.business_open_time.hour * 60 + body.business_open_time.minute
        close_min = body.business_close_time.hour * 60 + body.business_close_time.minute
        if close_min <= open_min:
            raise ValueError("business_close_time must be after business_open_time")
        await self._repo.deactivate_all_pricing()
        row = PricingConfig(
            is_active=True,
            daily_base_price=body.daily_base_price,
            weekly_base_price=body.weekly_base_price,
            monthly_base_price=body.monthly_base_price,
            daily_discount_percent=body.daily_discount_percent,
            weekly_discount_percent=body.weekly_discount_percent,
            monthly_discount_percent=body.monthly_discount_percent,
            anytime_surcharge_percent=body.anytime_surcharge_percent,
            reservation_timeout_minutes=body.reservation_timeout_minutes,
            business_open_minute=open_min,
            business_close_minute=close_min,
            created_at=now,
        )
        await self._repo.insert_pricing_config(row)
        return row

    async def get_active_pricing_public(self) -> PricingConfig:
        row = await self._repo.get_active_pricing()
        if row is None:
            raise ValueError("No active pricing configuration")
        return row

    async def get_payment_settings(self) -> PaymentSettings | None:
        return await self._repo.get_payment_settings()

    async def update_payment_settings(
        self,
        body: UpdatePaymentSettingsRequest,
        user_id: str,
    ) -> PaymentSettings:
        row = PaymentSettings(
            id=uuid.uuid4(),
            upi_vpa=body.upi_vpa,
            payee_name=body.payee_name,
            instructions=body.instructions,
            qr_filename=None,
            qr_content_type=None,
            updated_at=_utcnow(),
            updated_by=user_id,
        )
        return await self._repo.upsert_payment_settings(row)

    async def upload_payment_qr(
        self,
        filename: str,
        data: bytes,
        user_id: str,
        content_type: str | None,
    ) -> PaymentSettings:
        if len(data) == 0:
            raise ValueError("Empty file")
        if len(data) > self._settings.max_payment_qr_bytes:
            raise ValueError("File too large")

        ext = Path(filename).suffix.lower()
        if ext not in (".png", ".jpg", ".jpeg", ".webp"):
            raise ValueError("Only png, jpg, jpeg, webp images are allowed")

        qr_dir = Path(self._settings.payment_qr_dir)
        qr_dir.mkdir(parents=True, exist_ok=True)
        stored_name = f"qr{ext}"
        stored_path = qr_dir / stored_name
        stored_path.write_bytes(data)

        row = PaymentSettings(
            id=uuid.uuid4(),
            upi_vpa=None,
            payee_name=None,
            instructions=None,
            qr_filename=stored_name,
            qr_content_type=content_type or f"image/{ext.lstrip('.')}",
            updated_at=_utcnow(),
            updated_by=user_id,
        )
        return await self._repo.upsert_payment_settings(row)

    async def read_payment_qr_bytes(self) -> tuple[bytes, str] | None:
        row = await self._repo.get_payment_settings()
        if row is None or not row.qr_filename:
            return None
        path = Path(self._settings.payment_qr_dir) / row.qr_filename
        if not path.exists():
            return None
        return path.read_bytes(), (row.qr_content_type or "application/octet-stream")


_MONEY_Q = Decimal("0.01")


def _money(value: Decimal | int | str | None) -> str:
    """Render monetary values with a consistent 2dp wire format ("X.XX").

    SQLite (used in tests) doesn't preserve Numeric scale, and the default on
    `Booking.paid_amount` stores `Decimal("0")` which would otherwise surface
    as the bare string "0". Quantizing here keeps admin views and the edit UI
    doing straightforward decimal math on the delta.
    """
    if value is None:
        return "0.00"
    return str(Decimal(value).quantize(_MONEY_Q))


def booking_to_response(b: Booking) -> dict[str, Any]:
    paid = Decimal(b.paid_amount or 0)
    final = Decimal(b.final_price or 0)
    due = final - paid
    if due < 0:
        due = Decimal("0")
    return {
        "id": b.id,
        "user_id": b.user_id,
        "seat_id": b.seat_id,
        "start_date": b.start_date,
        "end_date": b.end_date,
        "access_type": b.access_type,
        "start_time": minute_to_time(b.start_minute),
        "end_time": minute_to_time(b.end_minute),
        "category": b.category,
        "duration_days": b.duration_days,
        # Status is stored lowercase in DB (enum .value) but the frontend treats
        # BookingStatus as uppercase identifiers. Uppercase on the way out so
        # clients don't need a case-normaliser.
        "status": (b.status or "").upper(),
        "reserved_until": b.reserved_until,
        "final_price": _money(final),
        "paid_amount": _money(paid),
        "amount_due": _money(due),
        "breakdown": b.price_breakdown,
        "payment_proof_path": b.payment_proof_path,
        "created_at": b.created_at,
        "updated_at": b.updated_at,
    }


def payment_settings_to_response(
    row: PaymentSettings | None,
) -> PaymentSettingsResponse:
    if row is None:
        return PaymentSettingsResponse(
            upi_vpa=None,
            payee_name=None,
            instructions=None,
            has_qr=False,
            qr_content_type=None,
            updated_at=None,
        )
    return PaymentSettingsResponse(
        upi_vpa=row.upi_vpa,
        payee_name=row.payee_name,
        instructions=row.instructions,
        has_qr=bool(row.qr_filename),
        qr_content_type=row.qr_content_type,
        updated_at=row.updated_at,
    )


def pricing_to_response(p: PricingConfig) -> PricingConfigResponse:
    return PricingConfigResponse(
        id=p.id,
        is_active=p.is_active,
        daily_base_price=str(p.daily_base_price),
        weekly_base_price=str(p.weekly_base_price),
        monthly_base_price=str(p.monthly_base_price),
        daily_discount_percent=str(p.daily_discount_percent),
        weekly_discount_percent=str(p.weekly_discount_percent),
        monthly_discount_percent=str(p.monthly_discount_percent),
        anytime_surcharge_percent=str(p.anytime_surcharge_percent),
        reservation_timeout_minutes=p.reservation_timeout_minutes,
        business_open_time=minute_to_time(p.business_open_minute),
        business_close_time=minute_to_time(p.business_close_minute),
        created_at=p.created_at,
    )

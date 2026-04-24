from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

AccessTypeApi = Literal["timeslot", "anytime"]


class AvailabilityCheckRequest(BaseModel):
    seat_id: int = Field(..., ge=1, le=65)
    start_date: date
    end_date: date
    access_type: AccessTypeApi
    start_time: time | None = Field(
        None,
        description="HH:MM, required when access_type=timeslot; must equal end_time-3h",
    )
    end_time: time | None = Field(
        None,
        description="HH:MM, required when access_type=timeslot",
    )
    with_locker: bool = False


class PriceBreakdownResponse(BaseModel):
    category: str
    access_type: str
    base_price: str
    discount_percent: str
    discounted_price: str
    anytime_surcharge_percent: str
    surcharge: str
    final_price: str
    locker_fee: str = "0"


class AvailabilityCheckResponse(BaseModel):
    available: bool
    reason: str | None = None
    duration_days: int
    category: str
    final_price: str
    breakdown: PriceBreakdownResponse


class SeatsAvailabilityRequest(BaseModel):
    start_date: date
    end_date: date
    access_type: AccessTypeApi
    start_time: time | None = None
    end_time: time | None = None


class SeatsAvailabilityResponse(BaseModel):
    total_seats: int
    unavailable_seat_ids: list[int]
    disabled_seat_ids: list[int] = Field(
        default_factory=list,
        description="Seats turned off by admin (also listed in unavailable_seat_ids).",
    )


class SeatResponse(BaseModel):
    id: int
    label: str
    is_enabled: bool


class UpdateSeatEnabledRequest(BaseModel):
    is_enabled: bool


class CreateBookingRequest(BaseModel):
    seat_id: int = Field(..., ge=1, le=65)
    start_date: date
    end_date: date
    access_type: AccessTypeApi
    start_time: time | None = None
    end_time: time | None = None
    with_locker: bool = False


class UserSummaryResponse(BaseModel):
    """Lightweight user profile shown alongside a booking in admin views.

    The canonical identifier for API calls remains `BookingResponse.user_id`; this
    payload is purely for human-friendly display (name, contact info).
    """

    user_id: str
    email: str | None = None
    given_name: str | None = None
    family_name: str | None = None
    phone_number: str | None = None


class BookingResponse(BaseModel):
    id: UUID
    user_id: str
    seat_id: int
    start_date: date
    end_date: date
    access_type: str
    start_time: time
    end_time: time
    category: str
    duration_days: int
    status: str
    reserved_until: datetime | None
    final_price: str
    # Running total of payments admin has approved against this booking.
    # Zero until admin approves. When the booking is edited to a higher tier,
    # `final_price` goes up but `paid_amount` stays — the frontend shows
    # `amount_due` as the top-up the user still owes.
    paid_amount: str = "0"
    amount_due: str = "0"
    with_locker: bool = False
    breakdown: dict[str, Any]
    payment_proof_path: str | None
    created_at: datetime
    updated_at: datetime | None
    # Optional: populated for admin-facing endpoints (list all bookings,
    # pending payments). Regular user endpoints leave this as None.
    user: UserSummaryResponse | None = None


class UpdatePricingRequest(BaseModel):
    daily_base_price: Decimal
    weekly_base_price: Decimal
    monthly_base_price: Decimal
    daily_discount_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    weekly_discount_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    monthly_discount_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    anytime_surcharge_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    locker_daily_price: Decimal = Field(default=Decimal("0"), ge=0)
    locker_weekly_price: Decimal = Field(default=Decimal("0"), ge=0)
    locker_monthly_price: Decimal = Field(default=Decimal("0"), ge=0)
    reservation_timeout_minutes: int = Field(..., ge=1, le=10080)
    business_open_time: time = Field(
        default=time(9, 0),
        description="Room opens at this wall-clock time (local)",
    )
    business_close_time: time = Field(
        default=time(21, 0),
        description="Room closes at this wall-clock time (local)",
    )


class AdminApproveRequest(BaseModel):
    """Body for admin approval. Since payments are screenshot-based (UPI), the
    admin types the amount they actually see in the proof instead of us
    assuming the full `final_price` was paid. Leaving `amount` unset falls
    back to "whatever is still owed" (the expected case for a clean payment).
    """

    amount: Decimal | None = Field(
        default=None,
        gt=0,
        description="Amount to credit from this screenshot. Defaults to the current amount_due.",
    )


class UpdatePaymentSettingsRequest(BaseModel):
    upi_vpa: str | None = Field(default=None, max_length=128)
    payee_name: str | None = Field(default=None, max_length=128)
    instructions: str | None = Field(default=None, max_length=2000)


class PaymentSettingsResponse(BaseModel):
    upi_vpa: str | None
    payee_name: str | None
    instructions: str | None
    has_qr: bool
    qr_content_type: str | None
    qr_public_url: str | None = None
    updated_at: datetime | None


class PricingConfigResponse(BaseModel):
    id: UUID
    is_active: bool
    daily_base_price: str
    weekly_base_price: str
    monthly_base_price: str
    daily_discount_percent: str
    weekly_discount_percent: str
    monthly_discount_percent: str
    anytime_surcharge_percent: str
    locker_daily_price: str
    locker_weekly_price: str
    locker_monthly_price: str
    reservation_timeout_minutes: int
    business_open_time: time
    business_close_time: time
    created_at: datetime

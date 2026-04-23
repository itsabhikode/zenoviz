import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import JSON, Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base


class BookingStatus(str, enum.Enum):
    RESERVED = "reserved"
    PAYMENT_PENDING = "payment_pending"
    COMPLETED = "completed"
    REJECTED = "rejected"
    EXPIRED = "expired"


class Seat(Base):
    __tablename__ = "seats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    label: Mapped[str] = mapped_column(String(32), default="")
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())


class PricingConfig(Base):
    __tablename__ = "pricing_configs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    is_active: Mapped[bool] = mapped_column(default=False, index=True)
    daily_base_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    weekly_base_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    monthly_base_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    daily_discount_percent: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=Decimal("0"))
    weekly_discount_percent: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=Decimal("0"))
    monthly_discount_percent: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=Decimal("0"))
    anytime_surcharge_percent: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=Decimal("0"))
    reservation_timeout_minutes: Mapped[int] = mapped_column(Integer, default=30)
    business_open_minute: Mapped[int] = mapped_column(Integer, default=9 * 60)
    business_close_minute: Mapped[int] = mapped_column(Integer, default=21 * 60)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    seat_id: Mapped[int] = mapped_column(ForeignKey("seats.id"), index=True)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    access_type: Mapped[str] = mapped_column(String(16))
    start_minute: Mapped[int] = mapped_column(Integer)
    end_minute: Mapped[int] = mapped_column(Integer)
    category: Mapped[str] = mapped_column(String(16))
    duration_days: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(24), index=True)
    reserved_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    final_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    # Running total of amounts actually paid (i.e. admin-approved). Stays at 0
    # until admin approves a payment; after an edit that pushes final_price up,
    # `final_price - paid_amount` is the top-up owed by the user.
    paid_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0"), server_default="0"
    )
    price_breakdown: Mapped[dict[str, Any]] = mapped_column(JSON)
    payment_proof_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: Last fully paid plan, saved before an edit that increases :attr:`final_price` above
    #: :attr:`paid_amount` so the expiry job can restore it if the top-up times out.
    reversion_snapshot: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    seat: Mapped["Seat"] = relationship()
    day_slots: Mapped[list["SeatBookingDay"]] = relationship(
        back_populates="booking",
        cascade="all, delete-orphan",
    )


class PaymentSettings(Base):
    """Single-row table holding the shared payment QR + UPI details."""

    __tablename__ = "payment_settings"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    upi_vpa: Mapped[str | None] = mapped_column(String(128), nullable=True)
    payee_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    qr_filename: Mapped[str | None] = mapped_column(String(256), nullable=True)
    qr_content_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_by: Mapped[str | None] = mapped_column(String(128), nullable=True)


class SeatBookingDay(Base):
    __tablename__ = "seat_booking_days"
    __table_args__ = (
        CheckConstraint("start_minute >= 0 AND end_minute > start_minute AND end_minute <= 1440",
                        name="ck_slot_minute_range"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    booking_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), index=True)
    seat_id: Mapped[int] = mapped_column(ForeignKey("seats.id"), index=True)
    booking_date: Mapped[date] = mapped_column(Date)
    start_minute: Mapped[int] = mapped_column(Integer)
    end_minute: Mapped[int] = mapped_column(Integer)

    booking: Mapped["Booking"] = relationship(back_populates="day_slots")

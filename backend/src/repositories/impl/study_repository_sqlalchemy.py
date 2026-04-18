from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.orm.study_room import (
    Booking,
    BookingStatus,
    PaymentSettings,
    PricingConfig,
    Seat,
    SeatBookingDay,
)
from src.repositories.study_repository import AbstractStudyRepository


class SqlAlchemyStudyRepository(AbstractStudyRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    @property
    def session(self) -> AsyncSession:
        return self._session

    async def seed_if_empty(self) -> None:
        n = await self._session.scalar(select(Seat.id).limit(1))
        if n is None:
            self._session.add_all([Seat(id=i, label=f"S{i}") for i in range(1, 66)])
            await self._session.flush()

        p = await self._session.scalar(select(PricingConfig.id).limit(1))
        if p is None:
            now = datetime.now(timezone.utc)
            self._session.add(
                PricingConfig(
                    is_active=True,
                    daily_base_price=Decimal("15.00"),
                    weekly_base_price=Decimal("80.00"),
                    monthly_base_price=Decimal("250.00"),
                    daily_discount_percent=Decimal("0"),
                    weekly_discount_percent=Decimal("5"),
                    monthly_discount_percent=Decimal("10"),
                    anytime_surcharge_percent=Decimal("20"),
                    reservation_timeout_minutes=30,
                    created_at=now,
                )
            )
            await self._session.flush()

    async def get_active_pricing(self) -> PricingConfig | None:
        return await self._session.scalar(
            select(PricingConfig)
            .where(PricingConfig.is_active.is_(True))
            .order_by(PricingConfig.created_at.desc())
            .limit(1)
        )

    async def lock_seat_row(self, seat_id: int) -> Seat | None:
        return await self._session.scalar(
            select(Seat).where(Seat.id == seat_id).with_for_update(),
        )

    async def load_booked_intervals(
        self,
        seat_id: int,
        dates: list[date],
        exclude_booking_id: UUID | None = None,
    ) -> dict[date, list[tuple[int, int]]]:
        if not dates:
            return {}
        stmt = select(
            SeatBookingDay.booking_date,
            SeatBookingDay.start_minute,
            SeatBookingDay.end_minute,
        ).where(
            SeatBookingDay.seat_id == seat_id,
            SeatBookingDay.booking_date.in_(dates),
        )
        if exclude_booking_id is not None:
            stmt = stmt.where(SeatBookingDay.booking_id != exclude_booking_id)
        result = await self._session.execute(stmt)
        out: dict[date, list[tuple[int, int]]] = {}
        for bd, s, e in result.all():
            out.setdefault(bd, []).append((s, e))
        return out

    async def load_booked_intervals_all_seats(
        self,
        dates: list[date],
        exclude_booking_id: UUID | None = None,
    ) -> dict[int, dict[date, list[tuple[int, int]]]]:
        if not dates:
            return {}
        stmt = select(
            SeatBookingDay.seat_id,
            SeatBookingDay.booking_date,
            SeatBookingDay.start_minute,
            SeatBookingDay.end_minute,
        ).where(SeatBookingDay.booking_date.in_(dates))
        if exclude_booking_id is not None:
            stmt = stmt.where(SeatBookingDay.booking_id != exclude_booking_id)
        result = await self._session.execute(stmt)
        out: dict[int, dict[date, list[tuple[int, int]]]] = {}
        for sid, bd, s, e in result.all():
            out.setdefault(sid, {}).setdefault(bd, []).append((s, e))
        return out

    async def insert_booking(self, booking: Booking, day_rows: list[SeatBookingDay]) -> None:
        self._session.add(booking)
        await self._session.flush()
        for r in day_rows:
            r.booking_id = booking.id
            self._session.add(r)
        await self._session.flush()

    async def add_day_slots(self, day_rows: list[SeatBookingDay]) -> None:
        for r in day_rows:
            self._session.add(r)
        await self._session.flush()

    async def get_booking(self, booking_id: UUID) -> Booking | None:
        return await self._session.get(Booking, booking_id)

    async def list_user_bookings(self, user_id: str) -> list[Booking]:
        return list(
            await self._session.scalars(
                select(Booking)
                .where(Booking.user_id == user_id)
                .order_by(Booking.created_at.desc())
            )
        )

    async def list_pending_payment_bookings(self) -> list[Booking]:
        return list(
            await self._session.scalars(
                select(Booking)
                .where(Booking.status == BookingStatus.PAYMENT_PENDING.value)
                .order_by(Booking.created_at.asc())
            )
        )

    async def list_all_bookings(self, status: str | None = None) -> list[Booking]:
        stmt = select(Booking).order_by(Booking.created_at.desc())
        if status is not None:
            stmt = stmt.where(Booking.status == status)
        return list(await self._session.scalars(stmt))

    async def delete_day_slots_for_booking(self, booking_id: UUID) -> None:
        await self._session.execute(delete(SeatBookingDay).where(SeatBookingDay.booking_id == booking_id))

    async def deactivate_all_pricing(self) -> None:
        await self._session.execute(update(PricingConfig).values(is_active=False))

    async def insert_pricing_config(self, row: PricingConfig) -> None:
        self._session.add(row)
        await self._session.flush()

    async def flush(self) -> None:
        await self._session.flush()

    async def get_payment_settings(self) -> PaymentSettings | None:
        return await self._session.scalar(
            select(PaymentSettings).order_by(PaymentSettings.updated_at.desc()).limit(1)
        )

    async def upsert_payment_settings(self, row: PaymentSettings) -> PaymentSettings:
        existing = await self.get_payment_settings()
        if existing is None:
            self._session.add(row)
            await self._session.flush()
            return row

        if row.upi_vpa is not None:
            existing.upi_vpa = row.upi_vpa
        if row.payee_name is not None:
            existing.payee_name = row.payee_name
        if row.instructions is not None:
            existing.instructions = row.instructions
        if row.qr_filename is not None:
            existing.qr_filename = row.qr_filename
        if row.qr_content_type is not None:
            existing.qr_content_type = row.qr_content_type
        existing.updated_at = row.updated_at
        existing.updated_by = row.updated_by
        await self._session.flush()
        return existing

    async def expire_reserved_past(self, now: datetime) -> int:
        rows = list(
            await self._session.scalars(
                select(Booking).where(
                    Booking.status == BookingStatus.RESERVED.value,
                    Booking.reserved_until.is_not(None),
                    Booking.reserved_until < now,
                ).with_for_update()
            )
        )
        ids = [b.id for b in rows]
        if not ids:
            return 0
        await self._session.execute(delete(SeatBookingDay).where(SeatBookingDay.booking_id.in_(ids)))
        await self._session.execute(
            update(Booking)
            .where(Booking.id.in_(ids))
            .values(status=BookingStatus.EXPIRED.value, reserved_until=None, updated_at=now)
        )
        return len(ids)

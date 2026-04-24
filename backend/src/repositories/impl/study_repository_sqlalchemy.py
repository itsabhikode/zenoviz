from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models.orm.study_room import (
    Booking,
    BookingStatus,
    PaymentSettings,
    PricingConfig,
    Seat,
    SeatBookingDay,
)
from src.repositories.study_repository import AbstractStudyRepository


def _as_utc_aware(dt: datetime) -> datetime:
    """SQLite may return offset-naive datetimes; compare against aware ``now`` safely."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


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
                    timeslot_daily_price=Decimal("15.00"),
                    timeslot_weekly_price=Decimal("80.00"),
                    timeslot_monthly_price=Decimal("250.00"),
                    anytime_daily_price=Decimal("20.00"),
                    anytime_weekly_price=Decimal("100.00"),
                    anytime_monthly_price=Decimal("300.00"),
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

    async def get_seat(self, seat_id: int) -> Seat | None:
        return await self._session.scalar(select(Seat).where(Seat.id == seat_id))

    async def list_all_seats(self) -> list[Seat]:
        result = await self._session.scalars(select(Seat).order_by(Seat.id))
        return list(result.all())

    async def list_disabled_seat_ids(self) -> list[int]:
        result = await self._session.scalars(select(Seat.id).where(Seat.is_enabled.is_(False)))
        return sorted(result.all())

    async def set_seat_enabled(self, seat_id: int, enabled: bool) -> Seat | None:
        seat = await self._session.scalar(select(Seat).where(Seat.id == seat_id))
        if seat is None:
            return None
        seat.is_enabled = enabled
        await self._session.flush()
        return seat

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

    async def get_booking_with_day_slots(self, booking_id: UUID) -> Booking | None:
        return await self._session.scalar(
            select(Booking)
            .options(selectinload(Booking.day_slots))
            .where(Booking.id == booking_id)
        )

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
                )
            )
        )
        if not rows:
            return 0
        n = 0
        for b in rows:
            # Lock row in DB for this booking only (portable: re-fetch with FOR UPDATE).
            locked = await self._session.scalar(
                select(Booking).where(Booking.id == b.id).with_for_update()
            )
            if locked is None or locked.reserved_until is None:
                continue
            if _as_utc_aware(locked.reserved_until) >= now:
                continue
            if locked.status != BookingStatus.RESERVED.value:
                continue
            n += 1
            if locked.reversion_snapshot is not None:
                await self._revert_to_paid_plan(locked, now)
            else:
                await self._expire_reserved(locked, now)
        return n

    async def _expire_reserved(self, b: Booking, now: datetime) -> None:
        await self._session.execute(
            delete(SeatBookingDay).where(SeatBookingDay.booking_id == b.id)
        )
        await self._session.execute(
            update(Booking)
            .where(Booking.id == b.id)
            .values(
                status=BookingStatus.EXPIRED.value,
                reserved_until=None,
                updated_at=now,
            )
        )

    async def _revert_to_paid_plan(self, b: Booking, now: datetime) -> None:
        """Restore last fully paid plan from ``reversion_snapshot`` (upgrade top-up timeout)."""
        snap = b.reversion_snapshot
        if not isinstance(snap, dict) or snap.get("v") != 1:
            await self._expire_reserved(b, now)
            return
        try:
            paid = Decimal(str(b.paid_amount or 0))
            target_final = Decimal(str(snap["final_price"]))
        except (KeyError, ValueError, TypeError):
            await self._expire_reserved(b, now)
            return
        if paid < target_final:
            await self._expire_reserved(b, now)
            return
        start_date = date.fromisoformat(str(snap["start_date"]))
        end_date = date.fromisoformat(str(snap["end_date"]))

        await self._session.execute(
            delete(SeatBookingDay).where(SeatBookingDay.booking_id == b.id)
        )
        day_in = snap.get("day_rows") or []
        for dr in day_in:
            drow = SeatBookingDay(
                id=uuid4(),
                booking_id=b.id,
                seat_id=int(dr["seat_id"]),
                booking_date=date.fromisoformat(str(dr["booking_date"])),
                start_minute=int(dr["start_minute"]),
                end_minute=int(dr["end_minute"]),
            )
            self._session.add(drow)

        await self._session.execute(
            update(Booking)
            .where(Booking.id == b.id)
            .values(
                seat_id=int(snap["seat_id"]),
                start_date=start_date,
                end_date=end_date,
                access_type=str(snap["access_type"]),
                start_minute=int(snap["start_minute"]),
                end_minute=int(snap["end_minute"]),
                category=str(snap["category"]),
                duration_days=int(snap["duration_days"]),
                final_price=target_final,
                price_breakdown=snap.get("price_breakdown") or {},
                with_locker=bool(snap.get("with_locker", False)),
                status=BookingStatus.COMPLETED.value,
                reserved_until=None,
                reversion_snapshot=None,
                payment_proof_path=None,
                updated_at=now,
            )
        )

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date, datetime
from uuid import UUID

from src.models.orm.study_room import Booking, PaymentSettings, PricingConfig, Seat, SeatBookingDay


class AbstractStudyRepository(ABC):
    @abstractmethod
    async def seed_if_empty(self) -> None: ...

    @abstractmethod
    async def get_active_pricing(self) -> PricingConfig | None: ...

    @abstractmethod
    async def lock_seat_row(self, seat_id: int) -> Seat | None: ...

    @abstractmethod
    async def load_booked_intervals(
        self,
        seat_id: int,
        dates: list[date],
        exclude_booking_id: UUID | None = None,
    ) -> dict[date, list[tuple[int, int]]]: ...

    @abstractmethod
    async def load_booked_intervals_all_seats(
        self,
        dates: list[date],
        exclude_booking_id: UUID | None = None,
    ) -> dict[int, dict[date, list[tuple[int, int]]]]: ...

    @abstractmethod
    async def insert_booking(
        self,
        booking: Booking,
        day_rows: list[SeatBookingDay],
    ) -> None: ...

    @abstractmethod
    async def add_day_slots(self, day_rows: list[SeatBookingDay]) -> None: ...

    @abstractmethod
    async def get_booking(self, booking_id: UUID) -> Booking | None: ...

    @abstractmethod
    async def list_user_bookings(self, user_id: str) -> list[Booking]: ...

    @abstractmethod
    async def list_pending_payment_bookings(self) -> list[Booking]: ...

    @abstractmethod
    async def list_all_bookings(self, status: str | None = None) -> list[Booking]: ...

    @abstractmethod
    async def delete_day_slots_for_booking(self, booking_id: UUID) -> None: ...

    @abstractmethod
    async def deactivate_all_pricing(self) -> None: ...

    @abstractmethod
    async def insert_pricing_config(self, row: PricingConfig) -> None: ...

    @abstractmethod
    async def expire_reserved_past(self, now: datetime) -> int: ...

    @abstractmethod
    async def flush(self) -> None: ...

    @abstractmethod
    async def get_payment_settings(self) -> PaymentSettings | None: ...

    @abstractmethod
    async def upsert_payment_settings(self, row: PaymentSettings) -> PaymentSettings: ...

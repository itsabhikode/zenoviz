"""Pure booking rules: duration category, time windows, interval overlap."""
from __future__ import annotations

from datetime import date, time, timedelta
from enum import StrEnum


class PriceCategory(StrEnum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class AccessType(StrEnum):
    TIMESLOT = "timeslot"
    ANYTIME = "anytime"


TIMESLOT_DURATION_MINUTES = 180
MINUTES_IN_DAY = 24 * 60


def duration_days(start: date, end: date) -> int:
    if end < start:
        raise ValueError("end_date must be on or after start_date")
    return (end - start).days + 1


def category_for_duration(days: int) -> PriceCategory:
    if days < 7:
        return PriceCategory.DAILY
    if days < 30:
        return PriceCategory.WEEKLY
    return PriceCategory.MONTHLY


def iter_booking_dates(start: date, end: date) -> list[date]:
    duration_days(start, end)
    out: list[date] = []
    d = start
    while d <= end:
        out.append(d)
        d += timedelta(days=1)
    return out


def time_to_minute(t: time) -> int:
    return t.hour * 60 + t.minute


def minute_to_time(m: int) -> time:
    if m >= MINUTES_IN_DAY:
        return time(23, 59)
    return time(m // 60, m % 60)


def intervals_overlap(a_start: int, a_end: int, b_start: int, b_end: int) -> bool:
    return a_start < b_end and b_start < a_end


def resolve_window(
    access_type: AccessType,
    start: time | None,
    end: time | None,
    business_open: int,
    business_close: int,
) -> tuple[int, int]:
    """Return the (start_minute, end_minute) the booking should occupy each day.

    Rules:
    - ANYTIME: user must NOT pass start/end. Window is the full business day.
    - TIMESLOT: user must pass both. Window must be exactly 3h and inside [open, close].
    """
    if business_close <= business_open:
        raise ValueError("Business close must be after business open")

    if access_type == AccessType.ANYTIME:
        if start is not None or end is not None:
            raise ValueError("start_time/end_time must not be provided for anytime access")
        return business_open, business_close

    if start is None or end is None:
        raise ValueError("start_time and end_time are required for timeslot access")

    s = time_to_minute(start)
    e = time_to_minute(end)
    if e <= s:
        raise ValueError("end_time must be after start_time")
    if e - s != TIMESLOT_DURATION_MINUTES:
        raise ValueError(
            f"timeslot duration must be exactly {TIMESLOT_DURATION_MINUTES // 60} hours"
        )
    if s < business_open or e > business_close:
        raise ValueError("timeslot must be within configured business hours")
    return s, e


def expand_day_slot_rows(
    seat_id: int,
    dates: list[date],
    start_minute: int,
    end_minute: int,
) -> list[tuple[int, date, int, int]]:
    return [(seat_id, d, start_minute, end_minute) for d in dates]

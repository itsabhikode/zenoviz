"""Pure domain rules for study room booking."""
from datetime import date, time

import pytest

from src.domain.study_pricing import PricingConfigSnapshot, compute_stored_breakdown
from src.domain.study_room_rules import (
    AccessType,
    PriceCategory,
    category_for_duration,
    duration_days,
    intervals_overlap,
    resolve_window,
)


def test_duration_and_category_boundaries() -> None:
    s = date(2026, 1, 1)
    assert duration_days(s, s) == 1
    assert category_for_duration(1) == PriceCategory.DAILY
    assert category_for_duration(6) == PriceCategory.DAILY
    assert category_for_duration(7) == PriceCategory.WEEKLY
    assert category_for_duration(29) == PriceCategory.WEEKLY
    assert category_for_duration(30) == PriceCategory.MONTHLY


def test_duration_invalid() -> None:
    with pytest.raises(ValueError):
        duration_days(date(2026, 1, 5), date(2026, 1, 1))


def test_pricing_discount_and_anytime_surcharge() -> None:
    from decimal import Decimal

    cfg = PricingConfigSnapshot(
        daily_base_price=Decimal("100"),
        weekly_base_price=Decimal("500"),
        monthly_base_price=Decimal("1000"),
        daily_discount_percent=Decimal("10"),
        weekly_discount_percent=Decimal("0"),
        monthly_discount_percent=Decimal("0"),
        anytime_surcharge_percent=Decimal("20"),
    )
    final, bd = compute_stored_breakdown(
        category=PriceCategory.DAILY,
        access_type=AccessType.TIMESLOT,
        cfg=cfg,
    )
    assert final == Decimal("90.00")
    assert bd["discounted_price"] == "90.00"
    assert bd["surcharge"] == "0"

    final2, bd2 = compute_stored_breakdown(
        category=PriceCategory.DAILY,
        access_type=AccessType.ANYTIME,
        cfg=cfg,
    )
    assert final2 == Decimal("108.00")
    assert bd2["surcharge"] == "18.00"


def test_intervals_overlap_basic() -> None:
    assert intervals_overlap(9 * 60, 12 * 60, 11 * 60, 14 * 60) is True
    assert intervals_overlap(9 * 60, 12 * 60, 12 * 60, 15 * 60) is False
    assert intervals_overlap(9 * 60, 12 * 60, 10 * 60, 11 * 60) is True
    assert intervals_overlap(9 * 60, 12 * 60, 13 * 60, 16 * 60) is False


def test_resolve_window_timeslot_happy() -> None:
    s, e = resolve_window(AccessType.TIMESLOT, time(9, 0), time(12, 0), 9 * 60, 21 * 60)
    assert (s, e) == (9 * 60, 12 * 60)


def test_resolve_window_timeslot_wrong_duration() -> None:
    with pytest.raises(ValueError, match="duration"):
        resolve_window(AccessType.TIMESLOT, time(9, 0), time(11, 0), 9 * 60, 21 * 60)


def test_resolve_window_timeslot_outside_hours() -> None:
    with pytest.raises(ValueError, match="business hours"):
        resolve_window(AccessType.TIMESLOT, time(6, 0), time(9, 0), 9 * 60, 21 * 60)


def test_resolve_window_timeslot_missing_times() -> None:
    with pytest.raises(ValueError, match="required"):
        resolve_window(AccessType.TIMESLOT, None, time(12, 0), 9 * 60, 21 * 60)


def test_resolve_window_anytime_fills_business_hours() -> None:
    s, e = resolve_window(AccessType.ANYTIME, None, None, 9 * 60, 21 * 60)
    assert (s, e) == (9 * 60, 21 * 60)


def test_resolve_window_anytime_rejects_times() -> None:
    with pytest.raises(ValueError, match="must not be provided"):
        resolve_window(AccessType.ANYTIME, time(10, 0), time(13, 0), 9 * 60, 21 * 60)

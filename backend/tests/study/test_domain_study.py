"""Pure domain rules for study room booking."""
from decimal import Decimal
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


def _cfg(
    ts_daily: str = "15.00",
    ts_weekly: str = "80.00",
    ts_monthly: str = "250.00",
    at_daily: str = "20.00",
    at_weekly: str = "100.00",
    at_monthly: str = "300.00",
    locker_daily: str = "0",
    locker_weekly: str = "0",
    locker_monthly: str = "0",
) -> PricingConfigSnapshot:
    return PricingConfigSnapshot(
        timeslot_daily_price=Decimal(ts_daily),
        timeslot_weekly_price=Decimal(ts_weekly),
        timeslot_monthly_price=Decimal(ts_monthly),
        anytime_daily_price=Decimal(at_daily),
        anytime_weekly_price=Decimal(at_weekly),
        anytime_monthly_price=Decimal(at_monthly),
        locker_daily_price=Decimal(locker_daily),
        locker_weekly_price=Decimal(locker_weekly),
        locker_monthly_price=Decimal(locker_monthly),
    )


def test_timeslot_uses_timeslot_price() -> None:
    cfg = _cfg(ts_daily="15.00", at_daily="20.00")
    final, bd = compute_stored_breakdown(
        category=PriceCategory.DAILY, access_type=AccessType.TIMESLOT, cfg=cfg, duration_days=1
    )
    assert final == Decimal("15.00")
    assert bd["base"] == "15.00"
    assert bd["locker_fee"] == "0.00"
    assert bd["total"] == "15.00"


def test_anytime_uses_anytime_price() -> None:
    cfg = _cfg(ts_daily="15.00", at_daily="20.00")
    final, bd = compute_stored_breakdown(
        category=PriceCategory.DAILY, access_type=AccessType.ANYTIME, cfg=cfg, duration_days=1
    )
    assert final == Decimal("20.00")
    assert bd["base"] == "20.00"
    assert bd["total"] == "20.00"


def test_weekly_and_monthly_categories() -> None:
    cfg = _cfg(ts_weekly="80.00", at_weekly="100.00", ts_monthly="250.00", at_monthly="300.00")
    final_w, _ = compute_stored_breakdown(
        category=PriceCategory.WEEKLY, access_type=AccessType.TIMESLOT, cfg=cfg, duration_days=7
    )
    assert final_w == Decimal("560.00")   # 80.00 × 7

    final_aw, _ = compute_stored_breakdown(
        category=PriceCategory.WEEKLY, access_type=AccessType.ANYTIME, cfg=cfg, duration_days=7
    )
    assert final_aw == Decimal("700.00")  # 100.00 × 7

    final_m, _ = compute_stored_breakdown(
        category=PriceCategory.MONTHLY, access_type=AccessType.TIMESLOT, cfg=cfg, duration_days=30
    )
    assert final_m == Decimal("7500.00")  # 250.00 × 30

    final_am, _ = compute_stored_breakdown(
        category=PriceCategory.MONTHLY, access_type=AccessType.ANYTIME, cfg=cfg, duration_days=30
    )
    assert final_am == Decimal("9000.00") # 300.00 × 30


def test_locker_fee_added_to_base() -> None:
    cfg = _cfg(ts_daily="15.00", locker_daily="10.00")
    final, bd = compute_stored_breakdown(
        category=PriceCategory.DAILY, access_type=AccessType.TIMESLOT, cfg=cfg, with_locker=True, duration_days=1
    )
    assert bd["locker_fee"] == "10.00"
    assert final == Decimal("25.00")


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


def test_locker_fee_zero_when_not_requested() -> None:
    cfg = _cfg(ts_daily="15.00", locker_daily="10.00")
    final, bd = compute_stored_breakdown(
        category=PriceCategory.DAILY, access_type=AccessType.TIMESLOT, cfg=cfg, with_locker=False, duration_days=1
    )
    assert bd["locker_fee"] == "0.00"
    assert final == Decimal("15.00")


def test_locker_fee_per_category() -> None:
    cfg = _cfg(
        ts_daily="15.00", ts_weekly="80.00", ts_monthly="250.00",
        locker_daily="10.00", locker_weekly="50.00", locker_monthly="150.00",
    )
    _, bd_d = compute_stored_breakdown(
        category=PriceCategory.DAILY, access_type=AccessType.TIMESLOT, cfg=cfg, with_locker=True, duration_days=1
    )
    assert bd_d["locker_fee"] == "10.00"   # 10.00 × 1

    _, bd_w = compute_stored_breakdown(
        category=PriceCategory.WEEKLY, access_type=AccessType.TIMESLOT, cfg=cfg, with_locker=True, duration_days=7
    )
    assert bd_w["locker_fee"] == "350.00"  # 50.00 × 7

    _, bd_m = compute_stored_breakdown(
        category=PriceCategory.MONTHLY, access_type=AccessType.TIMESLOT, cfg=cfg, with_locker=True, duration_days=30
    )
    assert bd_m["locker_fee"] == "4500.00" # 150.00 × 30


def test_anytime_with_locker() -> None:
    cfg = _cfg(at_daily="20.00", locker_daily="10.00")
    final, bd = compute_stored_breakdown(
        category=PriceCategory.DAILY, access_type=AccessType.ANYTIME, cfg=cfg, with_locker=True, duration_days=1
    )
    assert bd["base"] == "20.00"
    assert bd["locker_fee"] == "10.00"
    assert final == Decimal("30.00")


def test_multi_day_weekly_multiplies_rate() -> None:
    cfg = _cfg(ts_weekly="15.00")
    final, bd = compute_stored_breakdown(
        category=PriceCategory.WEEKLY,
        access_type=AccessType.TIMESLOT,
        cfg=cfg,
        duration_days=9,
    )
    assert final == Decimal("135.00")
    assert bd["per_day_rate"] == "15.00"
    assert bd["duration_days"] == 9
    assert bd["base"] == "135.00"
    assert bd["locker_fee"] == "0.00"
    assert bd["total"] == "135.00"


def test_multi_day_anytime_multiplies_rate() -> None:
    cfg = _cfg(at_daily="20.00")
    final, bd = compute_stored_breakdown(
        category=PriceCategory.DAILY,
        access_type=AccessType.ANYTIME,
        cfg=cfg,
        duration_days=5,
    )
    assert final == Decimal("100.00")
    assert bd["per_day_rate"] == "20.00"
    assert bd["base"] == "100.00"


def test_locker_per_day_multiplied() -> None:
    cfg = _cfg(ts_weekly="15.00", locker_weekly="10.00")
    final, bd = compute_stored_breakdown(
        category=PriceCategory.WEEKLY,
        access_type=AccessType.TIMESLOT,
        cfg=cfg,
        duration_days=9,
        with_locker=True,
    )
    assert bd["per_day_rate"] == "15.00"
    assert bd["locker_per_day"] == "10.00"
    assert bd["base"] == "135.00"
    assert bd["locker_fee"] == "90.00"
    assert final == Decimal("225.00")


def test_breakdown_includes_duration_days_key() -> None:
    cfg = _cfg(ts_daily="15.00")
    _, bd = compute_stored_breakdown(
        category=PriceCategory.DAILY,
        access_type=AccessType.TIMESLOT,
        cfg=cfg,
        duration_days=3,
    )
    assert bd["duration_days"] == 3
    assert bd["per_day_rate"] == "15.00"
    assert bd["base"] == "45.00"
    assert "locker_per_day" in bd

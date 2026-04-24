"""Stored-at-booking-time pricing snapshot (never recompute on read)."""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from src.domain.study_room_rules import AccessType, PriceCategory


@dataclass(frozen=True)
class PricingConfigSnapshot:
    timeslot_daily_price: Decimal
    timeslot_weekly_price: Decimal
    timeslot_monthly_price: Decimal
    anytime_daily_price: Decimal
    anytime_weekly_price: Decimal
    anytime_monthly_price: Decimal
    locker_daily_price: Decimal = field(default_factory=lambda: Decimal("0"))
    locker_weekly_price: Decimal = field(default_factory=lambda: Decimal("0"))
    locker_monthly_price: Decimal = field(default_factory=lambda: Decimal("0"))


def price_for(
    access_type: AccessType, category: PriceCategory, cfg: PricingConfigSnapshot
) -> Decimal:
    if access_type == AccessType.TIMESLOT:
        if category == PriceCategory.DAILY:
            return cfg.timeslot_daily_price
        if category == PriceCategory.WEEKLY:
            return cfg.timeslot_weekly_price
        return cfg.timeslot_monthly_price
    if access_type == AccessType.ANYTIME:
        if category == PriceCategory.DAILY:
            return cfg.anytime_daily_price
        if category == PriceCategory.WEEKLY:
            return cfg.anytime_weekly_price
        return cfg.anytime_monthly_price
    raise ValueError(f"Unhandled access_type: {access_type!r}")


def locker_price_for_category(category: PriceCategory, cfg: PricingConfigSnapshot) -> Decimal:
    if category == PriceCategory.DAILY:
        return cfg.locker_daily_price
    if category == PriceCategory.WEEKLY:
        return cfg.locker_weekly_price
    return cfg.locker_monthly_price


def compute_stored_breakdown(
    *,
    category: PriceCategory,
    access_type: AccessType,
    cfg: PricingConfigSnapshot,
    with_locker: bool = False,
) -> tuple[Decimal, dict[str, Any]]:
    base = price_for(access_type, category, cfg).quantize(Decimal("0.01"))

    locker_fee = Decimal("0").quantize(Decimal("0.01"))
    if with_locker:
        locker_fee = locker_price_for_category(category, cfg).quantize(Decimal("0.01"))

    final_price = (base + locker_fee).quantize(Decimal("0.01"))

    breakdown: dict[str, Any] = {
        "category": category.value,
        "access_type": access_type.value,
        "base": str(base),
        "locker_fee": str(locker_fee),
        "total": str(final_price),
    }
    return final_price, breakdown

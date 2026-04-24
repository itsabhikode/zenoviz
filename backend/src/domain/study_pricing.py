"""Stored-at-booking-time pricing snapshot (never recompute on read)."""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from src.domain.study_room_rules import AccessType, PriceCategory


@dataclass(frozen=True)
class PricingConfigSnapshot:
    daily_base_price: Decimal
    weekly_base_price: Decimal
    monthly_base_price: Decimal
    daily_discount_percent: Decimal
    weekly_discount_percent: Decimal
    monthly_discount_percent: Decimal
    anytime_surcharge_percent: Decimal
    locker_daily_price: Decimal = field(default_factory=lambda: Decimal("0"))
    locker_weekly_price: Decimal = field(default_factory=lambda: Decimal("0"))
    locker_monthly_price: Decimal = field(default_factory=lambda: Decimal("0"))


def base_price_for_category(category: PriceCategory, cfg: PricingConfigSnapshot) -> Decimal:
    if category == PriceCategory.DAILY:
        return cfg.daily_base_price
    if category == PriceCategory.WEEKLY:
        return cfg.weekly_base_price
    return cfg.monthly_base_price


def discount_percent_for_category(category: PriceCategory, cfg: PricingConfigSnapshot) -> Decimal:
    if category == PriceCategory.DAILY:
        return cfg.daily_discount_percent
    if category == PriceCategory.WEEKLY:
        return cfg.weekly_discount_percent
    return cfg.monthly_discount_percent


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
    base = base_price_for_category(category, cfg)
    disc_pct = discount_percent_for_category(category, cfg)
    discounted = base - (base * disc_pct / Decimal("100"))
    discounted = discounted.quantize(Decimal("0.01"))

    surcharge = Decimal("0")
    if access_type == AccessType.ANYTIME:
        surcharge = discounted * (cfg.anytime_surcharge_percent / Decimal("100"))
        surcharge = surcharge.quantize(Decimal("0.01"))

    locker_fee = Decimal("0")
    if with_locker:
        locker_fee = locker_price_for_category(category, cfg).quantize(Decimal("0.01"))

    final_price = (discounted + surcharge + locker_fee).quantize(Decimal("0.01"))

    breakdown: dict[str, Any] = {
        "category": category.value,
        "access_type": access_type.value,
        "base_price": str(base),
        "discount_percent": str(disc_pct),
        "discounted_price": str(discounted),
        "anytime_surcharge_percent": str(cfg.anytime_surcharge_percent),
        "surcharge": str(surcharge),
        "locker_fee": str(locker_fee),
        "final_price": str(final_price),
    }
    return final_price, breakdown

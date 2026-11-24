"""Board, insert and conversion cost from visible rates."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from services.units import money, percent_change, square_metres


@dataclass(frozen=True)
class CostQuote:
    status: str
    currency: str
    billed_area_m2: float
    waste_factor: float
    board_cost_inr: float | None
    insert_cost_inr: float | None
    conversion_cost_inr: float | None
    other_cost_inr: float
    unit_cost_inr: float | None
    missing_rates: tuple[str, ...]
    price_basis: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "currency": self.currency,
            "billed_board_area_m2": self.billed_area_m2,
            "waste_factor": self.waste_factor,
            "board_cost_inr": self.board_cost_inr,
            "insert_cost_inr": self.insert_cost_inr,
            "conversion_cost_inr": self.conversion_cost_inr,
            "other_cost_inr": self.other_cost_inr,
            "unit_cost_inr": self.unit_cost_inr,
            "missing_rates": list(self.missing_rates),
            "price_basis": self.price_basis,
            "rounding": "INR is rounded half-up to the paisa on the unit total. Component figures are rounded for display.",
        }


def _decimal_or_none(value: Any) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value))


def quote_blank(
    *,
    blank_length_mm: float,
    blank_width_mm: float,
    rate_inr_per_m2: float | None,
    conversion_inr: float | None,
    insert_inr: float | None,
    other_inr: float = 0,
    waste_factor: float = 0,
    price_basis: str = "illustrative_prototype",
) -> CostQuote:
    area = square_metres(blank_length_mm, blank_width_mm)
    waste = Decimal(str(waste_factor))
    billed = area * (Decimal(1) + waste)
    rate = _decimal_or_none(rate_inr_per_m2)
    conversion = _decimal_or_none(conversion_inr)
    insert = _decimal_or_none(insert_inr)
    other = Decimal(str(other_inr))
    missing: list[str] = []
    if rate is None:
        missing.append("board price per m²")
    if conversion is None:
        missing.append("conversion cost per unit")
    if insert is None:
        missing.append("insert cost per unit")
    if missing:
        return CostQuote(
            status="unavailable",
            currency="INR",
            billed_area_m2=float(billed),
            waste_factor=waste_factor,
            board_cost_inr=None,
            insert_cost_inr=None,
            conversion_cost_inr=None,
            other_cost_inr=money(other),
            unit_cost_inr=None,
            missing_rates=tuple(missing),
            price_basis="unavailable",
        )
    assert rate is not None and conversion is not None and insert is not None
    board_cost = billed * rate
    total = board_cost + insert + conversion + other
    basis = price_basis if price_basis != "unavailable" else "illustrative_prototype"
    status = "illustrative_estimate" if basis != "supplier_quote" else "supplier_estimate"
    return CostQuote(
        status=status,
        currency="INR",
        billed_area_m2=float(billed),
        waste_factor=waste_factor,
        board_cost_inr=money(board_cost),
        insert_cost_inr=money(insert),
        conversion_cost_inr=money(conversion),
        other_cost_inr=money(other),
        unit_cost_inr=money(total),
        missing_rates=(),
        price_basis=basis,
    )


def material_mass_g(
    *,
    billed_area_m2: float,
    grammage_g_m2: float | None,
    insert_mass_g: float | None,
) -> float | None:
    if grammage_g_m2 is None:
        return None
    board_mass = Decimal(str(billed_area_m2)) * Decimal(str(grammage_g_m2))
    insert_mass = Decimal(str(insert_mass_g or 0))
    return money(board_mass + insert_mass)


def compare_with_existing(
    quote: CostQuote,
    existing_unit_inr: float | None,
    monthly_quantity: int,
) -> dict[str, Any]:
    payload = quote.as_dict()
    unit = quote.unit_cost_inr
    payload["existing_unit_cost_inr"] = existing_unit_inr
    payload["monthly_cost_inr"] = None if unit is None else money(Decimal(str(unit)) * Decimal(monthly_quantity))
    if unit is None or existing_unit_inr is None:
        payload["difference_per_unit_inr"] = None
        payload["change_percent"] = None
        payload["monthly_difference_inr"] = None
        if existing_unit_inr is None:
            payload["missing_rates"] = [*payload["missing_rates"], "existing packaging cost per unit"]
            if payload["status"] == "illustrative_estimate":
                payload["status"] = "illustrative_estimate_without_existing_baseline"
        return payload
    difference = money(Decimal(str(unit)) - Decimal(str(existing_unit_inr)))
    payload["difference_per_unit_inr"] = difference
    payload["change_percent"] = percent_change(unit, existing_unit_inr)
    payload["monthly_difference_inr"] = money(Decimal(str(difference)) * Decimal(monthly_quantity))
    if existing_unit_inr is not None:
        payload["existing_monthly_cost_inr"] = money(Decimal(str(existing_unit_inr)) * Decimal(monthly_quantity))
    return payload

"""Itemised corrugated cost. Missing board rates stay missing."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from services.units import money, percent_change

UNAVAILABLE = "Cost unavailable — pricing data required"


def quote_carton(
    *,
    area_m2: float,
    rate_inr_per_m2: float | None,
    conversion_inr: float | None,
    parameters: dict[str, Any],
    price_basis: str,
) -> dict[str, Any]:
    missing: list[str] = []
    if rate_inr_per_m2 is None:
        missing.append("board price per m²")
    if conversion_inr is None:
        missing.append("conversion cost per unit")
    waste = Decimal(str(parameters.get("waste_factor") or 0))
    billed_area = Decimal(str(area_m2)) * (Decimal(1) + waste)
    printing = parameters.get("printing_cost_inr")
    cutting = Decimal(str(parameters.get("cutting_cost_inr") or 0))
    joining = Decimal(str(parameters.get("joining_cost_inr") or 0))
    cushion = Decimal(str(parameters.get("cushioning_cost_inr") or 0))
    if missing:
        return {
            "status": "unavailable",
            "message": UNAVAILABLE,
            "missing_rates": missing,
            "currency": "INR",
            "billed_area_m2": float(billed_area),
            "waste_factor": float(waste),
            "board_cost_inr": None,
            "conversion_cost_inr": None,
            "cutting_cost_inr": None,
            "printing_cost_inr": None,
            "joining_cost_inr": None,
            "cushioning_cost_inr": None,
            "unit_cost_inr": None,
            "price_basis": "unavailable",
            "printing_note": "Printing is not estimated while its rate is missing.",
        }
    assert rate_inr_per_m2 is not None and conversion_inr is not None
    board = billed_area * Decimal(str(rate_inr_per_m2))
    conversion = Decimal(str(conversion_inr))
    printing_amount = Decimal(0) if printing is None else Decimal(str(printing))
    total = board + conversion + cutting + printing_amount + joining + cushion
    return {
        "status": "demonstration_estimate" if price_basis != "supplier_quote" else "supplier_estimate",
        "message": None,
        "missing_rates": [],
        "currency": "INR",
        "billed_area_m2": float(billed_area),
        "waste_factor": float(waste),
        "board_cost_inr": money(board),
        "conversion_cost_inr": money(conversion),
        "cutting_cost_inr": money(cutting),
        "printing_cost_inr": None if printing is None else money(printing_amount),
        "joining_cost_inr": money(joining),
        "cushioning_cost_inr": money(cushion),
        "unit_cost_inr": money(total),
        "price_basis": price_basis,
        "printing_note": "No printing rate is loaded, so printing is omitted." if printing is None else "Printing uses the supplied rate.",
        "rounding": "The unit total is rounded half-up to the paisa. The order total uses that rounded unit cost.",
    }


def order_comparison(unit_cost: float | None, existing_unit: float | None, quantity: int) -> dict[str, Any]:
    if unit_cost is None:
        return {
            "order_cost_inr": None,
            "existing_order_cost_inr": None if existing_unit is None else money(Decimal(str(existing_unit)) * Decimal(quantity)),
            "difference_per_unit_inr": None,
            "order_difference_inr": None,
            "change_percent": None,
            "direction": "unavailable",
        }
    order = money(Decimal(str(unit_cost)) * Decimal(quantity))
    if existing_unit is None:
        return {
            "order_cost_inr": order,
            "existing_order_cost_inr": None,
            "difference_per_unit_inr": None,
            "order_difference_inr": None,
            "change_percent": None,
            "direction": "no_existing_cost",
        }
    existing_order = money(Decimal(str(existing_unit)) * Decimal(quantity))
    difference_unit = money(Decimal(str(unit_cost)) - Decimal(str(existing_unit)))
    difference_order = money(Decimal(str(difference_unit)) * Decimal(quantity))
    if difference_unit < 0:
        direction = "decrease"
    elif difference_unit > 0:
        direction = "increase"
    else:
        direction = "unchanged"
    return {
        "order_cost_inr": order,
        "existing_order_cost_inr": existing_order,
        "difference_per_unit_inr": difference_unit,
        "order_difference_inr": difference_order,
        "change_percent": percent_change(unit_cost, existing_unit),
        "direction": direction,
    }

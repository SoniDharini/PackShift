"""Compare priced carton options with the cost the user pays today.

The target is the existing unit cost unless a separate budget is supplied.
Only priced, dimensionally compatible candidates are compared. None of them
has strength evidence, so a cheaper option is a lead to test, not a switch.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from services.units import money

DOMINANT_SHARE = Decimal("0.6")


def _other_costs(cost: dict[str, Any]) -> Decimal:
    total = Decimal(0)
    for key in ("cutting_cost_inr", "printing_cost_inr", "joining_cost_inr", "cushioning_cost_inr"):
        value = cost.get(key)
        if value is not None:
            total += Decimal(str(value))
    return total


def cost_reason(board: float, conversion: float, other: float = 0) -> str:
    total = Decimal(str(board)) + Decimal(str(conversion)) + Decimal(str(other))
    if total <= 0:
        return "The proposed carton has no priced cost components."
    if Decimal(str(board)) / total >= DOMINANT_SHARE:
        return "Your proposed packaging costs more mainly because of its board material."
    if Decimal(str(conversion)) / total >= DOMINANT_SHARE:
        return "Your proposed packaging costs more mainly because of its manufacturing charge."
    return "Your proposed packaging costs more because of board material and manufacturing charges."


def option_against_target(
    *,
    name: str,
    board_cost: float,
    conversion_cost: float,
    other_cost: float,
    unit_cost: float,
    target: float,
    quantity: int,
    dimensionally_compatible: bool = True,
    protection_validated: bool = False,
) -> dict[str, Any]:
    target_d = Decimal(str(target))
    difference = money(Decimal(str(unit_cost)) - target_d)
    max_conversion = money(target_d - Decimal(str(board_cost)) - Decimal(str(other_cost)))
    below = difference < 0
    if not dimensionally_compatible:
        recommendation = "Not compatible with the required inside size."
    elif below and not protection_validated:
        recommendation = "Lower cost on these prices. Test protection before switching."
    elif below:
        recommendation = "Lower cost and validated."
    elif difference == 0:
        recommendation = "Same cost as your current packaging."
    else:
        recommendation = "Costs more than your current packaging."
    return {
        "name": name,
        "board_cost_inr": money(Decimal(str(board_cost))),
        "conversion_cost_inr": money(Decimal(str(conversion_cost))),
        "other_cost_inr": money(Decimal(str(other_cost))),
        "unit_cost_inr": money(Decimal(str(unit_cost))),
        "difference_per_unit_inr": difference,
        "order_difference_inr": money(Decimal(str(difference)) * Decimal(quantity)),
        "max_conversion_for_target_inr": max_conversion,
        "manufacturing_alone_can_reach_target": max_conversion >= 0,
        "dimensionally_compatible": dimensionally_compatible,
        "protection_validated": protection_validated,
        "below_target": below,
        "recommendation": recommendation,
    }


def further_options(category: str, fragility: str) -> list[dict[str, str]]:
    options = []
    if fragility == "high":
        options.append(
            {
                "id": "folding_carton",
                "name": "Folding paperboard carton",
                "status": "not_suggested",
                "summary": "A folding paperboard carton is not suggested because the protection level is high.",
            }
        )
    else:
        options.append(
            {
                "id": "folding_carton",
                "name": "Folding paperboard carton",
                "status": "needs_design_support",
                "summary": (
                    "A folding paperboard carton may suit light retail goods, but this version has no folding-carton "
                    "geometry or prices. It needs additional design support, and FEFCO 0201 formulas are not used for it."
                ),
            }
        )
    if category.strip().lower() == "food":
        options.append(
            {
                "id": "food_pouch",
                "name": "Food-safe pouch or wrapper",
                "status": "needs_evaluation",
                "summary": (
                    "A food-safe pouch or wrapper needs food-contact, moisture-barrier and shelf-life data and a price "
                    "before it can be compared. Being lighter is not enough to recommend it."
                ),
            }
        )
    return options


def cost_target_report(
    *,
    candidates: list[dict[str, Any]],
    proposed: dict[str, Any],
    existing_unit: float | None,
    quantity: int,
    category: str,
    fragility: str,
    budget_inr: float | None = None,
) -> dict[str, Any]:
    target = budget_inr if budget_inr is not None else existing_unit
    extras = further_options(category, fragility)
    proposed_cost = proposed.get("cost") or {}
    if target is None or proposed_cost.get("unit_cost_inr") is None:
        return {
            "status": "unavailable",
            "target_unit_cost_inr": target,
            "target_source": "budget" if budget_inr is not None else "existing_cost",
            "summary": "A cost target needs both the current unit cost and a priced proposal.",
            "options": [],
            "cheapest_below_target": None,
            "further_options": extras,
        }
    options = []
    for item in candidates:
        cost = item.get("cost") or {}
        if cost.get("unit_cost_inr") is None:
            continue
        options.append(
            option_against_target(
                name=item.get("board_name") or item.get("id"),
                board_cost=float(cost["board_cost_inr"]),
                conversion_cost=float(cost["conversion_cost_inr"]),
                other_cost=float(_other_costs(cost)),
                unit_cost=float(cost["unit_cost_inr"]),
                target=float(target),
                quantity=quantity,
                dimensionally_compatible=item.get("feasibility") != "rejected",
                protection_validated=bool((item.get("protection") or {}).get("strength_evidence")),
            )
        )
    eligible = [item for item in options if item["dimensionally_compatible"] and item["below_target"]]
    cheapest = min(eligible, key=lambda item: item["unit_cost_inr"]) if eligible else None
    board = float(proposed_cost.get("board_cost_inr") or 0)
    conversion = float(proposed_cost.get("conversion_cost_inr") or 0)
    other = float(_other_costs(proposed_cost))
    proposal = option_against_target(
        name="Proposed carton",
        board_cost=board,
        conversion_cost=conversion,
        other_cost=other,
        unit_cost=float(proposed_cost["unit_cost_inr"]),
        target=float(target),
        quantity=quantity,
    )
    if cheapest is not None:
        summary = "A lower-cost material option is available. Review its estimated savings and protection requirements before switching."
    else:
        summary = "No lower-cost replacement has been established. Keeping the existing packaging is recommended unless other verified benefits justify a change."
    if proposal["difference_per_unit_inr"] <= 0:
        manufacturing = "The proposed carton already meets the cost target."
    elif not proposal["manufacturing_alone_can_reach_target"]:
        manufacturing = (
            f"The board alone costs ₹{board:.2f}, above the ₹{float(target):.2f} target, "
            "so reducing manufacturing cost alone cannot reach the target."
        )
    else:
        manufacturing = (
            f"To reach ₹{float(target):.2f}, the conversion charge would need to be at most "
            f"₹{proposal['max_conversion_for_target_inr']:.2f} per unit instead of ₹{conversion:.2f}."
        )
    return {
        "status": "calculated",
        "target_unit_cost_inr": float(target),
        "target_source": "budget" if budget_inr is not None else "existing_cost",
        "reason": cost_reason(board, conversion, other) if proposal["difference_per_unit_inr"] > 0 else None,
        "proposal": proposal,
        "manufacturing_summary": manufacturing,
        "options": options,
        "cheapest_below_target": cheapest,
        "summary": summary,
        "further_options": extras,
    }

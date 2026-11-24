"""Internal packaging dimensions from product size, clearance and rounding."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from services.orientation_engine import Orientation
from services.units import millimetres, round_up
from services.validation_service import Axis


@dataclass(frozen=True)
class Clearance:
    length: float
    width: float
    height: float
    rule_id: str
    source: str

    def as_dict(self) -> dict[str, float | str]:
        return {
            "length": self.length,
            "width": self.width,
            "height": self.height,
            "rule_id": self.rule_id,
            "source": self.source,
        }


@dataclass(frozen=True)
class SizedPackage:
    orientation: Orientation
    placed_product: Axis
    clearance: Clearance
    minimum_internal: Axis
    internal: Axis


def clearance_for(fragility: str, rules: dict[str, Any], override: dict[str, Any] | None) -> Clearance:
    policy = rules["clearance_by_fragility_mm"][fragility]
    if override:
        return Clearance(
            length=millimetres(float(override["length"])),
            width=millimetres(float(override["width"])),
            height=millimetres(float(override["height"])),
            rule_id=str(override.get("rule_id") or f"{policy['rule_id']}_material_override"),
            source="material_configuration",
        )
    return Clearance(
        length=millimetres(float(policy["length"])),
        width=millimetres(float(policy["width"])),
        height=millimetres(float(policy["height"])),
        rule_id=str(policy["rule_id"]),
        source="fragility_policy",
    )


def size_package(
    placed_product: Axis,
    orientation: Orientation,
    clearance: Clearance,
    increment_mm: float,
) -> SizedPackage:
    """Add clearance on both ends of each axis, then round up. Never round below the minimum."""
    minimum = Axis(
        millimetres(placed_product.length + 2 * clearance.length),
        millimetres(placed_product.width + 2 * clearance.width),
        millimetres(placed_product.height + 2 * clearance.height),
    )
    internal = Axis(
        round_up(minimum.length, increment_mm),
        round_up(minimum.width, increment_mm),
        round_up(minimum.height, increment_mm),
    )
    if internal.length + 1e-9 < minimum.length or internal.width + 1e-9 < minimum.width or internal.height + 1e-9 < minimum.height:
        raise RuntimeError("Manufacturing rounding reduced a dimension below the clearance minimum.")
    return SizedPackage(
        orientation=orientation,
        placed_product=placed_product,
        clearance=clearance,
        minimum_internal=minimum,
        internal=internal,
    )

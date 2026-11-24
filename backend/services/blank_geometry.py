"""Pure FEFCO 0201 blank estimates. Simplified geometry matches the studio."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from services.units import litres_from_dimensions, millimetres, square_metres


@dataclass(frozen=True)
class Axis:
    length: float
    width: float
    height: float

    def as_dict(self) -> dict[str, float]:
        return {"length": self.length, "width": self.width, "height": self.height}

    def volume_litres(self) -> float:
        return litres_from_dimensions(self.length, self.width, self.height)


def internal_size(product: Axis, clearance: Axis) -> Axis:
    """Add the requested clearance to both ends of each product axis. Dimensions stay in millimetres."""
    return Axis(
        millimetres(product.length + 2 * clearance.length),
        millimetres(product.width + 2 * clearance.width),
        millimetres(product.height + 2 * clearance.height),
    )


def outer_size(internal: Axis, thickness_mm: float) -> Axis:
    """Planning estimate. One board thickness is added on every face. Factory tolerance is not included."""
    thickness = millimetres(thickness_mm)
    return Axis(
        millimetres(internal.length + 2 * thickness),
        millimetres(internal.width + 2 * thickness),
        millimetres(internal.height + 2 * thickness),
    )


def _blank(
    *,
    internal: Axis,
    joint_mm: float,
    score_allowance_mm: float,
    score_count: int,
    flap_relief_mm: float,
    profile_id: str,
    label: str,
    scope: str,
) -> dict[str, Any]:
    relief = Decimal(str(flap_relief_mm))
    flap = (Decimal(str(internal.width)) / Decimal(2)) - (relief / Decimal(2))
    if flap <= 0:
        raise ValueError("Flap relief removes the flap. Reduce the relief or increase the width.")
    score_total = Decimal(str(score_allowance_mm)) * Decimal(score_count)
    blank_length = Decimal(str(joint_mm)) + Decimal(2) * (Decimal(str(internal.length)) + Decimal(str(internal.width))) + score_total
    blank_width = Decimal(str(internal.height)) + (flap * Decimal(2))
    area = square_metres(float(blank_length), float(blank_width))
    return {
        "profile_id": profile_id,
        "label": label,
        "length_mm": float(blank_length),
        "width_mm": float(blank_width),
        "area_m2": float(area),
        "flap_depth_mm": float(flap),
        "joint_mm": joint_mm,
        "score_allowance_mm": score_allowance_mm,
        "score_count": score_count,
        "score_allowance_total_mm": float(score_total),
        "flap_relief_mm": flap_relief_mm,
        "scope": scope,
        "formula": "length = joint + 2 × (L + W) + score allowance × score count; width = H + 2 × (W / 2 − relief / 2)",
    }


def simplified_blank(internal: Axis, profile: dict[str, Any]) -> dict[str, Any]:
    return _blank(
        internal=internal,
        joint_mm=float(profile["joint_mm"]),
        score_allowance_mm=float(profile["score_allowance_mm"]),
        score_count=int(profile["score_count"]),
        flap_relief_mm=float(profile["flap_relief_mm"]),
        profile_id=str(profile["id"]),
        label=str(profile["label"]),
        scope=str(profile["scope"]),
    )


def unused_percent(product: Axis, internal: Axis) -> tuple[float, float]:
    """Return the exact unused fraction and the same value rounded half-up to 0.1 percent."""
    product_mm3 = Decimal(str(product.length)) * Decimal(str(product.width)) * Decimal(str(product.height))
    internal_mm3 = Decimal(str(internal.length)) * Decimal(str(internal.width)) * Decimal(str(internal.height))
    if internal_mm3 == 0:
        return 0.0, 0.0
    exact = (internal_mm3 - product_mm3) / internal_mm3 * Decimal(100)
    rounded = float(exact.quantize(Decimal("0.1"), rounding="ROUND_HALF_UP"))
    return float(exact), rounded

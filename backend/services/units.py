"""Shared unit conversions and currency rounding."""

from __future__ import annotations

from decimal import ROUND_CEILING, ROUND_HALF_UP, Decimal
from typing import Mapping


def millimetres(value: float) -> float:
    """Keep dimensions stable to 0.001 mm."""
    return float(Decimal(str(value)).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP))


def round_up(value: float, increment: float) -> float:
    """Round up to a manufacturing increment. Values already on the increment stay put."""
    if increment <= 0:
        raise ValueError("Manufacturing increment must be positive.")
    amount = Decimal(str(millimetres(value)))
    step = Decimal(str(millimetres(increment)))
    if amount % step == 0:
        return float(amount)
    steps = (amount / step).to_integral_value(rounding=ROUND_CEILING)
    return float(steps * step)


def litres_from_mm3(volume_mm3: float) -> float:
    return float(
        (Decimal(str(volume_mm3)) / Decimal(1000000)).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
    )


def litres_from_dimensions(length_mm: float, width_mm: float, height_mm: float) -> float:
    volume = Decimal(str(length_mm)) * Decimal(str(width_mm)) * Decimal(str(height_mm))
    return float((volume / Decimal(1000000)).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP))


def square_metres(length_mm: float, width_mm: float) -> Decimal:
    return (Decimal(str(length_mm)) * Decimal(str(width_mm))) / Decimal(1000000)


def money(value: Decimal, decimals: int = 2) -> float:
    quant = Decimal("1").scaleb(-decimals)
    return float(value.quantize(quant, rounding=ROUND_HALF_UP))


def reduction_percent(baseline: float, proposed: float) -> float | None:
    if baseline == 0:
        return None
    ratio = (Decimal(str(baseline)) - Decimal(str(proposed))) / Decimal(str(baseline)) * Decimal(100)
    return float(ratio.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def percent_change(new_value: float, old_value: float) -> float | None:
    if old_value == 0:
        return None
    ratio = (Decimal(str(new_value)) - Decimal(str(old_value))) / Decimal(str(old_value)) * Decimal(100)
    return float(ratio.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def axis_dict(length: float, width: float, height: float) -> dict[str, float]:
    return {"length": length, "width": width, "height": height}


def read_axis(payload: Mapping[str, float]) -> tuple[float, float, float]:
    return (float(payload["length"]), float(payload["width"]), float(payload["height"]))

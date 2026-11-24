"""Material catalogue lookup and compatibility filters."""

from __future__ import annotations

from typing import Any


def by_id(items: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {str(item["id"]): item for item in items}


def assess_configuration(
    configuration: dict[str, Any],
    board: dict[str, Any] | None,
    cushion: dict[str, Any] | None,
    *,
    fragility: str,
    weight_kg: float,
    box_style: str,
) -> str | None:
    """Return a rejection reason, or None when the configuration may be sized."""
    if not configuration.get("include_in_recommendations", True):
        return "This configuration is in the catalogue but is excluded from the default shortlist."
    if box_style not in configuration.get("supported_box_styles", []):
        return "This configuration does not support the requested carton style."
    if fragility not in configuration.get("supported_fragility", []):
        return f"This configuration is not offered for {fragility} fragility."
    limit = float(configuration.get("max_product_weight_kg", 0))
    if weight_kg > limit:
        return (
            f"Product weight {weight_kg:g} kg is above this configuration's catalogue limit of {limit:g} kg."
        )
    if board is None:
        return "The referenced board is missing from the catalogue."
    if cushion is None:
        return "The referenced cushioning record is missing from the catalogue."
    if board.get("thickness_mm") is None:
        return "Board thickness is required before external dimensions can be calculated."
    return None

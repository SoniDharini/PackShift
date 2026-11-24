"""Axis-aligned product orientations and the physical fit check."""

from __future__ import annotations

from dataclasses import dataclass

from services.validation_service import Axis

# (orientation id, sources for package length, width, height)
ORIENTATION_MAPS: tuple[tuple[str, tuple[str, str, str]], ...] = (
    ("declared", ("length", "width", "height")),
    ("yaw_90", ("width", "length", "height")),
    ("roll_width_up", ("length", "height", "width")),
    ("pitch_length_up", ("height", "width", "length")),
    ("turn_height_to_length", ("height", "length", "width")),
    ("turn_height_to_width", ("width", "height", "length")),
)

FIT_TOLERANCE_MM = 1e-6


@dataclass(frozen=True)
class Orientation:
    id: str
    mapping: tuple[str, str, str]
    permitted: bool
    selected: bool
    label: str
    reason: str

    def placed_product(self, product: Axis) -> Axis:
        return Axis(
            product.component(self.mapping[0]),
            product.component(self.mapping[1]),
            product.component(self.mapping[2]),
        )


def _keeps_height(mapping: tuple[str, str, str]) -> bool:
    return mapping[2] == "height"


def _is_permitted(constraint: str, mapping: tuple[str, str, str]) -> bool:
    if constraint == "any":
        return True
    if constraint in {"flat_only", "upright_only"}:
        return _keeps_height(mapping)
    return False


def _label(constraint: str, mapping: tuple[str, str, str]) -> str:
    if constraint == "flat_only" and _keeps_height(mapping):
        return "flat"
    if constraint == "upright_only" and _keeps_height(mapping):
        return "upright"
    if mapping == ("length", "width", "height"):
        return "declared"
    return "reassigned"


def _reason(constraint: str, orientation_id: str, mapping: tuple[str, str, str], permitted: bool, selected: bool) -> str:
    if not permitted and constraint == "flat_only":
        return "flat_only keeps the declared product height axis vertical. This pose turns that axis onto its side."
    if not permitted and constraint == "upright_only":
        return "upright_only keeps the declared product height axis vertical. This pose lays that axis down."
    if not permitted:
        return f"The orientation constraint '{constraint}' does not allow this pose."
    if selected:
        return "The declared length, width and height are used. The product is not rotated to chase a smaller volume."
    if orientation_id == "yaw_90":
        return (
            "This horizontal quarter-turn stays inside the constraint, but it is not selected. "
            "Swapping length and width would only change which face the flaps are taken from."
        )
    return "This pose is permitted and is reported for review. It is not selected, because a smaller volume is not a reason to rotate the product."


def evaluate_orientations(constraint: str) -> list[Orientation]:
    orientations: list[Orientation] = []
    for orientation_id, mapping in ORIENTATION_MAPS:
        permitted = _is_permitted(constraint, mapping)
        selected = permitted and orientation_id == "declared"
        orientations.append(
            Orientation(
                id=orientation_id,
                mapping=mapping,
                permitted=permitted,
                selected=selected,
                label=_label(constraint, mapping),
                reason=_reason(constraint, orientation_id, mapping, permitted, selected),
            )
        )
    return orientations


def selected_orientation(constraint: str) -> Orientation:
    for orientation in evaluate_orientations(constraint):
        if orientation.selected:
            return orientation
    raise RuntimeError(f"No declared orientation is permitted for '{constraint}'.")


def fits_on_axes(product: Axis, package: Axis) -> bool:
    return (
        product.length <= package.length + FIT_TOLERANCE_MM
        and product.width <= package.width + FIT_TOLERANCE_MM
        and product.height <= package.height + FIT_TOLERANCE_MM
    )


def product_fits_package(product: Axis, package_internal: Axis, constraint: str) -> bool:
    for orientation in evaluate_orientations(constraint):
        if orientation.permitted and fits_on_axes(orientation.placed_product(product), package_internal):
            return True
    return False

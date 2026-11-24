"""Request validation that the schema layer cannot decide alone."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from schemas.request import RedesignRequest

from services.units import axis_dict, millimetres


class PackagingValidationError(Exception):
    """A domain error the caller can correct. Rendered as HTTP 422."""

    def __init__(self, errors: list[dict[str, str]]) -> None:
        self.errors = errors
        super().__init__("; ".join(item["message"] for item in errors))


@dataclass(frozen=True)
class Axis:
    length: float
    width: float
    height: float

    def volume_mm3(self) -> float:
        return self.length * self.width * self.height

    def as_dict(self) -> dict[str, float]:
        return axis_dict(self.length, self.width, self.height)

    def component(self, name: str) -> float:
        return getattr(self, name)


@dataclass(frozen=True)
class ValidatedRedesign:
    product_name: str
    category: str
    product: Axis
    weight_kg: float
    fragility: str
    shape: str
    orientation_constraint: str
    quantity_per_package: int
    current_internal: Axis
    current_external: Axis | None
    current_dimension_type: str
    current_thickness_mm: float | None
    current_thickness_source: str | None
    current_material_id: str
    current_cushioning_id: str | None
    current_cost_inr: float | None
    current_rate_inr_per_m2: float | None
    current_conversion_inr: float | None
    current_weight_kg: float | None
    monthly_quantity: int
    box_style: str
    increment_mm: float


def _error(field: str, message: str) -> dict[str, str]:
    return {"field": field, "message": message}


def _limits(rules: dict[str, Any]) -> dict[str, float]:
    return rules["limits"]


def _find_by_id(items: list[dict[str, Any]], item_id: str) -> dict[str, Any] | None:
    for item in items:
        if item["id"] == item_id:
            return item
    return None


def _check_span(field: str, axis: Axis, limit: float, errors: list[dict[str, str]]) -> None:
    for name in ("length", "width", "height"):
        value = axis.component(name)
        if value > limit:
            errors.append(
                _error(
                    f"{field}.{name}",
                    f"{value} mm is above the {limit:g} mm limit. All dimensions are millimetres.",
                )
            )


def resolve_current_internal(
    request: RedesignRequest,
    materials: dict[str, Any],
    rules: dict[str, Any],
) -> tuple[Axis, Axis | None, float | None, str | None, list[dict[str, str]]]:
    """Convert the stated carton to internal millimetres, or explain why that cannot be done."""
    errors: list[dict[str, str]] = []
    stated = request.current_packaging.dimensions_mm
    stated_axis = Axis(
        millimetres(stated.length),
        millimetres(stated.width),
        millimetres(stated.height),
    )
    board = _find_by_id(materials["boards"], request.current_packaging.material_id)
    thickness = request.current_packaging.board_thickness_mm
    source: str | None = None
    if thickness is not None:
        thickness = millimetres(thickness)
        source = "current_packaging.board_thickness_mm"
        max_thickness = float(rules["limits"]["max_board_thickness_mm"])
        if thickness <= 0 or thickness > max_thickness:
            errors.append(
                _error(
                    "current_packaging.board_thickness_mm",
                    f"Board thickness must be between 0 and {max_thickness:g} mm.",
                )
            )
    elif board is not None and board.get("thickness_mm") is not None:
        thickness = millimetres(float(board["thickness_mm"]))
        source = f"catalogue:{board['id']}.thickness_mm"

    if request.current_packaging.dimension_type == "internal":
        return stated_axis, None, thickness, source, errors

    if thickness is None:
        errors.append(
            _error(
                "current_packaging.board_thickness_mm",
                rules["external_dimension_policy"],
            )
        )
        return stated_axis, stated_axis, None, None, errors

    internal = Axis(
        millimetres(stated_axis.length - 2 * thickness),
        millimetres(stated_axis.width - 2 * thickness),
        millimetres(stated_axis.height - 2 * thickness),
    )
    for name in ("length", "width", "height"):
        if internal.component(name) <= 0:
            errors.append(
                _error(
                    f"current_packaging.dimensions_mm.{name}",
                    "Subtracting twice the board thickness leaves no internal cavity on this axis.",
                )
            )
    return internal, stated_axis, thickness, source, errors


def validate_redesign(
    request: RedesignRequest,
    materials: dict[str, Any],
    rules: dict[str, Any],
) -> ValidatedRedesign:
    errors: list[dict[str, str]] = []
    limits = _limits(rules)
    product = request.product

    if product.shape not in rules["supported_shapes"]:
        errors.append(
            _error(
                "product.shape",
                "Only a rectangular product is supported. Other shapes are rejected instead of being approximated.",
            )
        )
    if product.quantity_per_package not in rules["supported_items_per_package"]:
        errors.append(
            _error(
                "product.quantity_per_package",
                "This version sizes a carton around one physical item.",
            )
        )

    product_axis = Axis(
        millimetres(product.dimensions_mm.length),
        millimetres(product.dimensions_mm.width),
        millimetres(product.dimensions_mm.height),
    )
    _check_span("product.dimensions_mm", product_axis, float(limits["max_dimension_mm"]), errors)
    if product.weight_kg > float(limits["max_weight_kg"]):
        errors.append(
            _error(
                "product.weight_kg",
                f"Product weight must be at most {limits['max_weight_kg']:g} kg.",
            )
        )

    packaging = request.current_packaging
    if _find_by_id(materials["boards"], packaging.material_id) is None:
        known = ", ".join(item["id"] for item in materials["boards"])
        errors.append(
            _error(
                "current_packaging.material_id",
                f"Unknown packaging material '{packaging.material_id}'. Known board ids: {known}.",
            )
        )
    if packaging.cushioning_material_id is not None and _find_by_id(
        materials["cushioning"], packaging.cushioning_material_id
    ) is None:
        known_cushions = ", ".join(item["id"] for item in materials["cushioning"])
        errors.append(
            _error(
                "current_packaging.cushioning_material_id",
                f"Unknown cushioning material '{packaging.cushioning_material_id}'. Known ids: {known_cushions}.",
            )
        )

    if packaging.cost_per_unit_inr is not None and packaging.cost_per_unit_inr > float(limits["max_cost_inr"]):
        errors.append(_error("current_packaging.cost_per_unit_inr", "Packaging cost is above the accepted limit."))
    for field_name in ("material_rate_inr_per_m2", "conversion_cost_inr"):
        value = getattr(packaging, field_name)
        if value is not None and value > float(limits["max_cost_inr"]):
            errors.append(_error(f"current_packaging.{field_name}", "This rate is above the accepted limit."))
    if packaging.weight_kg is not None and (
        packaging.weight_kg <= 0 or packaging.weight_kg > float(limits["max_weight_kg"])
    ):
        errors.append(
            _error(
                "current_packaging.weight_kg",
                f"Current packaging weight must be greater than 0 kg and at most {limits['max_weight_kg']:g} kg.",
            )
        )

    if request.monthly_quantity > int(limits["max_monthly_quantity"]):
        errors.append(
            _error(
                "monthly_quantity",
                f"Monthly quantity must be at most {int(limits['max_monthly_quantity'])}.",
            )
        )

    preferences = request.preferences
    if preferences.box_style not in rules["supported_box_styles"]:
        errors.append(
            _error(
                "preferences.box_style",
                "Only the FEFCO 0201 regular slotted carton is generated in this version.",
            )
        )
    increment = preferences.dimension_increment_mm
    if increment < float(limits["min_increment_mm"]) or increment > float(limits["max_increment_mm"]):
        errors.append(
            _error(
                "preferences.dimension_increment_mm",
                f"Dimension increment must be from {limits['min_increment_mm']:g} to {limits['max_increment_mm']:g} mm.",
            )
        )

    internal, external, thickness, thickness_source, thickness_errors = resolve_current_internal(
        request, materials, rules
    )
    errors.extend(thickness_errors)
    _check_span("current_packaging.dimensions_mm", internal, float(limits["max_dimension_mm"]), errors)

    if errors:
        raise PackagingValidationError(errors)

    from services.orientation_engine import product_fits_package

    if not product_fits_package(product_axis, internal, product.orientation_constraint):
        raise PackagingValidationError(
            [
                _error(
                    "current_packaging.dimensions_mm",
                    (
                        "The product cannot fit inside the current package in a permitted orientation. "
                        f"Product {product_axis.length:g} × {product_axis.width:g} × {product_axis.height:g} mm, "
                        f"current internal {internal.length:g} × {internal.width:g} × {internal.height:g} mm, "
                        f"constraint {product.orientation_constraint}. Dimensions are millimetres and are not converted between units."
                    ),
                )
            ]
        )

    return ValidatedRedesign(
        product_name=product.name.strip(),
        category=product.category.strip(),
        product=product_axis,
        weight_kg=float(product.weight_kg),
        fragility=product.fragility,
        shape=product.shape,
        orientation_constraint=product.orientation_constraint,
        quantity_per_package=product.quantity_per_package,
        current_internal=internal,
        current_external=external,
        current_dimension_type=packaging.dimension_type,
        current_thickness_mm=thickness,
        current_thickness_source=thickness_source,
        current_material_id=packaging.material_id,
        current_cushioning_id=packaging.cushioning_material_id,
        current_cost_inr=packaging.cost_per_unit_inr,
        current_rate_inr_per_m2=packaging.material_rate_inr_per_m2,
        current_conversion_inr=packaging.conversion_cost_inr,
        current_weight_kg=packaging.weight_kg,
        monthly_quantity=request.monthly_quantity,
        box_style=preferences.box_style,
        increment_mm=millimetres(increment),
    )

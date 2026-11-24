"""Generate, check and rank feasible redesign candidates."""

from __future__ import annotations

from typing import Any

from decimal import Decimal

from schemas.request import RedesignRequest

from services.cost_engine import compare_with_existing, material_mass_g, quote_blank
from services.dimension_engine import clearance_for, size_package
from services.geometry_engine import blank_area_m2, build_geometry
from services.material_engine import assess_configuration, by_id
from services.orientation_engine import evaluate_orientations, selected_orientation
from services.units import litres_from_dimensions, millimetres, money, reduction_percent
from services.validation_service import Axis, ValidatedRedesign, validate_redesign


GLOBAL_WARNINGS = [
    "Packaging dimensions are preliminary and require manufacturing and protection validation.",
    "Clearances are prototype assumptions, not a certified cushioning specification.",
    "Volume reduction is not a reduction in board area, material mass, cost, or environmental impact.",
    "No carbon, recyclability, or biodegradability score is calculated. A comparable life-cycle dataset is not loaded.",
]


def _litres(axis: Axis) -> float:
    return litres_from_dimensions(axis.length, axis.width, axis.height)


def _existing_cost(
    validated: ValidatedRedesign,
    blank_length_mm: float,
    blank_width_mm: float,
    waste_factor: float,
) -> tuple[float | None, str]:
    if validated.current_cost_inr is not None:
        return money(Decimal(str(validated.current_cost_inr))), "entered_cost"
    quote = quote_blank(
        blank_length_mm=blank_length_mm,
        blank_width_mm=blank_width_mm,
        rate_inr_per_m2=validated.current_rate_inr_per_m2,
        conversion_inr=validated.current_conversion_inr,
        insert_inr=0 if validated.current_rate_inr_per_m2 is not None else None,
        waste_factor=waste_factor,
        price_basis="request_assumption",
    )
    return quote.unit_cost_inr, quote.status


def _orientation_payload(constraint: str) -> list[dict[str, Any]]:
    payload = []
    for orientation in evaluate_orientations(constraint):
        payload.append(
            {
                "id": orientation.id,
                "label": orientation.label,
                "permitted": orientation.permitted,
                "selected": orientation.selected,
                "package_axes": {
                    "length": orientation.mapping[0],
                    "width": orientation.mapping[1],
                    "height": orientation.mapping[2],
                },
                "reason": orientation.reason,
            }
        )
    return payload


def _build_candidate(
    *,
    index: int,
    configuration: dict[str, Any],
    board: dict[str, Any],
    cushion: dict[str, Any],
    validated: ValidatedRedesign,
    rules: dict[str, Any],
    existing_unit_inr: float | None,
) -> dict[str, Any]:
    orientation = selected_orientation(validated.orientation_constraint)
    placed = orientation.placed_product(validated.product)
    clearance = clearance_for(validated.fragility, rules, configuration.get("clearance_override_mm"))
    sized = size_package(placed, orientation, clearance, validated.increment_mm)
    thickness = float(board["thickness_mm"])
    joint = float(rules["joint_allowance_mm"])
    geometry = build_geometry(sized.internal, thickness, joint)
    waste = float(rules["manufacturing_waste_factor"])
    quote = quote_blank(
        blank_length_mm=float(geometry["blank_length_mm"]),
        blank_width_mm=float(geometry["blank_width_mm"]),
        rate_inr_per_m2=board.get("price_inr_per_m2"),
        conversion_inr=board.get("conversion_cost_inr"),
        insert_inr=cushion.get("cost_inr_per_package"),
        waste_factor=waste,
        price_basis=str(board.get("price_basis") or "illustrative_prototype"),
    )
    cost = compare_with_existing(quote, existing_unit_inr, validated.monthly_quantity)
    mass = material_mass_g(
        billed_area_m2=float(quote.billed_area_m2),
        grammage_g_m2=board.get("grammage_g_m2"),
        insert_mass_g=cushion.get("mass_g"),
    )
    warnings = [
        "Protection has not been proven. The clearance and any insert still need physical testing.",
    ]
    if validated.fragility == "high" and cushion["id"] == "none":
        warnings.append("High fragility is recorded, and this configuration leaves the clearance as an air gap.")
    if quote.status == "unavailable":
        warnings.append("A required rate is missing, so this cost comparison is unavailable.")
    elif quote.price_basis != "supplier_quote":
        warnings.append("The unit cost is an illustrative estimate from catalogue rates, not a supplier quotation.")

    minimum = sized.minimum_internal
    internal = sized.internal
    explanation = " ".join(
        [
            f"The {orientation.label} pose keeps the declared product axes.",
            (
                f"Clearance is {clearance.length:g} mm, {clearance.width:g} mm and {clearance.height:g} mm "
                f"per side ({clearance.rule_id}, from {clearance.source.replace('_', ' ')})."
            ),
            (
                f"Minimum internal size is {minimum.length:g} × {minimum.width:g} × {minimum.height:g} mm, "
                f"then rounded up to a {validated.increment_mm:g} mm increment, giving "
                f"{internal.length:g} × {internal.width:g} × {internal.height:g} mm."
            ),
            (
                f"The conceptual FEFCO 0201 blank is {geometry['blank_length_mm']:g} × {geometry['blank_width_mm']:g} mm "
                f"({geometry['rectangular_blank_area_m2']:.6f} m²) at {thickness:g} mm nominal caliper."
            ),
            "That board area is not derived from the change in package volume.",
        ]
    )
    return {
        "catalogue_index": index,
        "feasible": True,
        "configuration_id": configuration["id"],
        "material_id": board["id"],
        "material_name": configuration["name"],
        "board_id": board["id"],
        "cushioning_id": cushion["id"],
        "category": configuration["category"],
        "orientation_id": orientation.id,
        "selected_orientation": orientation.label,
        "height_axis": orientation.mapping[2],
        "internal": internal,
        "external": Axis(
            float(geometry["external_dimensions_mm"]["length"]),
            float(geometry["external_dimensions_mm"]["width"]),
            float(geometry["external_dimensions_mm"]["height"]),
        ),
        "minimum_internal": minimum,
        "clearance": clearance,
        "volume_litres": _litres(internal),
        "external_volume_litres": _litres(
            Axis(
                float(geometry["external_dimensions_mm"]["length"]),
                float(geometry["external_dimensions_mm"]["width"]),
                float(geometry["external_dimensions_mm"]["height"]),
            )
        ),
        "blank_length_mm": geometry["blank_length_mm"],
        "blank_width_mm": geometry["blank_width_mm"],
        "blank_area_m2": geometry["rectangular_blank_area_m2"],
        "material_mass_g": mass,
        "cost": cost,
        "explanation": explanation,
        "assumptions": [
            f"Joint allowance is {joint:g} mm. {rules['joint_allowance_note']}",
            rules["manufacturing_waste_note"],
            "Inserts are assumed to occupy the stated clearance rather than adding a second gap, unless this configuration overrides the clearance.",
            *list(configuration.get("limitations", [])),
            *list(board.get("limitations", [])),
        ],
        "warnings": warnings,
        "limitations": list(configuration.get("limitations", [])),
        "geometry": geometry,
    }


def _present(candidate: dict[str, Any], role: str, title: str, rank: int, tie_note: str | None) -> dict[str, Any]:
    assumptions = list(candidate["assumptions"])
    if tie_note and role == "minimum_board":
        assumptions.insert(0, tie_note)
    clearance = candidate["clearance"]
    return {
        "role": role,
        "title": title,
        "rank": rank,
        "feasible": True,
        "configuration_id": candidate["configuration_id"],
        "material_id": candidate["material_id"],
        "material_name": candidate["material_name"],
        "board_id": candidate["board_id"],
        "cushioning_id": candidate["cushioning_id"],
        "category": candidate["category"],
        "orientation_id": candidate["orientation_id"],
        "selected_orientation": candidate["selected_orientation"],
        "height_axis": candidate["height_axis"],
        "internal_dimensions_mm": candidate["internal"].as_dict(),
        "external_dimensions_mm": candidate["external"].as_dict(),
        "minimum_internal_dimensions_mm": candidate["minimum_internal"].as_dict(),
        "protection_clearance_mm": {
            "length": clearance.length,
            "width": clearance.width,
            "height": clearance.height,
            "rule_id": clearance.rule_id,
            "source": clearance.source,
        },
        "packaging_style": "fefco_0201",
        "volume_litres": candidate["volume_litres"],
        "external_volume_litres": candidate["external_volume_litres"],
        "blank_length_mm": candidate["blank_length_mm"],
        "blank_width_mm": candidate["blank_width_mm"],
        "blank_area_m2": candidate["blank_area_m2"],
        "material_mass_g": candidate["material_mass_g"],
        "cost": candidate["cost"],
        "explanation": candidate["explanation"],
        "assumptions": assumptions,
        "warnings": candidate["warnings"],
        "limitations": candidate["limitations"],
        "geometry": candidate["geometry"],
    }


def _rank(candidates: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str | None]:
    if not candidates:
        return [], None
    def board_key(candidate: dict[str, Any]) -> tuple[float, int, str]:
        return (float(candidate["blank_area_m2"]), int(candidate["catalogue_index"]), str(candidate["configuration_id"]))

    def cost_key(candidate: dict[str, Any]) -> tuple[float, int]:
        return (float(candidate["cost"]["unit_cost_inr"]), int(candidate["catalogue_index"]))

    minimum = min(candidates, key=board_key)
    tied = [item for item in candidates if abs(float(item["blank_area_m2"]) - float(minimum["blank_area_m2"])) < 1e-9]
    tie_note = None
    if len(tied) > 1:
        tie_note = (
            "Several feasible configurations need the same blank area because they share internal dimensions. "
            "The earliest of those configurations in the catalogue is the reference minimum-board option."
        )
    chosen: list[dict[str, Any]] = []
    seen: set[str] = set()

    def take(candidate: dict[str, Any], role: str, title: str) -> None:
        if candidate["configuration_id"] in seen or len(chosen) >= 3:
            return
        seen.add(str(candidate["configuration_id"]))
        chosen.append(_present(candidate, role, title, len(chosen) + 1, tie_note))

    take(minimum, "minimum_board", "Minimum board usage")
    priced = [item for item in candidates if item["cost"]["unit_cost_inr"] is not None]
    if priced:
        take(min(priced, key=cost_key), "lowest_cost", "Lowest estimated cost")
    for candidate in candidates:
        if candidate["category"] == "board_with_insert":
            take(candidate, "alternative_material", "Alternative material configuration")
            break
    for candidate in candidates:
        if len(chosen) >= 3:
            break
        take(candidate, "additional_feasible", "Additional feasible configuration")
    return chosen, tie_note


def _current_summary(
    validated: ValidatedRedesign,
    blank_length: float,
    blank_width: float,
    blank_area: float,
    existing_cost: float | None,
    existing_cost_status: str,
) -> dict[str, Any]:
    thickness = validated.current_thickness_mm
    external = validated.current_external
    if external is None and thickness is not None:
        external = Axis(
            millimetres(validated.current_internal.length + 2 * thickness),
            millimetres(validated.current_internal.width + 2 * thickness),
            millimetres(validated.current_internal.height + 2 * thickness),
        )
    return {
        "dimension_type_received": validated.current_dimension_type,
        "internal_dimensions_mm": validated.current_internal.as_dict(),
        "external_dimensions_mm": None if external is None else external.as_dict(),
        "board_thickness_mm": thickness,
        "board_thickness_source": validated.current_thickness_source,
        "material_id": validated.current_material_id,
        "cushioning_material_id": validated.current_cushioning_id,
        "volume_litres": _litres(validated.current_internal),
        "volume_basis": "internal",
        "estimated_blank_length_mm": blank_length,
        "estimated_blank_width_mm": blank_width,
        "estimated_blank_area_m2": round(blank_area, 6),
        "cost_per_unit_inr": existing_cost,
        "cost_status": existing_cost_status,
        "weight_kg": validated.current_weight_kg,
    }


def _comparison(
    validated: ValidatedRedesign,
    current_volume: float,
    current_area: float,
    primary: dict[str, Any] | None,
) -> dict[str, Any]:
    product_volume = _litres(validated.product)
    comparison: dict[str, Any] = {
        "volume_basis": "internal",
        "product_volume_litres": product_volume,
        "current_volume_litres": current_volume,
        "current_unoccupied_litres": round(current_volume - product_volume, 6),
        "current_blank_area_m2": round(current_area, 6),
        "recommended_volume_litres": None,
        "recommended_unoccupied_litres": None,
        "recommended_blank_area_m2": None,
        "volume_reduction_litres": None,
        "volume_reduction_percent": None,
        "blank_area_change_percent": None,
        "note": "Internal volume is the comparison basis. A smaller carton can still use a different amount of board.",
    }
    if primary is None:
        return comparison
    recommended_volume = float(primary["volume_litres"])
    recommended_area = float(primary["blank_area_m2"])
    comparison.update(
        {
            "recommended_volume_litres": recommended_volume,
            "recommended_unoccupied_litres": round(recommended_volume - product_volume, 6),
            "recommended_blank_area_m2": recommended_area,
            "volume_reduction_litres": round(current_volume - recommended_volume, 6),
            "volume_reduction_percent": reduction_percent(current_volume, recommended_volume),
            "blank_area_change_percent": reduction_percent(current_area, recommended_area),
        }
    )
    return comparison


def _assumptions(validated: ValidatedRedesign, rules: dict[str, Any], clearance_rule: str | None) -> dict[str, Any]:
    return {
        "clearance_rule": clearance_rule,
        "dimension_increment_mm": validated.increment_mm,
        "protection_testing_required": True,
        "joint_allowance_mm": rules["joint_allowance_mm"],
        "manufacturing_waste_factor": rules["manufacturing_waste_factor"],
        "blank_formula": "blank length = 2 × (L + W) + joint; blank width = H + W; flaps = W / 2",
        "external_dimension_policy": "external = internal + 2 × board thickness on each axis",
        "current_package_policy": rules["external_dimension_policy"],
        "orientation_policy": rules["orientation_policy"],
        "price_basis": "Illustrative catalogue rates unless a candidate reports that a rate is missing.",
        "volume_comparison_basis": "internal litres, using the same millimetre convention for the current and recommended cartons",
        "currency": "INR",
        "notes": [
            rules["description"],
            rules["joint_allowance_note"],
            rules["manufacturing_waste_note"],
            "The user supplies the product and the current package only. Recommended dimensions are calculated.",
        ],
    }


def run_redesign(
    request: RedesignRequest,
    materials: dict[str, Any],
    rules: dict[str, Any],
) -> dict[str, Any]:
    validated = validate_redesign(request, materials, rules)
    joint = float(rules["joint_allowance_mm"])
    current_length, current_width, current_area = blank_area_m2(validated.current_internal, joint)
    existing_cost, existing_status = _existing_cost(
        validated, current_length, current_width, float(rules["manufacturing_waste_factor"])
    )
    boards = by_id(materials["boards"])
    cushions = by_id(materials["cushioning"])
    candidates: list[dict[str, Any]] = []
    rejected: list[dict[str, str]] = []

    for index, configuration in enumerate(materials["configurations"]):
        board = boards.get(str(configuration["board_id"]))
        cushion = cushions.get(str(configuration["cushioning_id"]))
        reason = assess_configuration(
            configuration,
            board,
            cushion,
            fragility=validated.fragility,
            weight_kg=validated.weight_kg,
            box_style=validated.box_style,
        )
        if reason is not None or board is None or cushion is None:
            rejected.append({"id": str(configuration["id"]), "reason": reason or "Configuration data is incomplete."})
            continue
        candidates.append(
            _build_candidate(
                index=index,
                configuration=configuration,
                board=board,
                cushion=cushion,
                validated=validated,
                rules=rules,
                existing_unit_inr=existing_cost,
            )
        )

    recommendations, _tie_note = _rank(candidates)
    primary = recommendations[0] if recommendations else None
    current_volume = _litres(validated.current_internal)
    clearance_rule = None if primary is None else primary["protection_clearance_mm"]["rule_id"]
    status = "success" if primary is not None else "no_feasible_configuration"
    warnings = list(GLOBAL_WARNINGS)
    if primary is None:
        warnings.append("No catalogue configuration satisfies the product weight, carton style and material constraints.")

    recommended = None
    geometry = None
    if primary is not None:
        recommended = {
            "configuration_id": primary["configuration_id"],
            "material_id": primary["material_id"],
            "material_name": primary["material_name"],
            "internal_dimensions_mm": primary["internal_dimensions_mm"],
            "external_dimensions_mm": primary["external_dimensions_mm"],
            "minimum_internal_dimensions_mm": primary["minimum_internal_dimensions_mm"],
            "volume_litres": primary["volume_litres"],
            "external_volume_litres": primary["external_volume_litres"],
            "protection_clearance_mm": primary["protection_clearance_mm"],
            "packaging_style": primary["packaging_style"],
            "selected_orientation": primary["selected_orientation"],
            "orientation_id": primary["orientation_id"],
            "height_axis": primary["height_axis"],
            "blank_area_m2": primary["blank_area_m2"],
            "blank_length_mm": primary["blank_length_mm"],
            "blank_width_mm": primary["blank_width_mm"],
            "material_mass_g": primary["material_mass_g"],
            "unit_cost_inr": primary["cost"]["unit_cost_inr"],
            "cost_status": primary["cost"]["status"],
        }
        geometry = primary["geometry"]

    return {
        "status": status,
        "product_name": validated.product_name,
        "product": {
            "category": validated.category,
            "dimensions_mm": validated.product.as_dict(),
            "weight_kg": validated.weight_kg,
            "fragility": validated.fragility,
            "shape": validated.shape,
            "orientation_constraint": validated.orientation_constraint,
            "quantity_per_package": validated.quantity_per_package,
            "volume_litres": _litres(validated.product),
        },
        "current_packaging": _current_summary(
            validated, current_length, current_width, current_area, existing_cost, existing_status
        ),
        "recommended_packaging": recommended,
        "comparison": _comparison(validated, current_volume, current_area, primary),
        "recommendations": recommendations,
        "rejected_configurations": rejected,
        "geometry": geometry,
        "evaluated_orientations": _orientation_payload(validated.orientation_constraint),
        "candidates_considered": len(candidates),
        "calculation_assumptions": _assumptions(validated, rules, clearance_rule),
        "warnings": warnings,
        "monthly_quantity": validated.monthly_quantity,
    }

"""Deterministic FEFCO 0201 candidate search, Pareto screen and decision."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from services.blank_geometry import Axis, internal_size, outer_size, simplified_blank, unused_percent
from services.catalog import load_board_profiles, load_geometry_profiles
from services.optimise_cost import order_comparison, quote_carton
from services.cost_target import cost_target_report
from services.pack_fit import assess_existing, explain_advisor, manufacturing_report, recommendation, sustainability_report
from services.pareto import active_objectives, dominates, pareto_ids
from services.units import millimetres, money
from services.validation_service import PackagingValidationError

FOOD_WORDS = ("food", "biscuit", "cookie", "snack", "grocery")
PLASTIC_WORDS = ("pet", "plastic", "polymer")


def _error(field: str, message: str) -> dict[str, str]:
    return {"field": field, "message": message}


def _positive_axis(payload: dict[str, Any], field: str) -> Axis:
    errors: list[dict[str, str]] = []
    numbers: list[float] = []
    for name in ("length", "width", "height"):
        try:
            value = float(payload[name])
        except (KeyError, TypeError, ValueError):
            errors.append(_error(f"{field}.{name}", "Enter this dimension in millimetres."))
            continue
        if value <= 0 or value > 3000:
            errors.append(_error(f"{field}.{name}", "Dimensions must be greater than 0 mm and at most 3000 mm."))
        else:
            numbers.append(millimetres(value))
    if errors:
        raise PackagingValidationError(errors)
    return Axis(*numbers)


def _clearance(raw: Any) -> Axis:
    if not isinstance(raw, dict):
        raise PackagingValidationError(
            [_error("product.clearance_mm", "Enter clearance on length, width and height in millimetres.")]
        )
    errors: list[dict[str, str]] = []
    numbers: list[float] = []
    for name in ("length", "width", "height"):
        try:
            value = float(raw[name])
        except (KeyError, TypeError, ValueError):
            errors.append(_error(f"product.clearance_mm.{name}", "Enter clearance in millimetres."))
            continue
        if value < 0 or value > 200:
            errors.append(_error(f"product.clearance_mm.{name}", "Clearance must be from 0 to 200 mm."))
        else:
            numbers.append(millimetres(value))
    if errors:
        raise PackagingValidationError(errors)
    return Axis(*numbers)


def _orientations(constraint: str, product: Axis) -> list[tuple[str, Axis, bool]]:
    declared = ("declared", product, True)
    if constraint == "declared_only":
        return [declared]
    if constraint == "any":
        return [declared, ("yaw_90", Axis(product.width, product.length, product.height), False)]
    raise PackagingValidationError(
        [_error("product.orientation_constraint", "Use declared_only or any. Side poses are not generated in this version.")]
    )


def _food_context(category: str, current_material: str) -> dict[str, Any]:
    food = any(word in category.lower() for word in FOOD_WORDS)
    plastic = any(word in current_material.lower() for word in PLASTIC_WORDS)
    notes = []
    if food:
        notes.append(
            "A food category means this RSC is secondary packaging unless a food-contact specification is supplied."
        )
        notes.append("Moisture barrier, sealing and shelf life are not evaluated.")
    return {
        "food_category": food,
        "current_material_appears_plastic": plastic,
        "function_equivalent": not food and not plastic,
        "notes": notes,
    }


def _protection(clearance: Axis, fragility: str, board: dict[str, Any]) -> dict[str, Any]:
    return {
        "clearance_mm": clearance.as_dict(),
        "clearance_meaning": "Empty space on each face. It is not a cushion and it is not a test result.",
        "cushioning_material": None,
        "fragility": fragility,
        "product_mass_changes_board_grade": False,
        "stacking_known": False,
        "transport_known": False,
        "strength_evidence": board.get("ect_kn_per_m") is not None or board.get("compression_n") is not None,
        "safe_to_ship": False,
    }


def _feasibility(board: dict[str, Any], food: dict[str, Any], protection: dict[str, Any], fits: bool, declared: bool) -> tuple[str, list[str]]:
    if not fits:
        return "rejected", ["The product does not fit inside the candidate with the required clearance."]
    reasons: list[str] = []
    if not declared:
        reasons.append(
            "This pose swaps the declared length and width. It is only a blank-area comparison, not evidence the product can ship that way."
        )
    if not protection["strength_evidence"]:
        reasons.append("No ECT or compression value is loaded, so board strength is not established.")
    reasons.append("No cushioning material is specified. Clearance alone does not demonstrate protection.")
    reasons.append("Stacking and transport conditions were not supplied.")
    if food["food_category"] and not board.get("food_contact_documented"):
        reasons.append("Food-contact suitability is not documented for this board.")
    if not reasons:
        return "eligible", ["The loaded evidence covers the required checks for this version."]
    return "needs_validation", reasons


def _build_candidate(
    *,
    index: int,
    board: dict[str, Any],
    geometry_profile: dict[str, Any],
    orientation_id: str,
    placed: Axis,
    declared: bool,
    clearance: Axis,
    minimum_clearance: Axis,
    product: Axis,
    fragility: str,
    food: dict[str, Any],
    parameters: dict[str, Any],
    existing_unit: float | None,
    quantity: int,
) -> dict[str, Any]:
    internal = internal_size(placed, clearance)
    fits = (
        clearance.length + 1e-9 >= minimum_clearance.length
        and clearance.width + 1e-9 >= minimum_clearance.width
        and clearance.height + 1e-9 >= minimum_clearance.height
        and internal.length + 1e-9 >= placed.length
        and internal.width + 1e-9 >= placed.width
        and internal.height + 1e-9 >= placed.height
    )
    outer = outer_size(internal, float(board["thickness_mm"]))
    blank = simplified_blank(internal, geometry_profile)
    quote = quote_carton(
        area_m2=float(blank["area_m2"]),
        rate_inr_per_m2=board.get("price_inr_per_m2"),
        conversion_inr=board.get("conversion_cost_inr"),
        parameters=parameters,
        price_basis=str(board.get("price_basis") or "demonstration_assumption"),
    )
    comparison = order_comparison(quote.get("unit_cost_inr"), existing_unit, quantity)
    exact_unused, unused = unused_percent(product, internal)
    protection = _protection(clearance, fragility, board)
    status, reasons = _feasibility(board, food, protection, fits, declared)
    grammage = board.get("grammage_g_m2")
    mass = None
    if grammage is not None and quote.get("billed_area_m2") is not None:
        mass = money(Decimal(str(quote["billed_area_m2"])) * Decimal(str(grammage)))
    return {
        "id": f"{board['id']}__{geometry_profile['id']}__{orientation_id}__{clearance.length:g}x{clearance.width:g}x{clearance.height:g}",
        "catalogue_index": index,
        "board_id": board["id"],
        "board_name": board["name"],
        "flute": board["flute"],
        "thickness_mm": board["thickness_mm"],
        "geometry_id": geometry_profile["id"],
        "geometry_label": geometry_profile["label"],
        "orientation": orientation_id,
        "declared_orientation": declared,
        "feasibility": status,
        "feasibility_reasons": reasons,
        "internal_dimensions_mm": internal.as_dict(),
        "outer_dimensions_mm": outer.as_dict(),
        "outer_dimension_note": "Outer size is an estimate: internal size plus one board thickness on every face. Manufacturing tolerance is not included.",
        "blank": blank,
        "volumes": {
            "product_litres": product.volume_litres(),
            "internal_litres": internal.volume_litres(),
            "outer_litres": outer.volume_litres(),
            "outer_litres_display": float(Decimal(str(outer.volume_litres())).quantize(Decimal("0.001"), rounding="ROUND_HALF_UP")),
            "unused_internal_percent_exact": round(exact_unused, 6),
            "unused_internal_percent": unused,
        },
        "mass_g": mass,
        "mass_status": "unavailable" if mass is None else "estimated_from_supplied_grammage",
        "cost": {**quote, **comparison},
        "protection": protection,
        "environmental_data": "unavailable" if board.get("environmental_impact_factor") is None else "supplied",
        "data_gaps": [
            name
            for name, present in (
                ("ECT", board.get("ect_kn_per_m") is not None),
                ("compression", board.get("compression_n") is not None),
                ("recycled content", board.get("recycled_content_percent") is not None),
                ("food-contact document", board.get("food_contact_documented") is True),
                ("environmental factor", board.get("environmental_impact_factor") is not None),
                ("grammage", grammage is not None),
            )
            if not present
        ],
        "objectives": {
            "unit_cost_inr": quote.get("unit_cost_inr"),
            "blank_area_m2": blank["area_m2"],
            "outer_litres": outer.volume_litres(),
            "mass_g": mass,
        },
    }


def _focus(front: list[dict[str, Any]], preference: str) -> dict[str, Any] | None:
    if not front:
        return None
    if preference == "lowest_cost":
        return min(front, key=lambda item: (item["objectives"]["unit_cost_inr"], item["objectives"]["blank_area_m2"], item["catalogue_index"]))
    if preference == "lowest_material":
        return min(front, key=lambda item: (item["objectives"]["blank_area_m2"], item["objectives"]["outer_litres"], item["catalogue_index"]))
    return min(front, key=lambda item: (item["objectives"]["outer_litres"], item["objectives"]["blank_area_m2"], item["catalogue_index"]))


def _decision(front: list[dict[str, Any]], food: dict[str, Any], existing_unit: float | None) -> dict[str, Any]:
    priced = [item for item in front if item["cost"].get("unit_cost_inr") is not None]
    if not priced or existing_unit is None:
        return {
            "id": "insufficient_data",
            "title": "Insufficient data",
            "summary": "The comparison needs the current unit cost and at least one priced carton that is not rejected.",
            "safe_to_ship": False,
        }
    eligible = [item for item in priced if item["feasibility"] == "eligible" and food["function_equivalent"]]
    if eligible:
        best = min(eligible, key=lambda item: item["cost"]["unit_cost_inr"])
        if best["cost"]["unit_cost_inr"] < existing_unit:
            return {
                "id": "recommend_verified",
                "title": "Verified alternative",
                "summary": "A candidate meets the evidence rules in this version and has a lower loaded cost. The converter still has to confirm the drawing.",
                "safe_to_ship": False,
            }
    if all(item["cost"]["unit_cost_inr"] >= existing_unit for item in priced):
        return {
            "id": "keep_existing",
            "title": "Keep existing packaging",
            "summary": "No evidenced corrugated candidate costs less than the pack you entered. A change of material is not treated as a protection or environmental improvement.",
            "safe_to_ship": False,
        }
    return {
        "id": "prototype_testing",
        "title": "Prototype testing",
        "summary": "A carton is cheaper on the loaded rates, but protection, strength or functional equivalence is still missing. Test a sample before changing the pack.",
        "safe_to_ship": False,
    }


def _dominance_note(candidate: dict[str, Any], winner: dict[str, Any], keys: list[str]) -> str:
    labels = {"unit_cost_inr": "unit cost", "blank_area_m2": "sheet area", "outer_litres": "outer volume", "mass_g": "mass"}
    worse = [
        labels.get(key, key)
        for key in keys
        if Decimal(str(candidate["objectives"][key])) > Decimal(str(winner["objectives"][key]))
    ]
    detail = ", ".join(worse) if worse else "the ranked measures"
    return f"Dominated by {winner['board_name']} / {winner['geometry_label']} on {detail}."


def run_optimise(payload: dict[str, Any]) -> dict[str, Any]:
    product_payload = payload.get("product") or {}
    current_payload = payload.get("current_packaging") or {}
    product = _positive_axis(product_payload.get("dimensions_mm") or {}, "product.dimensions_mm")
    stated = _positive_axis(current_payload.get("dimensions_mm") or {}, "current_packaging.dimensions_mm")
    clearance = _clearance(product_payload.get("clearance_mm"))
    quantity = payload.get("quantity")
    if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity < 1 or quantity > 1_000_000:
        raise PackagingValidationError([_error("quantity", "Quantity must be a whole number from 1 to 1000000.")])
    try:
        weight_g = float(product_payload.get("weight_g"))
    except (TypeError, ValueError):
        raise PackagingValidationError([_error("product.weight_g", "Enter the product weight in grams.")]) from None
    if weight_g <= 0 or weight_g > 100_000:
        raise PackagingValidationError([_error("product.weight_g", "Weight must be greater than 0 g and at most 100000 g.")])
    name = str(product_payload.get("name") or "").strip()
    category = str(product_payload.get("category") or "").strip()
    fragility = str(product_payload.get("fragility") or "")
    errors: list[dict[str, str]] = []
    if not name:
        errors.append(_error("product.name", "Enter a product name."))
    if not category:
        errors.append(_error("product.category", "Enter a category."))
    if fragility not in {"low", "medium", "high"}:
        errors.append(_error("product.fragility", "Fragility must be low, medium or high."))
    preference = str(payload.get("preference") or "balanced")
    if preference not in {"lowest_cost", "lowest_material", "balanced"}:
        errors.append(_error("preference", "Preference must be lowest_cost, lowest_material or balanced."))
    material_name = str(current_payload.get("material_name") or "").strip()
    if not material_name:
        errors.append(_error("current_packaging.material_name", "Name the current packaging material."))
    existing_cost = current_payload.get("cost_per_unit_inr")
    if existing_cost is not None:
        try:
            existing_cost = float(existing_cost)
        except (TypeError, ValueError):
            errors.append(_error("current_packaging.cost_per_unit_inr", "Enter the current unit cost in rupees."))
            existing_cost = None
        if isinstance(existing_cost, float) and existing_cost < 0:
            errors.append(_error("current_packaging.cost_per_unit_inr", "Cost cannot be negative."))
    if errors:
        raise PackagingValidationError(errors)
    constraint = str(product_payload.get("orientation_constraint") or "declared_only")
    catalogue = load_board_profiles()
    geometries = load_geometry_profiles()
    parameters = catalogue["cost_parameters"]
    food = _food_context(category, material_name)
    candidates: list[dict[str, Any]] = []
    index = 0
    for orientation_id, placed, declared in _orientations(constraint, product):
        for geometry in geometries.values():
            for board in catalogue["profiles"]:
                candidates.append(
                    _build_candidate(
                        index=index,
                        board=board,
                        geometry_profile=geometry,
                        orientation_id=orientation_id,
                        placed=placed,
                        declared=declared,
                        clearance=clearance,
                        minimum_clearance=clearance,
                        product=product,
                        fragility=fragility,
                        food=food,
                        parameters=parameters,
                        existing_unit=existing_cost,
                        quantity=quantity,
                    )
                )
                index += 1
    reference_board = next(board for board in catalogue["profiles"] if board["id"] == "c_flute")
    candidates.append(
        _build_candidate(
            index=index,
            board=reference_board,
            geometry_profile=geometries["simplified"],
            orientation_id="declared",
            placed=product,
            declared=True,
            clearance=Axis(millimetres(clearance.length + 5), millimetres(clearance.width + 5), millimetres(clearance.height + 5)),
            minimum_clearance=clearance,
            product=product,
            fragility=fragility,
            food=food,
            parameters=parameters,
            existing_unit=existing_cost,
            quantity=quantity,
        )
    )
    rankable = [item for item in candidates if item["feasibility"] != "rejected" and item["cost"].get("unit_cost_inr") is not None]
    objective_keys = active_objectives(rankable, ("unit_cost_inr", "blank_area_m2", "outer_litres", "mass_g"))
    front_ids = pareto_ids(rankable, objective_keys)
    front = [item for item in rankable if item["id"] in front_ids]
    focus = _focus(front, preference)
    for candidate in candidates:
        candidate["on_pareto_front"] = candidate["id"] in front_ids
        candidate["preference_focus"] = focus is not None and candidate["id"] == focus["id"]
        winner = next((item for item in front if dominates(item, candidate, objective_keys)), None)
        candidate["dominated"] = winner is not None
        candidate["dominance_note"] = None if winner is None else _dominance_note(candidate, winner, objective_keys)
    generated = next(
        item
        for item in candidates
        if item["board_id"] == "c_flute"
        and item["geometry_id"] == "packshift_simplified"
        and item["orientation"] == "declared"
        and item["protection"]["clearance_mm"] == clearance.as_dict()
    )
    warnings = [
        "Outer dimensions are estimates and still need the converter's manufacturing tolerance.",
        "No candidate is certified, transit-tested, or safe to ship.",
        "A smaller sheet or a thinner flute is not evidence of lower environmental impact. No life-cycle factor is loaded.",
        "The current packaging cost is the amount you entered. PackShift does not recalculate it.",
        *food["notes"],
    ]
    if food["current_material_appears_plastic"]:
        warnings.append(
            "The current material is not corrugated board. Equal protection is not assumed, and cardboard is not treated as automatically preferable."
        )
    thickness = current_payload.get("board_thickness_mm")
    fit = assess_existing(
        product=product.as_dict(),
        clearance=clearance.as_dict(),
        stated=stated.as_dict(),
        dimension_type=str(current_payload.get("dimension_type") or "external"),
        board_thickness_mm=None if thickness is None else float(thickness),
    )
    same_clearance = [
        item
        for item in candidates
        if item["geometry_id"] == "packshift_simplified"
        and item["orientation"] == "declared"
        and item["protection"]["clearance_mm"] == clearance.as_dict()
        and item["cost"].get("unit_cost_inr") is not None
    ]
    evaluation = recommendation(
        fit=fit,
        material_costs=[float(item["cost"]["unit_cost_inr"]) for item in same_clearance],
        existing_unit=existing_cost,
        strength_evidence=any(item["protection"]["strength_evidence"] for item in candidates),
        manufacturing=manufacturing_report(
            area_m2=float(generated["blank"]["area_m2"]),
            unit_cost=generated["cost"].get("unit_cost_inr"),
            quantity=quantity,
            context=payload.get("manufacturing") if isinstance(payload.get("manufacturing"), dict) else None,
        ),
        sustainability=sustainability_report(
            area_m2=float(generated["blank"]["area_m2"]),
            grammage_g_m2=reference_board.get("grammage_g_m2"),
            quantity=quantity,
            waste_factor=float(parameters.get("waste_factor") or 0),
            environmental_factor=reference_board.get("environmental_impact_factor"),
            current_material=material_name,
        ),
    )
    evaluation["cost_target"] = cost_target_report(
        candidates=same_clearance,
        proposed=generated,
        existing_unit=existing_cost,
        quantity=quantity,
        category=category,
        fragility=fragility,
    )
    evaluation["advisor"] = explain_advisor(
        fit,
        proposed_outer=generated["outer_dimensions_mm"],
        existing_is_outer=str(current_payload.get("dimension_type") or "") == "external",
        existing_dimensions=stated.as_dict(),
        cost=evaluation["cost_target"],
    )
    warnings.append(evaluation["sustainability"]["message"])
    return {
        "status": "success",
        "preference": preference,
        "decision": {
            "id": evaluation["primary"]["legacy_id"],
            "title": evaluation["primary"]["title"],
            "summary": evaluation["primary"]["summary"],
            "safe_to_ship": False,
        },
        "evaluation": evaluation,
        "objective_keys": objective_keys,
        "objective_note": "Mass is excluded while grammage is missing. Ranked objectives are minimised.",
        "current_generated": generated,
        "existing_packaging": {
            "material_name": material_name,
            "dimension_type": current_payload.get("dimension_type") or "external",
            "dimensions_mm": stated.as_dict(),
            "volume_litres": stated.volume_litres(),
            "cost_per_unit_inr": existing_cost,
            "order_cost_inr": None if existing_cost is None else money(Decimal(str(existing_cost)) * Decimal(quantity)),
            "role": current_payload.get("role") or "current",
        },
        "comparison": {
            "existing_unit_cost_inr": existing_cost,
            "proposed_unit_cost_inr": generated["cost"].get("unit_cost_inr"),
            "existing_order_cost_inr": generated["cost"].get("existing_order_cost_inr"),
            "proposed_order_cost_inr": generated["cost"].get("order_cost_inr"),
            "order_cost_difference_inr": generated["cost"].get("order_difference_inr"),
            "change_percent": generated["cost"].get("change_percent"),
            "direction": generated["cost"].get("direction"),
            "basis": "The proposed figures are the studio simplified C-flute carton.",
        },
        "candidates": candidates,
        "pareto_front_ids": front_ids,
        "preference_focus_id": None if focus is None else focus["id"],
        "product": {
            "name": name,
            "category": category,
            "dimensions_mm": product.as_dict(),
            "weight_g": weight_g,
            "weight_kg": float(Decimal(str(weight_g)) / Decimal(1000)),
            "fragility": fragility,
            "clearance_mm": clearance.as_dict(),
            "orientation_constraint": constraint,
        },
        "food": food,
        "warnings": warnings,
        "assumptions": [
            geometries["simplified"]["scope"],
            geometries["converter"]["scope"],
            catalogue["notice"],
            *parameters["notes"],
            "Product dimensions are never replaced by the current pack dimensions.",
            "Clearance is not reduced below the value you entered.",
        ],
    }

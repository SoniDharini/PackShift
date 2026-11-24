"""Compare a stated carton with the clearance the user asked for.

Outer measurements are not treated as internal measurements. A missing board
thickness stays missing. No result here is a strength test or a carbon claim.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from services.units import litres_from_dimensions, millimetres, money

TOLERANCE_MM = 0.5
AXIS_EXCESS_MM = 10.0
VOLUME_EXCESS_RATIO = Decimal("1.15")
UNAVAILABLE = "Environmental comparison unavailable — additional material data is required."
UNKNOWN_SIZE = "Current packaging dimensions cannot be fully validated. Internal carton dimensions or board specifications are required."


def _axis(length: float, width: float, height: float) -> dict[str, float]:
    return {"length": millimetres(length), "width": millimetres(width), "height": millimetres(height)}


def _volume(size: dict[str, float]) -> float:
    return litres_from_dimensions(size["length"], size["width"], size["height"])


def _shorter(stated: dict[str, float], required: dict[str, float]) -> bool:
    return any(stated[name] + TOLERANCE_MM < required[name] for name in ("length", "width", "height"))


def _gaps(current: dict[str, float], required: dict[str, float], basis: str) -> list[dict[str, Any]]:
    gaps = []
    for name in ("length", "width", "height"):
        if current[name] + TOLERANCE_MM < required[name]:
            gaps.append(
                {
                    "axis": name,
                    "current_mm": current[name],
                    "required_mm": required[name],
                    "shortage_mm": millimetres(required[name] - current[name]),
                    "basis": basis,
                }
            )
    return gaps


def _shortage_sentence(gaps: list[dict[str, Any]], product: dict[str, float] | None = None) -> str:
    internal = [gap for gap in gaps if gap["basis"] == "internal"]
    if internal and len(internal) == len(gaps):
        needs = ", ".join(f"{gap['shortage_mm']:g} mm more internal {gap['axis']}" for gap in internal)
        sentence = f"The box needs {needs} to meet your required clearance."
        if product is not None:
            blocked = [gap for gap in internal if gap["current_mm"] + TOLERANCE_MM < product[gap["axis"]]]
            if blocked:
                detail = ", ".join(
                    f"the inside {gap['axis']} is {gap['current_mm']:g} mm and the product is {product[gap['axis']]:g} mm"
                    for gap in blocked
                )
                return f"The product cannot physically fit: {detail}. {sentence}"
            return f"The product fits, but without the clearance you specified. {sentence}"
        return sentence
    parts = [
        f"{gap['shortage_mm']:g} mm of {gap['basis']} {gap['axis']} ({gap['current_mm']:g} mm against {gap['required_mm']:g} mm)"
        for gap in gaps
    ]
    detail = "; ".join(parts) if parts else "at least one side"
    return f"Your existing box does not provide enough space for your product and its required clearance. It is short by {detail}."


def _clearance(internal: dict[str, float], product: dict[str, float]) -> dict[str, float]:
    return _axis(
        (internal["length"] - product["length"]) / 2,
        (internal["width"] - product["width"]) / 2,
        (internal["height"] - product["height"]) / 2,
    )


def assess_existing(
    *,
    product: dict[str, float],
    clearance: dict[str, float],
    stated: dict[str, float],
    dimension_type: str,
    board_thickness_mm: float | None,
) -> dict[str, Any]:
    required = _axis(
        product["length"] + 2 * clearance["length"],
        product["width"] + 2 * clearance["width"],
        product["height"] + 2 * clearance["height"],
    )
    required_clearance = _axis(clearance["length"], clearance["width"], clearance["height"])
    base = {
        "required_internal_mm": required,
        "required_clearance_mm": required_clearance,
        "required_internal_litres": _volume(required),
        "stated_mm": _axis(stated["length"], stated["width"], stated["height"]),
        "dimension_type": dimension_type,
        "board_thickness_mm": None if board_thickness_mm is None else millimetres(board_thickness_mm),
        "tolerance_mm": TOLERANCE_MM,
        "oversize_axis_mm": AXIS_EXCESS_MM,
        "oversize_volume_ratio": float(VOLUME_EXCESS_RATIO),
        "protection_verified": False,
    }
    if dimension_type == "internal":
        current = _axis(stated["length"], stated["width"], stated["height"])
        return {**base, **_classify(current, required, product, "stated_internal")}
    if dimension_type == "external" and board_thickness_mm is not None:
        thickness = millimetres(board_thickness_mm)
        current = _axis(
            stated["length"] - 2 * thickness,
            stated["width"] - 2 * thickness,
            stated["height"] - 2 * thickness,
        )
        if any(current[name] <= 0 for name in ("length", "width", "height")):
            return {
                **base,
                "fit": "unknown",
                "code": "INSUFFICIENT_DATA",
                "current_internal_mm": None,
                "internal_source": "unusable_thickness",
                "available_clearance_mm": None,
                "summary": "The board thickness is not smaller than the stated outer size, so an internal size was not estimated.",
            }
        classified = _classify(current, required, product, "estimated_from_external")
        classified["summary"] = (
            "Internal size is estimated as the stated outer size minus two board thicknesses. "
            + classified["summary"]
        )
        return {**base, **classified}
    if _shorter(stated, required):
        gaps = _gaps(_axis(stated["length"], stated["width"], stated["height"]), required, "stated")
        return {
            **base,
            "fit": "undersized",
            "code": "DIMENSIONAL_REDESIGN_REQUIRED",
            "current_internal_mm": None,
            "internal_source": "stated_size_too_small",
            "available_clearance_mm": None,
            "shortfalls": gaps,
            "summary": (
                _shortage_sentence(gaps)
                + " The stated size is already smaller than the required inside size, so the cavity cannot be larger than that. "
                + "Increasing the carton is a correction, not a material-saving optimisation."
            ),
        }
    return {
        **base,
        "fit": "unknown",
        "code": "INSUFFICIENT_DATA",
        "current_internal_mm": None,
        "internal_source": "not_validated",
        "available_clearance_mm": None,
        "summary": UNKNOWN_SIZE,
    }


def _classify(current: dict[str, float], required: dict[str, float], product: dict[str, float], source: str) -> dict[str, Any]:
    available = _clearance(current, product)
    undersized = _shorter(current, required)
    excess_axis = any(current[name] > required[name] + AXIS_EXCESS_MM for name in ("length", "width", "height"))
    gaps = _gaps(current, required, "internal")
    if undersized:
        fit = "undersized"
        code = "DIMENSIONAL_REDESIGN_REQUIRED"
        summary = (
            _shortage_sentence(gaps, product)
            + " The minimum internal size is the product plus the clearance on both faces. "
            + "That correction is not a reduction in material."
        )
    elif excess_axis:
        fit = "oversized"
        code = "DIMENSIONAL_REDESIGN_REQUIRED"
        summary = (
            "Dimensional optimisation is recommended because the existing packaging is larger than necessary. "
            "A smaller study carton keeps the clearance you entered. "
            "It is not evidence of adequate protection."
        )
    else:
        fit = "suitable"
        code = "DIMENSIONS_SUITABLE"
        summary = (
            "Your existing packaging dimensions match the required geometric specifications. "
            "No dimensional redesign is currently necessary. "
            "A fit is not a claim that the pack is mechanically safe or the best design."
        )
    return {
        "fit": fit,
        "code": code,
        "current_internal_mm": current,
        "internal_source": source,
        "available_clearance_mm": available,
        "current_internal_litres": _volume(current),
        "unused_internal_percent_versus_product": _unused(product, current),
        "shortfalls": gaps,
        "summary": summary,
    }


def _unused(product: dict[str, float], internal: dict[str, float]) -> float | None:
    product_volume = Decimal(str(product["length"])) * Decimal(str(product["width"])) * Decimal(str(product["height"]))
    internal_volume = Decimal(str(internal["length"])) * Decimal(str(internal["width"])) * Decimal(str(internal["height"]))
    if internal_volume <= 0:
        return None
    percent = (Decimal(1) - product_volume / internal_volume) * Decimal(100)
    return float(percent.quantize(Decimal("0.1")))


def manufacturing_report(
    *,
    area_m2: float,
    unit_cost: float | None,
    quantity: int,
    context: dict[str, Any] | None,
) -> dict[str, Any]:
    finished = Decimal(str(area_m2))
    report: dict[str, Any] = {
        "code": "INSUFFICIENT_DATA",
        "finished_blank_m2": float(finished),
        "finished_dimensions_change": False,
        "purchased_sheet_m2": None,
        "scrap_m2": None,
        "supplier_unit_quote_inr": None,
        "quote_versus_estimate_inr": None,
        "summary": (
            "No sheet-nesting yield or supplier quotation was supplied, so no manufacturing saving is calculated. "
            "Flap allowances and board thickness are not reduced to invent one."
        ),
    }
    if not context:
        return report
    yield_ratio = context.get("nesting_yield")
    quote = context.get("supplier_unit_quote_inr")
    if yield_ratio is not None:
        ratio = Decimal(str(yield_ratio))
        purchased = finished / ratio
        scrap = purchased - finished
        report["purchased_sheet_m2"] = float(purchased)
        report["scrap_m2"] = float(scrap)
        report["order_scrap_m2"] = float(scrap * Decimal(quantity))
    if quote is not None:
        report["supplier_unit_quote_inr"] = money(Decimal(str(quote)))
        if unit_cost is not None:
            report["quote_versus_estimate_inr"] = money(Decimal(str(quote)) - Decimal(str(unit_cost)))
    if yield_ratio is None and quote is None:
        return report
    report["code"] = "MANUFACTURING_OPTIMISATION_AVAILABLE"
    report["summary"] = (
        "Your existing carton size is suitable to keep while these manufacturing figures are studied. "
        "The finished FEFCO 0201 dimensions are unchanged. "
        "A nesting yield describes purchased sheet versus the finished blank. "
        "It is not a saving against current production unless that process yield is also supplied."
    )
    return report


def sustainability_report(
    *,
    area_m2: float | None,
    grammage_g_m2: float | None,
    quantity: int,
    waste_factor: float,
    environmental_factor: float | None,
    current_material: str,
) -> dict[str, Any]:
    report: dict[str, Any] = {
        "code": "INSUFFICIENT_DATA",
        "current_material": current_material,
        "current_mass_g": None,
        "proposed_mass_g": None,
        "purchased_mass_g": None,
        "scrap_mass_g": None,
        "order_purchased_mass_g": None,
        "recycled_content_percent": None,
        "carbon_kg": None,
        "message": UNAVAILABLE,
        "summary": UNAVAILABLE,
    }
    if area_m2 is None or grammage_g_m2 is None:
        return report
    finished = Decimal(str(area_m2)) * Decimal(str(grammage_g_m2))
    purchased = finished * (Decimal(1) + Decimal(str(waste_factor)))
    scrap = purchased - finished
    report.update(
        {
            "proposed_mass_g": float(finished),
            "purchased_mass_g": float(purchased),
            "scrap_mass_g": float(scrap),
            "order_purchased_mass_g": float(purchased * Decimal(quantity)),
            "message": "Mass uses sheet area times the supplied grammage. Current packaging mass is unknown.",
            "summary": "Finished mass and purchased mass are separate. No carbon figure is calculated without an emission factor and a stated boundary.",
        }
    )
    if environmental_factor is None:
        report["carbon_kg"] = None
        return report
    report["code"] = "SUSTAINABILITY_OPPORTUNITY"
    report["carbon_note"] = "An emission factor was supplied. It is reported only with that factor and is not a full life-cycle result."
    report["carbon_kg"] = float(purchased * Decimal(str(environmental_factor)) / Decimal(1000))
    return report


def recommendation(
    *,
    fit: dict[str, Any],
    material_costs: list[float],
    existing_unit: float | None,
    strength_evidence: bool,
    manufacturing: dict[str, Any],
    sustainability: dict[str, Any],
) -> dict[str, Any]:
    codes = [fit["code"], "NEEDS_VALIDATION"]
    if manufacturing["code"] != "INSUFFICIENT_DATA":
        codes.append(manufacturing["code"])
    if sustainability["code"] != "INSUFFICIENT_DATA":
        codes.append(sustainability["code"])
    cheaper = [
        cost
        for cost in material_costs
        if existing_unit is not None and cost + 1e-9 < existing_unit
    ]
    material = {
        "code": "NEEDS_VALIDATION",
        "keeps_internal_dimensions": fit["fit"] == "suitable",
        "strength_evidence": strength_evidence,
        "cheaper_demonstration_count": len(cheaper),
        "summary": _material_summary(fit, cheaper, strength_evidence),
    }
    if fit["fit"] == "unknown":
        primary_id = "INSUFFICIENT_DATA"
        title = "Insufficient data"
        summary = UNKNOWN_SIZE + " Material, manufacturing and sustainability checks are still listed, and none is treated as a completed redesign."
    elif fit["fit"] in {"undersized", "oversized"}:
        primary_id = "DIMENSIONAL_REDESIGN_REQUIRED"
        title = "Dimensional redesign required" if fit["fit"] == "oversized" else "Dimensional correction required"
        summary = fit["summary"]
    elif cheaper and not strength_evidence:
        primary_id = "NEEDS_VALIDATION"
        title = "Potential cost improvement"
        summary = "Potential cost improvement identified. Physical protection validation is required before implementation."
        codes.append("MATERIAL_OPTIMISATION_AVAILABLE")
    elif manufacturing["code"] == "MANUFACTURING_OPTIMISATION_AVAILABLE" and not strength_evidence:
        primary_id = "NEEDS_VALIDATION"
        title = "Manufacturing figures supplied"
        summary = manufacturing["summary"] + " Protection is still unverified, so the current pack is not replaced."
    else:
        primary_id = "KEEP_EXISTING_PACKAGING"
        title = "Keep Your Existing Packaging"
        summary = (
            "Your current packaging meets the evaluated requirements, "
            "and no supported alternative currently offers a worthwhile improvement."
        )
        codes.append("KEEP_EXISTING_PACKAGING")
    if "DIMENSIONS_SUITABLE" == fit["code"] and primary_id != "KEEP_EXISTING_PACKAGING":
        codes.append("DIMENSIONS_SUITABLE")
    legacy = {
        "KEEP_EXISTING_PACKAGING": "keep_existing",
        "DIMENSIONAL_REDESIGN_REQUIRED": "dimensional_redesign",
        "INSUFFICIENT_DATA": "insufficient_data",
        "NEEDS_VALIDATION": "prototype_testing",
    }[primary_id]
    return {
        "dimensional": fit,
        "material": material,
        "manufacturing": manufacturing,
        "sustainability": sustainability,
        "protection": {
            "status": "not_verified",
            "safe_to_ship": False,
            "summary": "Clearance is a gap, not a cushion. No board in this run has the strength evidence required for a safe-to-ship claim.",
        },
        "primary": {"id": primary_id, "legacy_id": legacy, "title": title, "summary": summary, "safe_to_ship": False},
        "codes": list(dict.fromkeys(codes)),
    }


def _material_summary(fit: dict[str, Any], cheaper: list[float], strength_evidence: bool) -> str:
    if fit["fit"] == "suitable":
        opening = "Existing packaging dimensions are suitable. Material alternatives keep that internal size."
    elif fit["fit"] == "unknown":
        opening = "Material profiles are priced on the required internal size because the current internal size is not known."
    else:
        opening = "Material profiles are priced on the required internal size. The current size is not held fixed while it fails the fit check."
    if not strength_evidence:
        opening += " No ECT or compression value is loaded, so a thinner flute is not recommended."
    if cheaper:
        opening += " At least one demonstration price is lower than the cost you entered. That is not a protection result."
    else:
        opening += " No demonstration board is cheaper than the cost you entered."
    return opening


def explain_advisor(
    fit: dict[str, Any],
    *,
    proposed_outer: dict[str, float] | None,
    existing_is_outer: bool,
    existing_dimensions: dict[str, float] | None,
    cost: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Rule-based answers for the packaging evaluation. Numbers come only from the fit and cost results."""
    kind = fit.get("fit")
    reduction = _outer_reduction(existing_dimensions, proposed_outer) if existing_is_outer else None
    cheaper = bool(cost and cost.get("cheapest_below_target"))
    proposal_costs_more = bool(cost and cost.get("proposal") and cost["proposal"]["difference_per_unit_inr"] > 0)
    if kind == "unknown":
        recommendation_label = "More Information Needed"
        headline = "Current Box Size Cannot Be Verified"
        needs_change = "We cannot tell yet."
        why = "The existing box's inside measurements or wall thickness are needed to confirm whether it provides enough room."
        next_step = "Provide the inside measurements or the wall thickness of your current box, then generate again."
        size_line = "Size improvement cannot yet be calculated."
    elif kind == "undersized":
        recommendation_label = "Correct Insufficient Space"
        headline = "Your Current Box Is Too Small"
        needs_change = "Yes. The box needs to become larger."
        why = fit.get("summary") or "Your existing box does not provide enough space for your product and its required clearance."
        next_step = "Your box needs more space to meet the specified clearance. Correct the dimensions before evaluating cost savings."
        if reduction is not None and reduction < -0.05:
            size_line = f"Proposed carton is {abs(reduction):.1f}% larger."
        else:
            size_line = "The proposed carton is larger so the product and the clearance can fit."
    elif kind == "oversized":
        recommendation_label = "Resize Packaging"
        headline = "Your Current Box Is Larger Than Required"
        needs_change = "Yes. The box could become smaller."
        why = "Your existing box has more space than necessary. A smaller carton may reduce packaging space."
        next_step = "Your box could be smaller. The proposed dimensions reduce packaging volume, but we also need to compare costs before recommending a change."
        if reduction is not None and reduction > 0.05:
            size_line = f"{reduction:.1f}% less packaging volume."
        else:
            size_line = "A smaller carton may reduce packaging space. The outer-volume change needs the wall thickness or outside size of the current box."
    else:
        headline = "Your Current Box Size Is Suitable"
        needs_change = "No. No dimensional redesign is needed."
        why = "Your current box already provides enough space for the product and the required clearance. No dimensional redesign is needed."
        if cheaper:
            recommendation_label = "Explore Cheaper Material"
            next_step = "A lower-cost material option is available. Review its estimated savings and protection requirements before switching."
        elif proposal_costs_more:
            recommendation_label = "Keep Your Existing Packaging"
            next_step = (
                "Keep your current box dimensions. At the current prices, replacing your existing packaging would "
                "increase costs. Explore a lower-cost board or manufacturing supplier before changing."
            )
        else:
            recommendation_label = "Keep Your Existing Packaging"
            next_step = "Keep your existing box dimensions. Explore material or manufacturing improvements if you want to reduce costs."
        if reduction is None:
            size_line = "Outer volume change needs the outside size of the current box."
        elif abs(reduction) <= 0.05:
            size_line = "Both packaging designs occupy the same outer space. Volume change: 0%."
        elif reduction > 0:
            size_line = f"The proposed carton is {reduction:.1f}% smaller, and the current size already fits."
        else:
            size_line = f"The proposed carton is {abs(reduction):.1f}% larger."
    return {
        "fit": kind,
        "headline": headline,
        "recommendation": recommendation_label,
        "recommendation_title": "Keep Your Existing Packaging" if recommendation_label == "Keep Your Existing Packaging" else headline,
        "needs_change": needs_change,
        "why": why,
        "next": next_step,
        "size_line": size_line,
        "outer_volume_reduction_percent": reduction,
        "required_internal_mm": fit.get("required_internal_mm"),
        "current_internal_mm": fit.get("current_internal_mm"),
        "required_outer_mm": proposed_outer,
        "shortfalls": fit.get("shortfalls") or [],
    }


def _outer_reduction(existing: dict[str, float] | None, proposed: dict[str, float] | None) -> float | None:
    if not existing or not proposed:
        return None
    current = Decimal(str(_volume(existing)))
    nxt = Decimal(str(_volume(proposed)))
    if current <= 0:
        return None
    change = (current - nxt) / current * Decimal(100)
    return float(change.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))

"""Fit checks and the four optimisation scenarios."""

from services.pack_fit import UNAVAILABLE, UNKNOWN_SIZE
from tests.test_optimise import cookie_request
from services.optimise_engine import run_optimise


def _device(**overrides):
    payload = cookie_request()
    payload["product"]["name"] = "Electronic Device"
    payload["product"]["category"] = "Electronics"
    payload["current_packaging"] = {
        "dimensions_mm": {"length": 210, "width": 160, "height": 80},
        "dimension_type": "internal",
        "material_name": "Corrugated cardboard",
        "cost_per_unit_inr": 12,
        "role": "current",
    }
    payload.update(overrides)
    return payload


def test_suitable_internal_dimensions_do_not_force_a_redesign():
    body = run_optimise(_device())
    fit = body["evaluation"]["dimensional"]
    assert fit["fit"] == "suitable"
    assert fit["code"] == "DIMENSIONS_SUITABLE"
    assert fit["current_internal_mm"] == {"length": 210.0, "width": 160.0, "height": 80.0}
    assert fit["required_internal_mm"] == {"length": 210.0, "width": 160.0, "height": 80.0}
    payload = _device()
    payload["current_packaging"]["board_thickness_mm"] = 4
    fit = run_optimise(payload)["evaluation"]["dimensional"]
    assert fit["fit"] == "suitable"
    assert fit["current_internal_mm"] == {"length": 210.0, "width": 160.0, "height": 80.0}
    assert fit["available_clearance_mm"] == {"length": 5.0, "width": 5.0, "height": 5.0}
    assert body["decision"]["id"] == "keep_existing"
    assert "DIMENSIONAL_REDESIGN_REQUIRED" not in body["evaluation"]["codes"]
    assert body["evaluation"]["material"]["keeps_internal_dimensions"] is True
    assert body["evaluation"]["protection"]["safe_to_ship"] is False
    assert body["evaluation"]["sustainability"]["message"] == UNAVAILABLE
    assert body["evaluation"]["sustainability"]["carbon_kg"] is None


def test_outer_size_and_board_thickness_can_estimate_a_suitable_cavity():
    payload = _device()
    payload["current_packaging"]["dimensions_mm"] = {"length": 218, "width": 168, "height": 88}
    payload["current_packaging"]["dimension_type"] = "external"
    payload["current_packaging"]["board_thickness_mm"] = 4
    fit = run_optimise(payload)["evaluation"]["dimensional"]
    assert fit["fit"] == "suitable"
    assert fit["internal_source"] == "estimated_from_external"
    assert fit["current_internal_mm"] == {"length": 210.0, "width": 160.0, "height": 80.0}


def test_outer_size_without_a_board_spec_is_not_treated_as_internal():
    payload = _device()
    payload["current_packaging"]["dimensions_mm"] = {"length": 250, "width": 200, "height": 120}
    payload["current_packaging"]["dimension_type"] = "external"
    fit = run_optimise(payload)["evaluation"]["dimensional"]
    assert fit["fit"] == "unknown"
    assert fit["summary"] == UNKNOWN_SIZE
    assert fit["current_internal_mm"] is None


def test_oversized_carton_proposes_the_required_size_without_a_safe_claim():
    payload = _device()
    payload["current_packaging"]["dimensions_mm"] = {"length": 280, "width": 220, "height": 120}
    body = run_optimise(payload)
    fit = body["evaluation"]["dimensional"]
    assert fit["fit"] == "oversized"
    assert body["decision"]["id"] == "dimensional_redesign"
    assert body["current_generated"]["internal_dimensions_mm"] == {"length": 210.0, "width": 160.0, "height": 80.0}
    assert body["current_generated"]["protection"]["safe_to_ship"] is False
    assert "saving" not in fit["summary"].lower() or "not evidence" in fit["summary"].lower()


def test_product_200_outer_218_with_4mm_board_is_suitable():
    payload = _device()
    payload["product"]["dimensions_mm"] = {"length": 200, "width": 150, "height": 70}
    payload["current_packaging"]["dimensions_mm"] = {"length": 218, "width": 168, "height": 88}
    payload["current_packaging"]["dimension_type"] = "external"
    payload["current_packaging"]["board_thickness_mm"] = 4
    body = run_optimise(payload)
    fit = body["evaluation"]["dimensional"]
    assert fit["required_internal_mm"] == {"length": 210.0, "width": 160.0, "height": 80.0}
    assert fit["current_internal_mm"] == {"length": 210.0, "width": 160.0, "height": 80.0}
    assert body["current_generated"]["outer_dimensions_mm"] == {"length": 218.0, "width": 168.0, "height": 88.0}
    assert fit["fit"] == "suitable"
    assert fit["shortfalls"] == []
    advisor = body["evaluation"]["advisor"]
    assert advisor["recommendation"] == "Keep Your Existing Packaging"
    assert advisor["recommendation_title"] == "Keep Your Existing Packaging"
    assert advisor["headline"] == "Your Current Box Size Is Suitable"
    assert advisor["needs_change"] == "No. No dimensional redesign is needed."
    assert "replacing your existing packaging would increase costs" in advisor["next"]
    assert advisor["outer_volume_reduction_percent"] == 0
    assert "same outer space" in advisor["size_line"]
    assert "220" not in advisor["why"]
    assert body["comparison"]["proposed_unit_cost_inr"] == 29.39
    assert round(body["comparison"]["proposed_unit_cost_inr"] - body["comparison"]["existing_unit_cost_inr"], 2) == 17.39
    assert body["comparison"]["order_cost_difference_inr"] == 173900
    assert round(body["comparison"]["change_percent"], 1) == 144.9


def test_clearance_volume_does_not_make_a_near_fit_carton_oversized():
    payload = _device()
    payload["current_packaging"]["dimensions_mm"] = {"length": 218, "width": 168, "height": 88}
    payload["current_packaging"]["dimension_type"] = "internal"
    payload["current_packaging"]["board_thickness_mm"] = 4
    body = run_optimise(payload)
    fit = body["evaluation"]["dimensional"]
    assert fit["fit"] == "suitable"
    assert fit["current_internal_mm"] == {"length": 218.0, "width": 168.0, "height": 88.0}
    assert body["evaluation"]["advisor"]["headline"] == "Your Current Box Size Is Suitable"
    assert body["evaluation"]["advisor"]["outer_volume_reduction_percent"] is None


def test_product_210_reports_10mm_internal_length_shortfall_not_the_outer_size():
    payload = _device()
    payload["product"]["dimensions_mm"] = {"length": 210, "width": 150, "height": 70}
    payload["current_packaging"]["dimensions_mm"] = {"length": 218, "width": 168, "height": 88}
    payload["current_packaging"]["dimension_type"] = "external"
    payload["current_packaging"]["board_thickness_mm"] = 4
    body = run_optimise(payload)
    fit = body["evaluation"]["dimensional"]
    assert fit["required_internal_mm"] == {"length": 220.0, "width": 160.0, "height": 80.0}
    assert fit["current_internal_mm"] == {"length": 210.0, "width": 160.0, "height": 80.0}
    assert body["current_generated"]["outer_dimensions_mm"] == {"length": 228.0, "width": 168.0, "height": 88.0}
    assert fit["fit"] == "undersized"
    assert fit["shortfalls"] == [
        {"axis": "length", "current_mm": 210.0, "required_mm": 220.0, "shortage_mm": 10.0, "basis": "internal"}
    ]
    assert "The box needs 10 mm more internal length to meet your required clearance." in fit["summary"]
    assert "The product fits, but without the clearance you specified." in fit["summary"]
    assert "218" not in fit["summary"]
    advisor = body["evaluation"]["advisor"]
    assert advisor["recommendation"] == "Correct Insufficient Space"
    assert advisor["headline"] == "Your Current Box Is Too Small"
    assert "larger" in advisor["size_line"].lower()


def test_box_205_outer_with_4mm_wall_cannot_physically_hold_the_product():
    payload = _device()
    payload["current_packaging"]["dimensions_mm"] = {"length": 205, "width": 155, "height": 75}
    payload["current_packaging"]["dimension_type"] = "external"
    payload["current_packaging"]["board_thickness_mm"] = 4
    body = run_optimise(payload)
    fit = body["evaluation"]["dimensional"]
    assert fit["fit"] == "undersized"
    assert fit["current_internal_mm"] == {"length": 197.0, "width": 147.0, "height": 67.0}
    assert "The product cannot physically fit: the inside length is 197 mm and the product is 200 mm" in fit["summary"]
    assert "13 mm more internal length" in fit["summary"]
    advisor = body["evaluation"]["advisor"]
    assert advisor["headline"] == "Your Current Box Is Too Small"
    assert advisor["next"].startswith("Your box needs more space to meet the specified clearance.")


def test_box_205_inside_size_fits_but_lacks_clearance():
    payload = _device()
    payload["current_packaging"]["dimensions_mm"] = {"length": 205, "width": 155, "height": 75}
    fit = run_optimise(payload)["evaluation"]["dimensional"]
    assert fit["fit"] == "undersized"
    assert fit["summary"].startswith("The product fits, but without the clearance you specified.")
    assert "5 mm more internal length, 5 mm more internal width, 5 mm more internal height" in fit["summary"]


def test_oversized_outer_carton_reports_a_real_volume_reduction():
    payload = _device()
    payload["current_packaging"]["dimensions_mm"] = {"length": 280, "width": 220, "height": 120}
    payload["current_packaging"]["dimension_type"] = "external"
    payload["current_packaging"]["board_thickness_mm"] = 4
    body = run_optimise(payload)
    advisor = body["evaluation"]["advisor"]
    assert body["evaluation"]["dimensional"]["fit"] == "oversized"
    assert advisor["recommendation"] == "Resize Packaging"
    assert advisor["headline"] == "Your Current Box Is Larger Than Required"
    assert advisor["size_line"] == "56.4% less packaging volume."
    assert "compare costs before recommending a change" in advisor["next"]
    assert advisor["outer_volume_reduction_percent"] is not None
    assert advisor["outer_volume_reduction_percent"] > 0


def test_missing_thickness_does_not_invent_an_internal_size():
    payload = _device()
    payload["current_packaging"]["dimensions_mm"] = {"length": 218, "width": 168, "height": 88}
    payload["current_packaging"]["dimension_type"] = "external"
    body = run_optimise(payload)
    fit = body["evaluation"]["dimensional"]
    assert fit["fit"] == "unknown"
    assert fit["current_internal_mm"] is None
    advisor = body["evaluation"]["advisor"]
    assert advisor["recommendation"] == "More Information Needed"
    assert advisor["headline"] == "Current Box Size Cannot Be Verified"
    assert "One More" not in advisor["headline"]
    assert body["comparison"]["existing_unit_cost_inr"] == 12
    assert body["comparison"]["proposed_unit_cost_inr"] == 29.39


def test_undersized_carton_is_a_correction():
    payload = _device()
    payload["current_packaging"]["dimensions_mm"] = {"length": 195, "width": 145, "height": 65}
    fit = run_optimise(payload)["evaluation"]["dimensional"]
    assert fit["fit"] == "undersized"
    assert fit["required_internal_mm"] == {"length": 210.0, "width": 160.0, "height": 80.0}
    assert "not a reduction in material" in fit["summary"]


def test_material_profiles_keep_a_suitable_cavity_and_do_not_claim_strength():
    body = run_optimise(_device())
    boards = {
        item["board_id"]
        for item in body["candidates"]
        if item["geometry_id"] == "packshift_simplified" and item["orientation"] == "declared"
    }
    assert {"e_flute", "b_flute", "c_flute"} <= boards
    assert body["evaluation"]["material"]["strength_evidence"] is False
    assert all(item["mass_g"] is None for item in body["candidates"])
    assert all(item["protection"]["safe_to_ship"] is False for item in body["candidates"])


def test_manufacturing_yield_does_not_change_the_carton_size():
    payload = _device()
    payload["manufacturing"] = {"nesting_yield": 0.8, "supplier_unit_quote_inr": 20}
    body = run_optimise(payload)
    report = body["evaluation"]["manufacturing"]
    area = body["current_generated"]["blank"]["area_m2"]
    assert body["current_generated"]["internal_dimensions_mm"] == {"length": 210.0, "width": 160.0, "height": 80.0}
    assert report["finished_dimensions_change"] is False
    assert report["purchased_sheet_m2"] == round(area / 0.8, 6) or abs(report["purchased_sheet_m2"] - area / 0.8) < 1e-9
    assert abs(report["scrap_m2"] - (report["purchased_sheet_m2"] - area)) < 1e-9
    assert report["supplier_unit_quote_inr"] == 20
    assert body["decision"]["safe_to_ship"] is False


def test_scene_scale_keeps_five_millimetres_of_clearance_without_shrinking():
    product = (200, 150, 70)
    internal = (210, 160, 80)
    external = (218, 168, 88)
    clearance = tuple((cavity - item) / 2 for item, cavity in zip(product, internal))
    assert clearance == (5, 5, 5)
    assert tuple(item / 100 for item in product) == (2, 1.5, 0.7)
    assert all(outer > item for outer, item in zip(external, product))
    undersized = (195, 145, 65)
    assert any(item > cavity for item, cavity in zip(product, undersized))


def test_missing_sustainability_data_does_not_invent_carbon():
    body = run_optimise(_device())
    impact = body["evaluation"]["sustainability"]
    assert impact["message"] == UNAVAILABLE
    assert impact["proposed_mass_g"] is None
    assert impact["carbon_kg"] is None
    assert "SUSTAINABILITY_OPPORTUNITY" not in body["evaluation"]["codes"]

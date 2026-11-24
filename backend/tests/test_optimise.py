"""Cookie-container optimisation checks and input guards."""

from __future__ import annotations

from services.optimise_cost import UNAVAILABLE, quote_carton
from services.optimise_engine import run_optimise


def cookie_request(**overrides):
    payload = {
        "product": {
            "name": "Cookie Container",
            "category": "Food",
            "dimensions_mm": {"length": 200, "width": 150, "height": 70},
            "weight_g": 500,
            "fragility": "medium",
            "clearance_mm": {"length": 5, "width": 5, "height": 5},
            "orientation_constraint": "declared_only",
        },
        "current_packaging": {
            "dimensions_mm": {"length": 200, "width": 150, "height": 70},
            "dimension_type": "external",
            "material_name": "PET plastic container",
            "cost_per_unit_inr": 12,
            "role": "primary",
        },
        "quantity": 10000,
        "preference": "balanced",
    }
    payload.update(overrides)
    return payload


def test_cookie_simplified_geometry_and_cost():
    body = run_optimise(cookie_request())
    carton = body["current_generated"]
    assert carton["internal_dimensions_mm"] == {"length": 210.0, "width": 160.0, "height": 80.0}
    assert carton["outer_dimensions_mm"] == {"length": 218.0, "width": 168.0, "height": 88.0}
    assert carton["blank"]["length_mm"] == 775.0
    assert carton["blank"]["width_mm"] == 240.0
    assert carton["blank"]["area_m2"] == 0.186
    assert carton["volumes"]["internal_litres"] == 2.688
    assert carton["volumes"]["outer_litres_display"] == 3.223
    assert carton["volumes"]["unused_internal_percent"] == 21.9
    assert carton["cost"]["unit_cost_inr"] == 29.39
    assert body["comparison"]["existing_order_cost_inr"] == 120000
    assert body["comparison"]["proposed_order_cost_inr"] == 293900
    assert body["comparison"]["order_cost_difference_inr"] == 173900
    assert body["comparison"]["direction"] == "increase"


def test_converter_blank_is_separate_from_the_studio_blank():
    body = run_optimise(cookie_request())
    converter = next(item for item in body["candidates"] if item["geometry_id"] == "demo_score_and_relief" and item["board_id"] == "c_flute" and item["orientation"] == "declared")
    assert (converter["blank"]["length_mm"], converter["blank"]["width_mm"]) != (775.0, 240.0)
    assert converter["blank"]["score_allowance_total_mm"] == 6.0
    assert converter["blank"]["flap_relief_mm"] == 3.0


def test_missing_protection_evidence_blocks_a_safe_to_ship_claim():
    body = run_optimise(cookie_request())
    assert body["evaluation"]["dimensional"]["fit"] == "undersized"
    assert body["decision"]["id"] == "dimensional_redesign"
    assert body["decision"]["safe_to_ship"] is False
    assert all(item["protection"]["safe_to_ship"] is False for item in body["candidates"])
    assert all(item["feasibility"] == "needs_validation" for item in body["candidates"])
    assert any("food-contact" in reason.lower() or "secondary packaging" in warning.lower() for item in body["candidates"] for reason in item["feasibility_reasons"] for warning in body["warnings"])


def test_missing_board_price_does_not_invent_a_cost():
    quote = quote_carton(
        area_m2=0.186,
        rate_inr_per_m2=None,
        conversion_inr=16,
        parameters={"waste_factor": 0, "printing_cost_inr": None},
        price_basis="demonstration_assumption",
    )
    assert quote["status"] == "unavailable"
    assert quote["message"] == UNAVAILABLE
    assert quote["unit_cost_inr"] is None


def test_api_rejects_non_positive_dimensions(client):
    payload = cookie_request()
    payload["product"]["dimensions_mm"]["height"] = 0
    response = client.post("/api/optimise", json=payload)
    assert response.status_code == 422
    assert response.json()["status"] == "error"


def test_pareto_keeps_a_nondominated_candidate_and_explains_the_rest():
    body = run_optimise(cookie_request())
    assert body["pareto_front_ids"]
    dominated = [item for item in body["candidates"] if item["dominated"]]
    assert dominated
    assert all(item["dominance_note"] for item in dominated)
    focus = next(item for item in body["candidates"] if item["id"] == body["preference_focus_id"])
    assert focus["on_pareto_front"] is True
    assert focus["feasibility"] == "needs_validation"

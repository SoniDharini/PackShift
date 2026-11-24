"""Cost follows rates and stays separate from carton volume."""

from __future__ import annotations

import copy

from schemas.request import RedesignRequest
from services.catalog import load_materials, load_rules
from services.cost_engine import quote_blank
from services.optimisation_engine import run_redesign
from tests.conftest import laptop_request


def test_known_blank_price_is_board_area_times_rate_plus_conversion():
    quote = quote_blank(
        blank_length_mm=1375,
        blank_width_mm=365,
        rate_inr_per_m2=72,
        conversion_inr=16,
        insert_inr=0,
        waste_factor=0,
    )
    assert quote.status == "illustrative_estimate"
    assert quote.unit_cost_inr == 52.14
    assert quote.board_cost_inr == 36.14


def test_missing_board_rate_does_not_invent_a_cost():
    quote = quote_blank(
        blank_length_mm=1375,
        blank_width_mm=365,
        rate_inr_per_m2=None,
        conversion_inr=16,
        insert_inr=0,
        waste_factor=0,
    )
    assert quote.status == "unavailable"
    assert quote.unit_cost_inr is None
    assert "board price per m²" in quote.missing_rates


def test_missing_catalogue_rate_keeps_dimensions_and_omits_the_cost(client):
    materials = copy.deepcopy(load_materials())
    for configuration in materials["configurations"]:
        configuration["include_in_recommendations"] = configuration["id"] == "corrugated_rate_unknown"
    result = run_redesign(RedesignRequest.model_validate(laptop_request()), materials, load_rules())
    recommendation = result["recommendations"][0]
    assert recommendation["internal_dimensions_mm"] == {"length": 385.0, "width": 285.0, "height": 80.0}
    assert recommendation["cost"]["status"] == "unavailable"
    assert recommendation["cost"]["unit_cost_inr"] is None
    assert result["comparison"]["volume_reduction_percent"] == 70.74
    assert client.get("/health").status_code == 200


def test_a_rate_change_recalculates_cost_without_changing_size():
    request = RedesignRequest.model_validate(laptop_request())
    rules = load_rules()
    first = run_redesign(request, load_materials(), rules)
    materials = copy.deepcopy(load_materials())
    for board in materials["boards"]:
        if board["id"] == "corrugated_standard":
            board["price_inr_per_m2"] = 90
    second = run_redesign(request, materials, rules)
    assert first["recommended_packaging"]["internal_dimensions_mm"] == second["recommended_packaging"]["internal_dimensions_mm"]
    assert first["recommended_packaging"]["external_dimensions_mm"] == second["recommended_packaging"]["external_dimensions_mm"]
    assert first["recommended_packaging"]["unit_cost_inr"] != second["recommended_packaging"]["unit_cost_inr"]
    assert second["recommended_packaging"]["unit_cost_inr"] == 61.17

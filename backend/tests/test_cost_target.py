"""Target-cost checks against the price the user pays today."""

from services.cost_target import cost_reason, cost_target_report, option_against_target
from services.optimise_cost import quote_carton
from services.optimise_engine import run_optimise
from tests.test_pack_fit import _device

NO_EXTRAS = {"waste_factor": 0, "printing_cost_inr": None}


def _suitable():
    payload = _device()
    payload["current_packaging"]["dimensions_mm"] = {"length": 218, "width": 168, "height": 88}
    payload["current_packaging"]["dimension_type"] = "external"
    payload["current_packaging"]["board_thickness_mm"] = 4
    return payload


def test_expensive_proposal_explains_material_and_manufacturing():
    report = run_optimise(_suitable())["evaluation"]["cost_target"]
    assert report["target_unit_cost_inr"] == 12
    assert report["target_source"] == "existing_cost"
    assert report["proposal"]["unit_cost_inr"] == 29.39
    assert report["proposal"]["board_cost_inr"] == 13.39
    assert report["proposal"]["conversion_cost_inr"] == 16
    assert report["proposal"]["difference_per_unit_inr"] == 17.39
    assert report["proposal"]["order_difference_inr"] == 173900
    assert report["reason"] == "Your proposed packaging costs more because of board material and manufacturing charges."


def test_manufacturing_alone_cannot_reach_target_when_board_exceeds_it():
    report = run_optimise(_suitable())["evaluation"]["cost_target"]
    assert report["proposal"]["max_conversion_for_target_inr"] == -1.39
    assert report["proposal"]["manufacturing_alone_can_reach_target"] is False
    assert "reducing manufacturing cost alone cannot reach the target" in report["manufacturing_summary"]


def test_no_catalogue_board_beats_twelve_rupees_so_keep_existing():
    body = run_optimise(_suitable())
    report = body["evaluation"]["cost_target"]
    assert report["cheapest_below_target"] is None
    assert all(item["protection_validated"] is False for item in report["options"])
    assert report["summary"].startswith("No lower-cost replacement has been established.")
    assert body["evaluation"]["advisor"]["recommendation_title"] == "Keep Existing Packaging"


def test_hypothetical_low_cost_supplier_is_a_demonstration_saving():
    quote = quote_carton(area_m2=0.186, rate_inr_per_m2=45, conversion_inr=3.5, parameters=NO_EXTRAS, price_basis="supplier_quote")
    assert quote["board_cost_inr"] == 8.37
    assert quote["unit_cost_inr"] == 11.87
    option = option_against_target(
        name="Hypothetical supplier board",
        board_cost=quote["board_cost_inr"],
        conversion_cost=quote["conversion_cost_inr"],
        other_cost=0,
        unit_cost=quote["unit_cost_inr"],
        target=12,
        quantity=10000,
    )
    assert option["difference_per_unit_inr"] == -0.13
    assert option["order_difference_inr"] == -1300
    assert option["below_target"] is True
    assert option["recommendation"] == "Lower cost on these prices. Test protection before switching."


def test_cheaper_option_is_reported_but_needs_protection_testing():
    candidate = {
        "board_name": "Hypothetical supplier board",
        "feasibility": "needs_validation",
        "protection": {"strength_evidence": False},
        "cost": {"board_cost_inr": 8.37, "conversion_cost_inr": 3.5, "unit_cost_inr": 11.87},
    }
    proposed = {"cost": {"board_cost_inr": 13.39, "conversion_cost_inr": 16, "unit_cost_inr": 29.39}}
    report = cost_target_report(candidates=[candidate], proposed=proposed, existing_unit=12, quantity=10000, category="Food", fragility="medium")
    assert report["cheapest_below_target"]["name"] == "Hypothetical supplier board"
    assert report["summary"].startswith("A lower-cost material option is available.")


def test_dominant_cost_component_is_named():
    assert "board material" in cost_reason(20, 4)
    assert "manufacturing charge" in cost_reason(2, 16)


def test_unsupported_structures_are_listed_without_invented_numbers():
    payload = _suitable()
    payload["product"]["category"] = "Food"
    report = run_optimise(payload)["evaluation"]["cost_target"]
    ids = {item["id"]: item for item in report["further_options"]}
    assert ids["folding_carton"]["status"] == "needs_design_support"
    assert "FEFCO 0201 formulas are not used" in ids["folding_carton"]["summary"]
    assert "food_pouch" in ids
    assert all("₹" not in item["summary"] for item in report["further_options"])

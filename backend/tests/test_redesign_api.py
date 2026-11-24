"""End-to-end redesign API."""

from __future__ import annotations

from tests.conftest import laptop_request


def test_health_and_material_catalogue(client):
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    materials = client.get("/api/materials")
    assert materials.status_code == 200
    body = materials.json()
    ids = {item["id"] for item in body["configurations"]}
    assert {"corrugated_standard", "corrugated_recycled", "corrugated_foam", "corrugated_molded_fiber", "corrugated_paper_cushion"} <= ids
    assert "carbon" not in materials.text.lower()


def test_laptop_redesign_is_reproducible_and_ranked(client):
    first = client.post("/api/redesign", json=laptop_request())
    second = client.post("/api/redesign", json=laptop_request())
    assert first.status_code == 200
    assert first.json() == second.json()
    body = first.json()
    assert body["status"] == "success"
    assert body["product_name"] == "14-inch Laptop"
    assert body["comparison"]["volume_reduction_percent"] == 70.74
    assert body["comparison"]["blank_area_change_percent"] != body["comparison"]["volume_reduction_percent"]
    roles = [item["role"] for item in body["recommendations"]]
    assert roles[:3] == ["minimum_board", "lowest_cost", "alternative_material"]
    assert len({item["configuration_id"] for item in body["recommendations"]}) == 3
    costs = [item["cost"]["unit_cost_inr"] for item in body["recommendations"] if item["cost"]["unit_cost_inr"] is not None]
    assert min(costs) == next(item["cost"]["unit_cost_inr"] for item in body["recommendations"] if item["role"] == "lowest_cost")


def test_every_recommendation_meets_clearance_orientation_and_fit(client):
    body = client.post("/api/redesign", json=laptop_request()).json()
    product = body["product"]["dimensions_mm"]
    for item in body["recommendations"]:
        dims = item["internal_dimensions_mm"]
        clearance = item["protection_clearance_mm"]
        assert item["feasible"] is True
        assert item["height_axis"] == "height"
        assert dims["length"] + 1e-6 >= product["length"] + 2 * clearance["length"]
        assert dims["width"] + 1e-6 >= product["width"] + 2 * clearance["width"]
        assert dims["height"] + 1e-6 >= product["height"] + 2 * clearance["height"]
        assert item["packaging_style"] == "fefco_0201"
        assert item["geometry"]["panels"]
        assert item["geometry"]["cut_lines"]
    selected = [item for item in body["evaluated_orientations"] if item["selected"]]
    assert selected[0]["package_axes"]["height"] == "height"
    assert any(item["permitted"] is False for item in body["evaluated_orientations"])


def test_no_feasible_configuration_is_explained(client):
    payload = laptop_request()
    payload["product"]["weight_kg"] = 40
    response = client.post("/api/redesign", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "no_feasible_configuration"
    assert body["recommendations"] == []
    assert body["recommended_packaging"] is None
    assert body["rejected_configurations"]
    assert "weight" in body["rejected_configurations"][0]["reason"]

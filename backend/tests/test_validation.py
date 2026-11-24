"""Input and fit validation."""

from __future__ import annotations

from tests.conftest import laptop_request


def test_rejects_negative_and_zero_dimensions(client):
    negative = laptop_request()
    negative["product"]["dimensions_mm"]["length"] = -325
    response = client.post("/api/redesign", json=negative)
    assert response.status_code == 422
    assert response.json()["status"] == "error"

    zero = laptop_request()
    zero["product"]["dimensions_mm"]["height"] = 0
    zero_response = client.post("/api/redesign", json=zero)
    assert zero_response.status_code == 422


def test_rejects_unsupported_shape_and_unknown_material(client):
    shaped = laptop_request()
    shaped["product"]["shape"] = "cylinder"
    shape_response = client.post("/api/redesign", json=shaped)
    assert shape_response.status_code == 422
    assert "rectangular" in shape_response.json()["errors"][0]["message"].lower()

    unknown = laptop_request()
    unknown["current_packaging"]["material_id"] = "not-a-board"
    material_response = client.post("/api/redesign", json=unknown)
    assert material_response.status_code == 422
    assert material_response.json()["errors"][0]["field"] == "current_packaging.material_id"


def test_rejects_a_product_that_cannot_fit_the_current_package(client):
    payload = laptop_request()
    payload["product"]["dimensions_mm"]["length"] = 600
    response = client.post("/api/redesign", json=payload)
    assert response.status_code == 422
    body = response.json()
    assert "cannot fit" in body["errors"][0]["message"]


def test_rejects_user_supplied_new_packaging_dimensions(client):
    payload = laptop_request()
    payload["recommended_dimensions_mm"] = {"length": 300, "width": 200, "height": 40}
    response = client.post("/api/redesign", json=payload)
    assert response.status_code == 422


def test_external_dimensions_require_a_thickness_policy(client):
    from services.catalog import load_materials, load_rules
    from services.validation_service import PackagingValidationError, resolve_current_internal
    from schemas.request import RedesignRequest

    payload = laptop_request()
    payload["current_packaging"]["dimension_type"] = "external"
    payload["current_packaging"]["dimensions_mm"] = {"length": 508, "width": 408, "height": 158}
    payload["current_packaging"]["board_thickness_mm"] = 4
    response = client.post("/api/redesign", json=payload)
    assert response.status_code == 200
    internal = response.json()["current_packaging"]["internal_dimensions_mm"]
    assert internal == {"length": 500.0, "width": 400.0, "height": 150.0}

    materials = load_materials()
    broken = {
        "boards": [{**materials["boards"][0], "thickness_mm": None}],
        "cushioning": materials["cushioning"],
        "configurations": materials["configurations"],
    }
    request = RedesignRequest.model_validate(
        {
            **laptop_request(),
            "current_packaging": {
                **laptop_request()["current_packaging"],
                "dimension_type": "external",
                "board_thickness_mm": None,
            },
        }
    )
    _internal, _external, _thickness, _source, errors = resolve_current_internal(request, broken, load_rules())
    assert errors
    assert isinstance(PackagingValidationError, type)

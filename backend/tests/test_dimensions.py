"""Automatic internal dimensions and orientation limits."""

from __future__ import annotations

from services.dimension_engine import Clearance, size_package
from services.orientation_engine import evaluate_orientations, selected_orientation
from services.validation_service import Axis
from tests.conftest import laptop_request


def _size(length: float, width: float, height: float, clearance: float, increment: float = 5):
    orientation = selected_orientation("flat_only")
    product = Axis(length, width, height)
    gap = Clearance(clearance, clearance, clearance, "test", "test")
    return size_package(orientation.placed_product(product), orientation, gap, increment)


def test_laptop_clearance_and_rounding():
    sized = _size(325, 225, 20, 30)
    assert (sized.internal.length, sized.internal.width, sized.internal.height) == (385, 285, 80)
    assert sized.internal.length >= 325 + 60
    assert sized.internal.width >= 225 + 60
    assert sized.internal.height >= 20 + 60


def test_length_change_changes_the_recommendation():
    original = _size(325, 225, 20, 30)
    longer = _size(330, 225, 20, 30)
    assert longer.internal.length == 390
    assert longer.internal.length != original.internal.length
    assert longer.internal.width == original.internal.width


def test_clearance_change_changes_every_axis():
    low = _size(325, 225, 20, 5)
    assert (low.internal.length, low.internal.width, low.internal.height) == (335, 235, 30)


def test_rounding_never_drops_below_the_clearance_minimum():
    sized = _size(326, 225, 20, 30)
    assert sized.minimum_internal.length == 386
    assert sized.internal.length == 390
    assert sized.internal.length >= sized.minimum_internal.length


def test_flat_only_does_not_select_a_sideways_pose():
    orientations = evaluate_orientations("flat_only")
    selected = [item for item in orientations if item.selected]
    assert len(selected) == 1
    assert selected[0].id == "declared"
    assert selected[0].mapping[2] == "height"
    sideways = [item for item in orientations if item.mapping[2] != "height"]
    assert sideways
    assert all(item.permitted is False for item in sideways)


def test_api_uses_fragility_clearance_instead_of_a_user_supplied_carton(client):
    response = client.post("/api/redesign", json=laptop_request())
    assert response.status_code == 200
    body = response.json()
    internal = body["recommended_packaging"]["internal_dimensions_mm"]
    assert internal == {"length": 385.0, "width": 285.0, "height": 80.0}
    assert body["recommended_packaging"]["selected_orientation"] == "flat"
    assert body["current_packaging"]["volume_litres"] == 30.0
    assert body["recommended_packaging"]["volume_litres"] == 8.778
    assert body["comparison"]["volume_reduction_percent"] == 70.74

    medium = laptop_request()
    medium["product"]["fragility"] = "medium"
    medium_body = client.post("/api/redesign", json=medium).json()
    assert medium_body["recommended_packaging"]["internal_dimensions_mm"] == {
        "length": 355.0,
        "width": 255.0,
        "height": 50.0,
    }

    longer = laptop_request()
    longer["product"]["dimensions_mm"]["length"] = 330
    longer_body = client.post("/api/redesign", json=longer).json()
    assert longer_body["recommended_packaging"]["internal_dimensions_mm"]["length"] == 390.0

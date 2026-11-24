"""Blank geometry stays tied to the calculated carton."""

from __future__ import annotations

from services.geometry_engine import build_geometry
from services.units import square_metres
from services.validation_service import Axis
from tests.conftest import laptop_request


def test_blank_formula_external_size_and_area_units():
    geometry = build_geometry(Axis(385, 285, 80), thickness_mm=4, joint_mm=35)
    assert geometry["blank_length_mm"] == 1375
    assert geometry["blank_width_mm"] == 365
    assert geometry["blank_length_mm"] == 35 + 2 * (385 + 285)
    assert geometry["blank_width_mm"] == 80 + 285
    assert geometry["external_dimensions_mm"] == {"length": 393.0, "width": 293.0, "height": 88.0}
    assert geometry["three_js"]["internal_dimensions_mm"] == geometry["internal_dimensions_mm"]
    area = square_metres(geometry["blank_length_mm"], geometry["blank_width_mm"])
    assert float(area) == geometry["rectangular_blank_area_m2"]
    assert abs(float(area * 1_000_000) - (1375 * 365)) < 1e-6
    assert geometry["panels"]
    assert geometry["fold_lines"]
    assert geometry["cut_lines"][0]["points_mm"]
    assert geometry["dimension_annotations"]


def test_cut_outline_stays_inside_the_blank():
    geometry = build_geometry(Axis(385, 285, 80), thickness_mm=4, joint_mm=35)
    bounds = geometry["bounding_rectangle_mm"]
    for point in geometry["cut_lines"][0]["points_mm"]:
        assert 0 <= point["x"] <= bounds["width_mm"]
        assert 0 <= point["y"] <= bounds["height_mm"]


def test_api_geometry_matches_the_recommended_carton(client):
    body = client.post("/api/redesign", json=laptop_request()).json()
    geometry = body["geometry"]
    recommended = body["recommended_packaging"]
    assert geometry["internal_dimensions_mm"] == recommended["internal_dimensions_mm"]
    assert geometry["three_js"]["internal_dimensions_mm"] == recommended["internal_dimensions_mm"]
    assert geometry["external_dimensions_mm"] == recommended["external_dimensions_mm"]
    assert geometry["blank_length_mm"] == recommended["blank_length_mm"]
    assert geometry["rectangular_blank_area_m2"] == recommended["blank_area_m2"]
    for recommendation in body["recommendations"]:
        assert recommendation["geometry"]["internal_dimensions_mm"] == recommendation["internal_dimensions_mm"]
        assert recommendation["feasible"] is True

"""Shared fixtures for the redesign API tests."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def laptop_request() -> dict[str, object]:
    return {
        "product": {
            "name": "14-inch Laptop",
            "category": "electronics",
            "dimensions_mm": {"length": 325, "width": 225, "height": 20},
            "weight_kg": 1.5,
            "fragility": "high",
            "orientation_constraint": "flat_only",
            "quantity_per_package": 1,
        },
        "current_packaging": {
            "dimensions_mm": {"length": 500, "width": 400, "height": 150},
            "dimension_type": "internal",
            "material_id": "corrugated_standard",
            "cushioning_material_id": "foam_insert",
            "cost_per_unit_inr": 120,
        },
        "monthly_quantity": 500,
        "preferences": {"box_style": "fefco_0201", "dimension_increment_mm": 5},
    }

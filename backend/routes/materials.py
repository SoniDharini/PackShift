"""Packaging material catalogue route."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from services.catalog import load_materials

router = APIRouter(tags=["materials"])


@router.get("/api/materials")
def get_materials() -> dict[str, Any]:
    catalogue = load_materials()
    return {
        "status": "success",
        "price_notice": catalogue["price_notice"],
        "version": catalogue["version"],
        "boards": catalogue["boards"],
        "cushioning": catalogue["cushioning"],
        "configurations": catalogue["configurations"],
    }

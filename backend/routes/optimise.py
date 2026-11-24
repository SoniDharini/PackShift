"""Optimisation route."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from services.optimise_engine import run_optimise

router = APIRouter(tags=["optimise"])


class DimensionsMM(BaseModel):
    model_config = ConfigDict(extra="forbid")

    length: float
    width: float
    height: float


class ClearanceMM(BaseModel):
    model_config = ConfigDict(extra="forbid")

    length: float
    width: float
    height: float


class OptimiseProduct(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    category: str
    dimensions_mm: DimensionsMM
    weight_g: float
    fragility: Literal["low", "medium", "high"]
    clearance_mm: ClearanceMM
    orientation_constraint: Literal["declared_only", "any"] = "declared_only"


class ManufacturingContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nesting_yield: float | None = Field(default=None, gt=0, le=1)
    supplier_unit_quote_inr: float | None = Field(default=None, ge=0)


class OptimiseCurrent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dimensions_mm: DimensionsMM
    dimension_type: Literal["internal", "external", "unspecified"] = "external"
    board_thickness_mm: float | None = Field(default=None, gt=0, le=30)
    material_name: str
    cost_per_unit_inr: float | None = None
    role: str = "current"


class OptimiseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product: OptimiseProduct
    current_packaging: OptimiseCurrent
    quantity: int = Field(ge=1)
    preference: Literal["lowest_cost", "lowest_material", "balanced"] = "balanced"
    manufacturing: ManufacturingContext | None = None


@router.post("/api/optimise")
def optimise(body: OptimiseRequest) -> dict[str, Any]:
    return run_optimise(body.model_dump())

"""Response bodies for the redesign API."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class DimensionsMM(BaseModel):
    length: float
    width: float
    height: float


class ClearanceMM(BaseModel):
    length: float
    width: float
    height: float
    rule_id: str
    source: str


class Geometry(BaseModel):
    model_config = ConfigDict(extra="allow")

    panels: list[dict[str, Any]]
    fold_lines: list[dict[str, Any]]
    cut_lines: list[dict[str, Any]]
    dimension_annotations: list[dict[str, Any]]
    internal_dimensions_mm: DimensionsMM
    external_dimensions_mm: DimensionsMM
    blank_length_mm: float
    blank_width_mm: float
    rectangular_blank_area_m2: float
    three_js: dict[str, Any]


class CostBreakdown(BaseModel):
    model_config = ConfigDict(extra="allow")

    status: str
    currency: Literal["INR"]
    unit_cost_inr: float | None
    board_cost_inr: float | None = None
    insert_cost_inr: float | None = None
    conversion_cost_inr: float | None = None
    other_cost_inr: float | None = None
    monthly_cost_inr: float | None = None
    existing_unit_cost_inr: float | None = None
    difference_per_unit_inr: float | None = None
    change_percent: float | None = None
    monthly_difference_inr: float | None = None
    missing_rates: list[str] = Field(default_factory=list)
    price_basis: str
    waste_factor: float | None = None
    billed_board_area_m2: float | None = None


class Recommendation(BaseModel):
    role: str
    title: str
    rank: int
    feasible: bool
    configuration_id: str
    material_id: str
    material_name: str
    board_id: str
    cushioning_id: str
    category: str
    orientation_id: str
    selected_orientation: str
    height_axis: str
    internal_dimensions_mm: DimensionsMM
    external_dimensions_mm: DimensionsMM
    minimum_internal_dimensions_mm: DimensionsMM
    protection_clearance_mm: ClearanceMM
    packaging_style: Literal["fefco_0201"]
    volume_litres: float
    external_volume_litres: float
    blank_length_mm: float
    blank_width_mm: float
    blank_area_m2: float
    material_mass_g: float | None
    cost: CostBreakdown
    explanation: str
    assumptions: list[str]
    warnings: list[str]
    limitations: list[str]
    geometry: Geometry


class RecommendedPackaging(BaseModel):
    configuration_id: str
    material_id: str
    material_name: str
    internal_dimensions_mm: DimensionsMM
    external_dimensions_mm: DimensionsMM
    minimum_internal_dimensions_mm: DimensionsMM
    volume_litres: float
    external_volume_litres: float
    protection_clearance_mm: ClearanceMM
    packaging_style: Literal["fefco_0201"]
    selected_orientation: str
    orientation_id: str
    height_axis: str
    blank_area_m2: float
    blank_length_mm: float
    blank_width_mm: float
    material_mass_g: float | None
    unit_cost_inr: float | None
    cost_status: str


class CurrentPackagingSummary(BaseModel):
    model_config = ConfigDict(extra="allow")

    dimension_type_received: str
    internal_dimensions_mm: DimensionsMM
    external_dimensions_mm: DimensionsMM | None
    material_id: str
    cushioning_material_id: str | None
    volume_litres: float
    cost_per_unit_inr: float | None
    cost_status: str
    estimated_blank_area_m2: float


class Comparison(BaseModel):
    model_config = ConfigDict(extra="allow")

    volume_basis: Literal["internal"]
    current_volume_litres: float
    recommended_volume_litres: float | None
    volume_reduction_percent: float | None
    current_blank_area_m2: float
    recommended_blank_area_m2: float | None
    note: str


class CalculationAssumptions(BaseModel):
    model_config = ConfigDict(extra="allow")

    clearance_rule: str | None
    dimension_increment_mm: float
    protection_testing_required: bool
    notes: list[str]


class RedesignResponse(BaseModel):
    status: Literal["success", "no_feasible_configuration"]
    product_name: str
    product: dict[str, Any]
    current_packaging: CurrentPackagingSummary
    recommended_packaging: RecommendedPackaging | None
    comparison: Comparison
    recommendations: list[Recommendation]
    rejected_configurations: list[dict[str, str]]
    geometry: Geometry | None
    evaluated_orientations: list[dict[str, Any]]
    candidates_considered: int
    calculation_assumptions: CalculationAssumptions
    warnings: list[str]
    monthly_quantity: int

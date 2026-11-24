"""Request bodies for the redesign API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DimensionsMM(BaseModel):
    """All packaging and product dimensions are millimetres."""

    model_config = ConfigDict(extra="forbid")

    length: float = Field(gt=0, description="Length in millimetres.")
    width: float = Field(gt=0, description="Width in millimetres.")
    height: float = Field(gt=0, description="Height in millimetres.")


class ProductInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=160)
    category: str = Field(min_length=1, max_length=80)
    dimensions_mm: DimensionsMM
    weight_kg: float = Field(gt=0)
    fragility: Literal["low", "medium", "high"]
    shape: str = "rectangular"
    orientation_constraint: Literal["any", "flat_only", "upright_only"]
    quantity_per_package: int = Field(default=1, ge=1)

    @field_validator("name", "category")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field cannot be blank.")
        return cleaned

    @field_validator("shape")
    @classmethod
    def reject_non_rectangular(cls, value: str) -> str:
        if value != "rectangular":
            raise ValueError(
                "Only a rectangular product is supported. Other shapes are rejected instead of being approximated."
            )
        return value


class CurrentPackagingInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dimensions_mm: DimensionsMM
    dimension_type: Literal["internal", "external"]
    material_id: str = Field(min_length=1)
    cushioning_material_id: str | None = None
    cost_per_unit_inr: float | None = Field(default=None, ge=0)
    board_thickness_mm: float | None = Field(default=None, gt=0)
    weight_kg: float | None = Field(default=None, gt=0)
    material_rate_inr_per_m2: float | None = Field(default=None, ge=0)
    conversion_cost_inr: float | None = Field(default=None, ge=0)


class Preferences(BaseModel):
    model_config = ConfigDict(extra="forbid")

    box_style: Literal["fefco_0201"] = "fefco_0201"
    dimension_increment_mm: float = Field(default=5, gt=0)


class RedesignRequest(BaseModel):
    """Product and current packaging only. New carton dimensions are not accepted."""

    model_config = ConfigDict(extra="forbid")

    product: ProductInput
    current_packaging: CurrentPackagingInput
    monthly_quantity: int = Field(ge=1)
    preferences: Preferences = Field(default_factory=Preferences)

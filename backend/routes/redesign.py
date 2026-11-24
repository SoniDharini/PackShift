"""Redesign calculation route."""

from __future__ import annotations

from fastapi import APIRouter

from schemas.request import RedesignRequest
from schemas.response import RedesignResponse
from services.catalog import load_materials, load_rules
from services.optimisation_engine import run_redesign

router = APIRouter(tags=["redesign"])


@router.post("/api/redesign", response_model=RedesignResponse)
def redesign_package(body: RedesignRequest) -> RedesignResponse:
    result = run_redesign(body, load_materials(), load_rules())
    return RedesignResponse.model_validate(result)

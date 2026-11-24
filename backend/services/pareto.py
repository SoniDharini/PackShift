"""Pareto screen for minimisation objectives. Missing objectives are left out of the ranking."""

from __future__ import annotations

from decimal import Decimal
from typing import Any


def active_objectives(candidates: list[dict[str, Any]], keys: tuple[str, ...]) -> list[str]:
    """Keep an objective only when every ranked candidate has a value for it."""
    kept: list[str] = []
    for key in keys:
        if candidates and all(candidate["objectives"].get(key) is not None for candidate in candidates):
            kept.append(key)
    return kept


def dominates(left: dict[str, Any], right: dict[str, Any], keys: list[str]) -> bool:
    """True when left is no worse on every objective and strictly better on one."""
    improved = False
    for key in keys:
        left_value = Decimal(str(left["objectives"][key]))
        right_value = Decimal(str(right["objectives"][key]))
        if left_value > right_value:
            return False
        if left_value < right_value:
            improved = True
    return improved


def pareto_ids(candidates: list[dict[str, Any]], keys: list[str]) -> list[str]:
    front: list[str] = []
    for candidate in candidates:
        beaten = False
        for other in candidates:
            if other["id"] == candidate["id"]:
                continue
            if dominates(other, candidate, keys):
                beaten = True
                break
        if not beaten:
            front.append(str(candidate["id"]))
    return front

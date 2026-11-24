"""Load the version-controlled JSON catalogues."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def _read_json(name: str) -> dict[str, Any]:
    path = DATA_DIR / name
    with path.open(encoding="utf-8") as handle:
        loaded = json.load(handle)
    if not isinstance(loaded, dict):
        raise RuntimeError(f"{name} must contain a JSON object.")
    return loaded


@lru_cache(maxsize=1)
def load_materials() -> dict[str, Any]:
    return _read_json("materials.json")


@lru_cache(maxsize=1)
def load_rules() -> dict[str, Any]:
    return _read_json("packaging_rules.json")


@lru_cache(maxsize=1)
def load_board_profiles() -> dict[str, Any]:
    return _read_json("board_profiles.json")


@lru_cache(maxsize=1)
def load_geometry_profiles() -> dict[str, Any]:
    return _read_json("geometry_profiles.json")


def clear_catalog_cache() -> None:
    load_materials.cache_clear()
    load_rules.cache_clear()
    load_board_profiles.cache_clear()
    load_geometry_profiles.cache_clear()

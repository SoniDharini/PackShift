"""Conceptual FEFCO 0201 blank geometry from one set of internal dimensions."""

from __future__ import annotations

from typing import Any

from services.units import millimetres, square_metres
from services.validation_service import Axis


def _round1(value: float) -> float:
    return millimetres(round(value, 1))


def slot_width(thickness_mm: float, length_mm: float, width_mm: float) -> float:
    raw = min(max(8.0, thickness_mm * 2), min(length_mm, width_mm) / 3)
    return _round1(raw)


def slot_depth(height_mm: float) -> float:
    raw = min(12.0, height_mm / 5)
    capped = min(raw, max(height_mm / 2 - 0.2, 0.2))
    return _round1(capped)


def _outline(
    panels: list[tuple[float, float]],
    flap: float,
    height: float,
    slot: float,
    slot_depth_mm: float,
) -> list[dict[str, float]]:
    half_slot = slot / 2
    first_x = panels[0][0]
    total_w = panels[-1][0] + panels[-1][1]
    y_top = 0.0
    y_fold_top = flap
    y_slot_top = flap + slot_depth_mm
    y_fold_bot = flap + height
    y_slot_bot = flap + height - slot_depth_mm
    y_bot = flap * 2 + height
    points: list[tuple[float, float]] = [(first_x + half_slot, y_top)]

    for index, (x_pos, width) in enumerate(panels):
        left = x_pos + half_slot
        right = x_pos + width - half_slot
        if index > 0:
            points.append((left, y_fold_top))
            points.append((left, y_top))
        points.append((right, y_top))
        points.append((right, y_fold_top))
        if index < len(panels) - 1:
            next_x = panels[index + 1][0]
            points.append((right, y_slot_top))
            points.append((next_x + half_slot, y_slot_top))

    points.append((total_w, y_fold_top))
    points.append((total_w, y_fold_bot))

    for index in range(len(panels) - 1, -1, -1):
        x_pos, width = panels[index]
        left = x_pos + half_slot
        right = x_pos + width - half_slot
        points.append((right, y_fold_bot))
        points.append((right, y_bot))
        points.append((left, y_bot))
        points.append((left, y_fold_bot))
        if index > 0:
            previous_x, previous_w = panels[index - 1]
            points.append((left, y_slot_bot))
            points.append((previous_x + previous_w - half_slot, y_slot_bot))

    inset = min(14.0, height / 4)
    points.append((first_x, y_fold_bot))
    points.append((0.0, y_fold_bot - inset))
    points.append((0.0, y_fold_top + inset))
    points.append((first_x, y_fold_top))
    points.append((first_x + half_slot, y_fold_top))
    points.append((first_x + half_slot, y_top))
    return [{"x": millimetres(x_pos), "y": millimetres(y_pos)} for x_pos, y_pos in points]


def _segment(line_id: str, x1: float, y1: float, x2: float, y2: float) -> dict[str, float | str]:
    return {
        "id": line_id,
        "kind": "fold",
        "x1_mm": millimetres(x1),
        "y1_mm": millimetres(y1),
        "x2_mm": millimetres(x2),
        "y2_mm": millimetres(y2),
    }


def _annotation(
    annotation_id: str,
    label: str,
    value: float,
    orientation: str,
    x1: float,
    y1: float,
    x2: float,
    y2: float,
) -> dict[str, float | str]:
    return {
        "id": annotation_id,
        "label": label,
        "value_mm": millimetres(value),
        "orientation": orientation,
        "x1_mm": millimetres(x1),
        "y1_mm": millimetres(y1),
        "x2_mm": millimetres(x2),
        "y2_mm": millimetres(y2),
    }


def build_geometry(internal: Axis, thickness_mm: float, joint_mm: float) -> dict[str, Any]:
    """Build one conceptual RSC blank. Slots are inside the rectangle and do not add area."""
    length = internal.length
    width = internal.width
    height = internal.height
    flap = width / 2
    blank_length = joint_mm + 2 * length + 2 * width
    blank_width = height + width
    slot = slot_width(thickness_mm, length, width)
    depth = slot_depth(height)
    external = Axis(
        millimetres(length + 2 * thickness_mm),
        millimetres(width + 2 * thickness_mm),
        millimetres(height + 2 * thickness_mm),
    )

    wall_spans = [
        ("wall_length_1", joint_mm, length),
        ("wall_width_1", joint_mm + length, width),
        ("wall_length_2", joint_mm + length + width, length),
        ("wall_width_2", joint_mm + 2 * length + width, width),
    ]
    panels: list[dict[str, float | str]] = [
        {
            "id": "manufacturers_joint",
            "kind": "joint",
            "x_mm": 0.0,
            "y_mm": millimetres(flap),
            "width_mm": millimetres(joint_mm),
            "height_mm": millimetres(height),
        }
    ]
    for panel_id, x_pos, panel_width in wall_spans:
        panels.append(
            {
                "id": panel_id,
                "kind": "wall",
                "x_mm": millimetres(x_pos),
                "y_mm": millimetres(flap),
                "width_mm": millimetres(panel_width),
                "height_mm": millimetres(height),
            }
        )
        panels.append(
            {
                "id": panel_id.replace("wall", "flap_top"),
                "kind": "flap",
                "x_mm": millimetres(x_pos),
                "y_mm": 0.0,
                "width_mm": millimetres(panel_width),
                "height_mm": millimetres(flap),
            }
        )
        panels.append(
            {
                "id": panel_id.replace("wall", "flap_bottom"),
                "kind": "flap",
                "x_mm": millimetres(x_pos),
                "y_mm": millimetres(flap + height),
                "width_mm": millimetres(panel_width),
                "height_mm": millimetres(flap),
            }
        )

    outline_panels = [(x_pos, panel_width) for _, x_pos, panel_width in wall_spans]
    cut_points = _outline(outline_panels, flap, height, slot, depth)
    fold_lines: list[dict[str, float | str]] = [
        _segment("score_joint", joint_mm, flap, joint_mm, flap + height),
    ]
    half_slot = slot / 2
    for index, (_, x_pos, panel_width) in enumerate(wall_spans):
        if index > 0:
            fold_lines.append(
                _segment(
                    f"score_vertical_{index}",
                    x_pos,
                    flap + depth,
                    x_pos,
                    flap + height - depth,
                )
            )
        fold_lines.append(
            _segment(
                f"score_top_{index}",
                x_pos + half_slot,
                flap,
                x_pos + panel_width - half_slot,
                flap,
            )
        )
        fold_lines.append(
            _segment(
                f"score_bottom_{index}",
                x_pos + half_slot,
                flap + height,
                x_pos + panel_width - half_slot,
                flap + height,
            )
        )

    annotations = [
        _annotation("blank_length", "Blank length", blank_length, "horizontal", 0, -18, blank_length, -18),
        _annotation("blank_width", "Blank width", blank_width, "vertical", blank_length + 18, 0, blank_length + 18, blank_width),
        _annotation("panel_length", "Length panel", length, "horizontal", joint_mm, flap + height / 2, joint_mm + length, flap + height / 2),
        _annotation("panel_width", "Width panel", width, "horizontal", joint_mm + length, flap + height / 2, joint_mm + length + width, flap + height / 2),
        _annotation("body_height", "Height", height, "vertical", joint_mm + length / 2, flap, joint_mm + length / 2, flap + height),
        _annotation("flap_depth", "Flap", flap, "vertical", joint_mm + length / 2, 0, joint_mm + length / 2, flap),
        _annotation("joint", "Joint allowance", joint_mm, "horizontal", 0, flap + height / 2, joint_mm, flap + height / 2),
    ]
    slot_count = 3 * 2
    slot_area_m2 = (slot_count * slot * depth) / 1_000_000

    return {
        "standard": "FEFCO 0201 conceptual regular slotted carton",
        "certification": "conceptual_engineering_geometry",
        "internal_dimensions_mm": internal.as_dict(),
        "external_dimensions_mm": external.as_dict(),
        "board_thickness_mm": millimetres(thickness_mm),
        "joint_allowance_mm": millimetres(joint_mm),
        "flap_depth_mm": millimetres(flap),
        "slot_width_mm": slot,
        "slot_depth_mm": depth,
        "blank_length_mm": millimetres(blank_length),
        "blank_width_mm": millimetres(blank_width),
        "rectangular_blank_area_m2": float(square_metres(millimetres(blank_length), millimetres(blank_width))),
        "approximate_slot_cutout_area_m2": round(slot_area_m2, 6),
        "bounding_rectangle_mm": {
            "x_mm": 0.0,
            "y_mm": 0.0,
            "width_mm": millimetres(blank_length),
            "height_mm": millimetres(blank_width),
        },
        "panels": panels,
        "fold_lines": fold_lines,
        "cut_lines": [{"id": "blank_outline", "closed": True, "points_mm": cut_points}],
        "dimension_annotations": annotations,
        "three_js": {
            "units": "mm",
            "internal_dimensions_mm": internal.as_dict(),
            "external_dimensions_mm": external.as_dict(),
            "board_thickness_mm": millimetres(thickness_mm),
        },
        "coordinate_system": "Millimetres. Origin is the top-left of the unfolded blank. X runs along the blank length and Y increases downward, which matches an SVG viewBox.",
        "notes": [
            "Blank length = 2 × (internal length + internal width) + joint allowance.",
            "Blank width = internal height + internal width, because each flap is half the width panel.",
            "External size adds one board thickness on every face.",
            "Panel rectangles are nominal. The cut outline includes slot notches and a tapered joint.",
            "This is conceptual geometry for preview, not a manufacturing-certified CAD file.",
        ],
    }


def blank_area_m2(internal: Axis, joint_mm: float) -> tuple[float, float, float]:
    blank_length = joint_mm + 2 * internal.length + 2 * internal.width
    blank_width = internal.height + internal.width
    length_mm = millimetres(blank_length)
    width_mm = millimetres(blank_width)
    return length_mm, width_mm, float(square_metres(length_mm, width_mm))

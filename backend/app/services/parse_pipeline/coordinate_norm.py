"""
Coordinate normalization: convert pixel coordinates to real-world meters.
This is the foundational calibration step — everything in the 3D scene depends on it.
"""
import math


def normalize_point(px: float, py: float, scale_m_per_px: float, origin_px: tuple[float, float]) -> dict:
    """Convert pixel coords to meter coords."""
    return {
        "x": (px - origin_px[0]) * scale_m_per_px,
        "y": (py - origin_px[1]) * scale_m_per_px,
    }


def normalize_polygon(polygon: list[dict], scale_m_per_px: float, origin_px: tuple[float, float]) -> list[dict]:
    return [normalize_point(p["x"], p["y"], scale_m_per_px, origin_px) for p in polygon]


def estimate_scale_from_claude(claude_scale_data: dict, image_width_px: int, image_height_px: int) -> float:
    """
    Extract meters-per-pixel from Claude's scale assessment.
    Falls back to a reasonable default for a parking garage (typical bay = 8.5m).
    """
    if claude_scale_data and "meters_per_pixel_estimate" in claude_scale_data:
        val = float(claude_scale_data["meters_per_pixel_estimate"])
        if 0.001 < val < 1.0:  # sanity check: 1mm to 1m per pixel
            return val

    # Heuristic: assume a typical level 02-06 garage is ~100m wide
    # If image is ~3000px wide, that's ~0.033 m/px
    assumed_garage_width_m = 100.0
    return assumed_garage_width_m / max(image_width_px, 1)


def find_origin_pixel(geometry_data: dict, image_width_px: int, image_height_px: int) -> tuple[float, float]:
    """
    Determine the pixel that maps to the real-world origin (0, 0).
    Use the top-left corner of the bounding box of all detected geometry,
    or fall back to image top-left.
    """
    all_x, all_y = [], []

    for lane in geometry_data.get("driving_lanes", []):
        for p in lane.get("polygon", []):
            all_x.append(p["x"])
            all_y.append(p["y"])

    for wall in geometry_data.get("walls", []):
        for p in wall.get("points", []):
            all_x.append(p["x"])
            all_y.append(p["y"])

    if all_x and all_y:
        return (min(all_x), min(all_y))

    return (0.0, 0.0)


def build_normalized_geometry(raw_geometry: dict) -> tuple[dict, float, tuple[float, float]]:
    """
    Take raw Claude geometry output and return normalized geometry in meters.
    Returns (normalized_geometry, scale_m_per_px, origin_px)
    """
    img_size = raw_geometry.get("image_size", {})
    w_px = img_size.get("width_px", 3000)
    h_px = img_size.get("height_px", 2000)

    scale = estimate_scale_from_claude(raw_geometry.get("scale", {}), w_px, h_px)
    origin = find_origin_pixel(raw_geometry, w_px, h_px)

    def norm_pt(p):
        return normalize_point(p["x"], p["y"], scale, origin)

    def norm_poly(poly):
        return [norm_pt(p) for p in poly]

    normalized = {
        "walls": [
            {
                "id": w["id"],
                "points": norm_poly(w.get("points", [])),
                "height": 2.5,
                "thickness": 0.2,
            }
            for w in raw_geometry.get("walls", [])
        ],
        "driving_lanes": [
            {
                "id": l["id"],
                "polygon": norm_poly(l.get("polygon", [])),
                "type": l.get("type", "straight"),
                "width": l.get("approximate_width_px", 50) * scale,
                "one_way": l.get("one_way", False),
                "direction": math.radians(l["direction_degrees"]) if l.get("direction_degrees") is not None else None,
            }
            for l in raw_geometry.get("driving_lanes", [])
        ],
        "ramp_regions": [
            {
                "id": r["id"],
                "polygon": norm_poly(r.get("polygon", [])),
                "direction": r.get("direction", "up"),
                "connects_level_hint": r.get("connects_level_hint", ""),
                "label_text": r.get("label_text", ""),
                # elevation values assigned later when multi-floor connections are established
                "start_elevation": 0.0,
                "end_elevation": 3.0,
                "angle": 10.0,
                "entry_edge": [],
                "exit_edge": [],
                "connects_to_level_id": "",
            }
            for r in raw_geometry.get("ramp_regions", [])
        ],
        "columns": [
            {
                "id": c["id"],
                "position": norm_pt(c["position"]),
                "width": c.get("approximate_size_px", 20) * scale,
                "depth": c.get("approximate_size_px", 20) * scale,
            }
            for c in raw_geometry.get("columns", [])
        ],
        "perimeter_openings": [
            {
                "id": o["id"],
                "position": norm_pt(o["position"]),
                "width": o.get("approximate_width_px", 50) * scale,
                "type": o.get("type", "both"),
            }
            for o in raw_geometry.get("perimeter_openings", [])
        ],
    }

    return normalized, scale, origin

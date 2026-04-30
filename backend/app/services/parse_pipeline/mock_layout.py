"""
Mock garage layout used when ANTHROPIC_API_KEY is not set.
Based on a typical 6-row parking garage layout (similar to the Level 02-06 plans).
All coordinates in meters. Garage is ~100m wide x 60m deep.
"""
import uuid


def generate_mock_layout(level_id: str, floor_elevation: float, display_name: str) -> dict:
    """Return a realistic parsed GarageLevel dict without calling any API."""

    W = 100.0  # garage width
    D = 60.0   # garage depth

    # ── Driving lanes ──────────────────────────────────────────────────────────
    # Two-way main aisle runs left-right across the centre
    # Six bays of angled parking on each side
    lane_width = 6.5

    lanes = [
        # Main east-west aisle (top third)
        _lane("lane_top", [(2, 12), (W-2, 12), (W-2, 12+lane_width), (2, 12+lane_width)]),
        # Main east-west aisle (middle)
        _lane("lane_mid", [(2, 28), (W-2, 28), (W-2, 28+lane_width), (2, 28+lane_width)]),
        # Main east-west aisle (bottom third)
        _lane("lane_bot", [(2, 44), (W-2, 44), (W-2, 44+lane_width), (2, 44+lane_width)]),
        # North-south cross aisle (left)
        _lane("lane_cross_l", [(2, 2), (2+lane_width, 2), (2+lane_width, D-2), (2, D-2)]),
        # North-south cross aisle (centre)
        _lane("lane_cross_c", [(W/2-lane_width/2, 2), (W/2+lane_width/2, 2),
                                (W/2+lane_width/2, D-2), (W/2-lane_width/2, D-2)]),
        # North-south cross aisle (right)
        _lane("lane_cross_r", [(W-2-lane_width, 2), (W-2, 2), (W-2, D-2), (W-2-lane_width, D-2)]),
    ]

    # ── Walls ──────────────────────────────────────────────────────────────────
    walls = [
        # Perimeter
        _wall("w_north", [(0, 0), (W, 0)]),
        _wall("w_south", [(0, D), (W, D)]),
        _wall("w_west",  [(0, 0), (0, D)]),
        _wall("w_east",  [(W, 0), (W, D)]),
        # Interior divider strips between parking rows
        _wall("w_div1", [(10, 0), (10, 11)]),
        _wall("w_div2", [(10, 20), (10, 27)]),
        _wall("w_div3", [(10, 35), (10, 43)]),
        _wall("w_div4", [(10, 52), (10, D)]),
    ]

    # ── Ramp region ────────────────────────────────────────────────────────────
    ramp_dir = "up" if floor_elevation < 9.0 else "down"
    ramps = [
        {
            "id": "ramp_main",
            "polygon": [
                {"x": W/2 - 6, "y": 26},
                {"x": W/2 + 6, "y": 26},
                {"x": W/2 + 6, "y": 36},
                {"x": W/2 - 6, "y": 36},
            ],
            "direction": ramp_dir,
            "connects_to_level_id": "",
            "start_elevation": floor_elevation,
            "end_elevation": floor_elevation + 3.0,
            "angle": 12.0,
            "entry_edge": [{"x": W/2 - 6, "y": 26}, {"x": W/2 + 6, "y": 26}],
            "exit_edge":  [{"x": W/2 - 6, "y": 36}, {"x": W/2 + 6, "y": 36}],
        }
    ]

    # ── Perimeter openings ─────────────────────────────────────────────────────
    openings = [
        {"id": "entry_main", "position": {"x": 8,   "y": 0},  "width": 7.0, "type": "entry"},
        {"id": "exit_main",  "position": {"x": W-8, "y": 0},  "width": 7.0, "type": "exit"},
        {"id": "open_south", "position": {"x": W/2, "y": D},  "width": 7.0, "type": "both"},
    ]

    # ── Columns ────────────────────────────────────────────────────────────────
    columns = [
        {"id": f"col_{r}_{c}", "position": {"x": 10 + c * 20, "y": 10 + r * 16},
         "width": 0.5, "depth": 0.5}
        for r in range(3) for c in range(5)
    ]

    # ── Cameras ───────────────────────────────────────────────────────────────
    cameras = [
        _camera("cam_entry",   {"x": 5,    "y": 3},   floor_elevation, 270, "Entry camera"),
        _camera("cam_exit",    {"x": W-5,  "y": 3},   floor_elevation, 270, "Exit camera"),
        _camera("cam_mid_l",   {"x": 15,   "y": 31},  floor_elevation, 90,  "Mid aisle camera L"),
        _camera("cam_mid_r",   {"x": W-15, "y": 31},  floor_elevation, 270, "Mid aisle camera R"),
        _camera("cam_ramp",    {"x": W/2,  "y": 25},  floor_elevation, 180, "Ramp approach camera"),
        _camera("cam_corner",  {"x": 3,    "y": D-3}, floor_elevation, 45,  "SE corner camera"),
    ]

    # ── Signs ─────────────────────────────────────────────────────────────────
    signs = [
        _sign("sign_exit_n",  {"x": W-5,  "y": 2},   "exit",          "EXIT"),
        _sign("sign_exit_s",  {"x": W/2,  "y": D-2}, "exit",          "EXIT"),
        _sign("sign_ramp_up", {"x": W/2+8,"y": 28},  "directional",   "RAMP UP"),
        _sign("sign_clr",     {"x": 5,    "y": 1},   "height_clearance", "8'-2\""),
        _sign("sign_spd",     {"x": 20,   "y": 14},  "speed_limit",   "5 MPH"),
        _sign("sign_lvl",     {"x": 3,    "y": 3},   "level_id",      display_name),
    ]

    # ── Entry / exit points ───────────────────────────────────────────────────
    entry_points = [{"id": "ep_main", "position": {"x": 50, "y": 15}, "direction": 3.14159}]
    exit_points  = [{"id": "xp_main", "position": {"x": W-8, "y": 2}, "direction": 0.0}]

    # ── Nav graph (simple grid of waypoints) ──────────────────────────────────
    nodes, edges = _build_simple_graph(lanes, floor_elevation)

    return {
        "processed_image_url": "",
        "scale_meters_per_pixel": 0.033,
        "origin_pixel": {"x": 0, "y": 0},
        "geometry": {
            "walls": walls,
            "lanes": lanes,
            "ramp_regions": ramps,
            "columns": columns,
            "perimeter_openings": openings,
        },
        "features": {
            "cameras": cameras,
            "signs": signs,
            "entry_points": entry_points,
            "exit_points": exit_points,
            "pedestrian_paths": [],
        },
        "nav_graph": {"nodes": nodes, "edges": edges},
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _lane(lid, pts):
    return {
        "id": lid,
        "polygon": [{"x": p[0], "y": p[1]} for p in pts],
        "type": "straight",
        "width": 6.5,
        "one_way": False,
        "direction": None,
    }


def _wall(wid, pts):
    return {
        "id": wid,
        "points": [{"x": p[0], "y": p[1]} for p in pts],
        "height": 2.5,
        "thickness": 0.2,
    }


def _camera(cid, pos, elev, facing_deg, notes):
    import math
    return {
        "id": cid,
        "position": pos,
        "elevation": 2.3,
        "coverage_angle": 90.0,
        "facing_direction": math.radians(facing_deg),
        "source": "mock",
        "confidence": 1.0,
        "notes": notes,
    }


def _sign(sid, pos, stype, text):
    return {
        "id": sid,
        "position": pos,
        "elevation": 2.1,
        "type": stype,
        "text": text,
        "source": "mock",
        "confidence": 1.0,
    }


def _build_simple_graph(lanes, elevation):
    import math
    nodes = []
    edges = []

    for lane in lanes:
        poly = lane["polygon"]
        xs = [p["x"] for p in poly]
        ys = [p["y"] for p in poly]
        cx = (min(xs) + max(xs)) / 2
        cy = (min(ys) + max(ys)) / 2
        span_x = max(xs) - min(xs)
        span_y = max(ys) - min(ys)

        lane_nodes = []
        if span_x >= span_y:
            step = max(5.0, span_x / 6)
            x = min(xs)
            while x <= max(xs):
                nid = str(uuid.uuid4())[:8]
                nodes.append({"id": nid, "position": {"x": x, "y": cy},
                               "elevation": elevation, "type": "waypoint"})
                lane_nodes.append(nid)
                x += step
        else:
            step = max(5.0, span_y / 6)
            y = min(ys)
            while y <= max(ys):
                nid = str(uuid.uuid4())[:8]
                nodes.append({"id": nid, "position": {"x": cx, "y": y},
                               "elevation": elevation, "type": "waypoint"})
                lane_nodes.append(nid)
                y += step

        for i in range(len(lane_nodes) - 1):
            a = next(n for n in nodes if n["id"] == lane_nodes[i])
            b = next(n for n in nodes if n["id"] == lane_nodes[i + 1])
            dx = a["position"]["x"] - b["position"]["x"]
            dy = a["position"]["y"] - b["position"]["y"]
            dist = math.sqrt(dx*dx + dy*dy)
            edges.append({
                "id": str(uuid.uuid4())[:8],
                "from_node_id": lane_nodes[i],
                "to_node_id": lane_nodes[i + 1],
                "distance_meters": dist,
                "bidirectional": True,
                "speed_limit_kph": 15.0,
            })

    return nodes, edges

"""
Build the navigation graph from normalized lane geometry.
Creates waypoints along lane centerlines and connects them at intersections.
"""
import uuid
import math


def _polygon_centroid(polygon: list[dict]) -> dict:
    if not polygon:
        return {"x": 0.0, "y": 0.0}
    cx = sum(p["x"] for p in polygon) / len(polygon)
    cy = sum(p["y"] for p in polygon) / len(polygon)
    return {"x": cx, "y": cy}


def _distance(a: dict, b: dict) -> float:
    return math.sqrt((a["x"] - b["x"]) ** 2 + (a["y"] - b["y"]) ** 2)


def _segments_from_polygon(polygon: list[dict], step_m: float = 5.0) -> list[dict]:
    """
    Generate waypoints along the centerline of a lane polygon by sampling
    at regular intervals along the polygon's long axis.
    Simple approach: use centroid + endpoints of bounding box major axis.
    """
    if len(polygon) < 3:
        return [_polygon_centroid(polygon)]

    min_x = min(p["x"] for p in polygon)
    max_x = max(p["x"] for p in polygon)
    min_y = min(p["y"] for p in polygon)
    max_y = max(p["y"] for p in polygon)

    width = max_x - min_x
    height = max_y - min_y
    cx = (min_x + max_x) / 2
    cy = (min_y + max_y) / 2

    # Place waypoints along the longer axis
    points = []
    if width >= height:
        num = max(2, int(width / step_m))
        for i in range(num + 1):
            x = min_x + (width * i / num)
            points.append({"x": x, "y": cy})
    else:
        num = max(2, int(height / step_m))
        for i in range(num + 1):
            y = min_y + (height * i / num)
            points.append({"x": cx, "y": y})

    return points


def build_nav_graph(normalized_geometry: dict, floor_elevation: float) -> dict:
    """
    Build a navigable graph from normalized geometry.
    Returns {nodes: [...], edges: [...]}
    """
    nodes = []
    edges = []
    node_map = {}  # "lane_id:idx" -> node id

    # Create waypoint nodes along each driving lane
    for lane in normalized_geometry.get("driving_lanes", []):
        waypoints = _segments_from_polygon(lane["polygon"])
        lane_nodes = []
        for i, wp in enumerate(waypoints):
            nid = str(uuid.uuid4())[:8]
            node = {
                "id": nid,
                "position": wp,
                "elevation": floor_elevation,
                "type": "waypoint",
            }
            nodes.append(node)
            lane_nodes.append(nid)
            node_map[f"{lane['id']}:{i}"] = nid

        # Connect sequential waypoints within the lane
        for i in range(len(lane_nodes) - 1):
            a = next(n for n in nodes if n["id"] == lane_nodes[i])
            b = next(n for n in nodes if n["id"] == lane_nodes[i + 1])
            dist = _distance(a["position"], b["position"])
            edges.append({
                "id": str(uuid.uuid4())[:8],
                "from_node_id": lane_nodes[i],
                "to_node_id": lane_nodes[i + 1],
                "distance_meters": dist,
                "bidirectional": not lane.get("one_way", False),
                "speed_limit_kph": 15.0,
            })

    # Create ramp entry/exit nodes
    for ramp in normalized_geometry.get("ramp_regions", []):
        centroid = _polygon_centroid(ramp["polygon"])
        entry_nid = str(uuid.uuid4())[:8]
        exit_nid = str(uuid.uuid4())[:8]
        nodes.append({
            "id": entry_nid,
            "position": centroid,
            "elevation": ramp.get("start_elevation", floor_elevation),
            "type": "ramp_entry",
            "feature_id": ramp["id"],
        })
        nodes.append({
            "id": exit_nid,
            "position": centroid,
            "elevation": ramp.get("end_elevation", floor_elevation + 3.0),
            "type": "ramp_exit",
            "feature_id": ramp["id"],
        })
        edges.append({
            "id": str(uuid.uuid4())[:8],
            "from_node_id": entry_nid,
            "to_node_id": exit_nid,
            "distance_meters": 20.0,  # approximate ramp length
            "bidirectional": ramp.get("direction") == "bidirectional",
            "speed_limit_kph": 8.0,
        })

    # Create entry/exit nodes from perimeter openings
    for opening in normalized_geometry.get("perimeter_openings", []):
        nid = str(uuid.uuid4())[:8]
        node_type = "entry" if opening["type"] == "entry" else "exit" if opening["type"] == "exit" else "entry"
        nodes.append({
            "id": nid,
            "position": opening["position"],
            "elevation": floor_elevation,
            "type": node_type,
            "feature_id": opening["id"],
        })

    # Connect nearby nodes (within 8m) across lanes — simple proximity connection
    _connect_nearby_nodes(nodes, edges, threshold_m=8.0)

    return {"nodes": nodes, "edges": edges}


def _connect_nearby_nodes(nodes: list[dict], edges: list[dict], threshold_m: float):
    """Connect nodes from different lanes that are close together (intersections)."""
    existing_pairs = set()
    for e in edges:
        existing_pairs.add((e["from_node_id"], e["to_node_id"]))
        existing_pairs.add((e["to_node_id"], e["from_node_id"]))

    for i, a in enumerate(nodes):
        for j, b in enumerate(nodes):
            if i >= j:
                continue
            if (a["id"], b["id"]) in existing_pairs:
                continue
            dist = _distance(a["position"], b["position"])
            if dist < threshold_m:
                edges.append({
                    "id": str(uuid.uuid4())[:8],
                    "from_node_id": a["id"],
                    "to_node_id": b["id"],
                    "distance_meters": dist,
                    "bidirectional": True,
                    "speed_limit_kph": 15.0,
                })
                existing_pairs.add((a["id"], b["id"]))
                existing_pairs.add((b["id"], a["id"]))

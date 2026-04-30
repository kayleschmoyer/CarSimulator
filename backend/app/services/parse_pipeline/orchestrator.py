"""
Orchestrates the full parse pipeline for a single floor plan image.
Called by the Celery task.
"""
import json
import os
import uuid
from datetime import datetime

from app.config import settings
from app.services.parse_pipeline.ingest import ingest_file
from app.services.parse_pipeline.preprocess import preprocess_floor_plan
from app.services.parse_pipeline.claude_geometry import extract_geometry
from app.services.parse_pipeline.claude_features import extract_features
from app.services.parse_pipeline.ocr import extract_text_labels
from app.services.parse_pipeline.coordinate_norm import build_normalized_geometry
from app.services.parse_pipeline.graph_builder import build_nav_graph


def run_parse_pipeline(
    source_file_path: str,
    level_id: str,
    floor_elevation: float,
    upload_dir: str,
    progress_callback=None,
) -> dict:
    """
    Full pipeline: raw file → parsed GarageLevel data dict.
    progress_callback(stage: str, message: str) called at each stage.
    """
    def report(stage: str, msg: str):
        if progress_callback:
            progress_callback(stage, msg)

    processed_dir = os.path.join(upload_dir, "processed")
    os.makedirs(processed_dir, exist_ok=True)

    # Stage 1: Ingest
    report("ingest", "Converting file to PNG...")
    png_path = ingest_file(source_file_path, processed_dir)

    # Stage 2: Preprocess
    report("preprocess", "Preprocessing image (contrast, cleanup)...")
    preprocessed_path = os.path.join(processed_dir, f"preprocessed_{uuid.uuid4().hex[:8]}.png")
    preprocessed_path, (img_w, img_h) = preprocess_floor_plan(png_path, preprocessed_path)

    # Stage 3: Claude Vision Pass A — Geometry
    report("claude_geometry", "Extracting geometric layout with Claude Vision (this may take 30-60s)...")
    raw_geometry = extract_geometry(preprocessed_path)

    # Stage 4: Claude Vision Pass B — Features
    report("claude_features", "Detecting cameras and signs with Claude Vision...")
    raw_features = extract_features(preprocessed_path)

    # Stage 5: OCR
    report("ocr", "Running OCR for text labels...")
    ocr_labels = extract_text_labels(preprocessed_path)

    # Stage 6: Coordinate normalization
    report("coordinate_norm", "Normalizing coordinates to real-world meters...")
    normalized_geometry, scale_m_per_px, origin_px = build_normalized_geometry(raw_geometry)

    def px_to_m(px_pt: dict) -> dict:
        return {
            "x": (px_pt["x"] - origin_px[0]) * scale_m_per_px,
            "y": (px_pt["y"] - origin_px[1]) * scale_m_per_px,
        }

    # Stage 7: Build features from Claude + OCR
    report("features", "Assembling feature data...")
    cameras = []
    for c in raw_features.get("cameras", []):
        if c.get("confidence", 0) < 0.5:
            continue
        cameras.append({
            "id": c.get("id", str(uuid.uuid4())[:8]),
            "position": px_to_m(c["position"]),
            "elevation": 2.2,
            "coverage_angle": c.get("coverage_angle_degrees", 90.0),
            "facing_direction": 0.0,
            "source": "cv_detected",
            "confidence": c.get("confidence", 0.8),
            "notes": c.get("symbol_description", ""),
        })

    # Augment with OCR-detected cameras
    for label in ocr_labels:
        if label["feature_type"] == "camera":
            cameras.append({
                "id": str(uuid.uuid4())[:8],
                "position": px_to_m({"x": label["x"], "y": label["y"]}),
                "elevation": 2.2,
                "coverage_angle": 90.0,
                "facing_direction": 0.0,
                "source": "cv_detected",
                "confidence": label["ocr_confidence"],
                "notes": f"OCR: {label['text']}",
            })

    signs = []
    for s in raw_features.get("signs", []):
        if s.get("confidence", 0) < 0.5:
            continue
        signs.append({
            "id": s.get("id", str(uuid.uuid4())[:8]),
            "position": px_to_m(s["position"]),
            "elevation": 2.0,
            "type": s.get("type", "unknown"),
            "text": s.get("text", ""),
            "source": "cv_detected",
            "confidence": s.get("confidence", 0.8),
        })

    entry_points = []
    exit_points = []
    for opening in normalized_geometry.get("perimeter_openings", []):
        if opening["type"] in ("entry", "both"):
            entry_points.append({
                "id": f"entry_{opening['id']}",
                "position": opening["position"],
                "direction": 0.0,
            })
        if opening["type"] in ("exit", "both"):
            exit_points.append({
                "id": f"exit_{opening['id']}",
                "position": opening["position"],
                "direction": 3.14159,
            })

    # Stage 8: Nav graph
    report("graph", "Building navigation graph...")
    nav_graph = build_nav_graph(normalized_geometry, floor_elevation)

    # Assemble final result
    result = {
        "level_id": level_id,
        "processed_image_url": preprocessed_path,
        "scale_meters_per_pixel": scale_m_per_px,
        "origin_pixel": {"x": origin_px[0], "y": origin_px[1]},
        "geometry": normalized_geometry,
        "features": {
            "cameras": cameras,
            "signs": signs,
            "entry_points": entry_points,
            "exit_points": exit_points,
            "pedestrian_paths": [],
        },
        "nav_graph": nav_graph,
        "parse_log": [
            {
                "timestamp": datetime.utcnow().isoformat(),
                "level_id": level_id,
                "stage": "complete",
                "message": f"Parsed: {len(normalized_geometry.get('driving_lanes',[]))} lanes, "
                           f"{len(normalized_geometry.get('ramp_regions',[]))} ramps, "
                           f"{len(cameras)} cameras, {len(signs)} signs",
                "severity": "info",
            }
        ],
    }

    return result

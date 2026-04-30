import json
import os
import uuid
from datetime import datetime

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
import aiofiles

from app.config import settings
from app.models.schema.garage import GarageLevel, AddLevelRequest, UpdateFeatureRequest
from app.api.routes.projects import get_project_store
from app.tasks.parse_tasks import parse_floor_plan

router = APIRouter(prefix="/projects/{project_id}/levels", tags=["levels"])


@router.get("", response_model=list[GarageLevel])
def list_levels(project_id: str):
    store = get_project_store()
    if project_id not in store:
        raise HTTPException(status_code=404, detail="Project not found")
    return store[project_id]["levels"]


@router.post("", response_model=GarageLevel)
async def upload_level(
    project_id: str,
    display_name: str = Form(...),
    floor_elevation: float = Form(...),
    file: UploadFile = File(...),
):
    store = get_project_store()
    if project_id not in store:
        raise HTTPException(status_code=404, detail="Project not found")

    level_id = str(uuid.uuid4())

    # Save uploaded file
    upload_dir = os.path.join(settings.upload_dir, project_id)
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1].lower() or ".png"
    file_path = os.path.join(upload_dir, f"{level_id}{ext}")

    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    # Create level record
    level = {
        "id": level_id,
        "display_name": display_name,
        "floor_elevation": floor_elevation,
        "source_image_url": file_path,
        "processed_image_url": "",
        "parse_status": "pending",
        "scale_meters_per_pixel": 0.033,
        "origin_pixel": {"x": 0, "y": 0},
        "geometry": {"walls": [], "lanes": [], "ramp_regions": [], "columns": [], "perimeter_openings": []},
        "features": {"cameras": [], "signs": [], "entry_points": [], "exit_points": [], "pedestrian_paths": []},
        "nav_graph": {"nodes": [], "edges": []},
    }
    store[project_id]["levels"].append(level)
    store[project_id]["metadata"]["total_levels"] = len(store[project_id]["levels"])

    # Kick off async parse
    parse_floor_plan.delay(
        source_file_path=file_path,
        level_id=level_id,
        floor_elevation=floor_elevation,
        upload_dir=upload_dir,
    )

    # Mark as processing
    level["parse_status"] = "processing"
    return level


@router.get("/{level_id}", response_model=GarageLevel)
def get_level(project_id: str, level_id: str):
    store = get_project_store()
    if project_id not in store:
        raise HTTPException(status_code=404, detail="Project not found")
    level = next((l for l in store[project_id]["levels"] if l["id"] == level_id), None)
    if not level:
        raise HTTPException(status_code=404, detail="Level not found")
    return level


@router.patch("/{level_id}/features")
def update_features(project_id: str, level_id: str, req: UpdateFeatureRequest):
    """Allow manual correction of detected features (cameras, signs, entry/exit points)."""
    store = get_project_store()
    if project_id not in store:
        raise HTTPException(status_code=404, detail="Project not found")
    level = next((l for l in store[project_id]["levels"] if l["id"] == level_id), None)
    if not level:
        raise HTTPException(status_code=404, detail="Level not found")

    if req.cameras is not None:
        level["features"]["cameras"] = [c.model_dump() for c in req.cameras]
    if req.signs is not None:
        level["features"]["signs"] = [s.model_dump() for s in req.signs]
    if req.entry_points is not None:
        level["features"]["entry_points"] = [e.model_dump() for e in req.entry_points]
    if req.exit_points is not None:
        level["features"]["exit_points"] = [e.model_dump() for e in req.exit_points]

    return level


@router.post("/{level_id}/parse-result")
def receive_parse_result(project_id: str, level_id: str, result: dict):
    """
    Internal endpoint called by Celery worker to store parse results.
    In production this would be called directly from the task via DB write.
    """
    store = get_project_store()
    if project_id not in store:
        raise HTTPException(status_code=404, detail="Project not found")
    level = next((l for l in store[project_id]["levels"] if l["id"] == level_id), None)
    if not level:
        raise HTTPException(status_code=404, detail="Level not found")

    level["processed_image_url"] = result.get("processed_image_url", "")
    level["scale_meters_per_pixel"] = result.get("scale_meters_per_pixel", 0.033)
    level["origin_pixel"] = result.get("origin_pixel", {"x": 0, "y": 0})
    level["geometry"] = result.get("geometry", level["geometry"])
    level["features"] = result.get("features", level["features"])
    level["nav_graph"] = result.get("nav_graph", level["nav_graph"])
    level["parse_status"] = "needs_review"

    return {"status": "updated"}

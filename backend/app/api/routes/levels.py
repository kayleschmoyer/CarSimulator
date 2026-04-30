import asyncio
import os
import uuid

import aiofiles
from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile

from app.config import settings
from app.models.schema.garage import GarageLevel, UpdateFeatureRequest
from app.api.routes.projects import get_project_store
from app.services.parse_pipeline.orchestrator import run_parse_pipeline

router = APIRouter(prefix="/projects/{project_id}/levels", tags=["levels"])


def _apply_parse_result(level: dict, result: dict) -> None:
    level["processed_image_url"] = result.get("processed_image_url", "")
    level["scale_meters_per_pixel"] = result.get("scale_meters_per_pixel", 0.033)
    level["origin_pixel"] = result.get("origin_pixel", {"x": 0, "y": 0})
    level["geometry"] = result.get("geometry", level["geometry"])
    level["features"] = result.get("features", level["features"])
    level["nav_graph"] = result.get("nav_graph", level["nav_graph"])
    level["parse_status"] = "needs_review"


async def _run_parse_background(file_path: str, level_id: str, floor_elevation: float,
                                 upload_dir: str, project_id: str, display_name: str = "") -> None:
    store = get_project_store()
    level = next(
        (l for l in store.get(project_id, {}).get("levels", []) if l["id"] == level_id),
        None,
    )
    if level is None:
        return

    try:
        # Run blocking pipeline in a thread so we don't block the event loop
        result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: run_parse_pipeline(
                source_file_path=file_path,
                level_id=level_id,
                floor_elevation=floor_elevation,
                upload_dir=upload_dir,
                display_name=display_name,
            ),
        )
        _apply_parse_result(level, result)
    except Exception as exc:
        level["parse_status"] = "failed"
        level["parse_error"] = str(exc)


@router.get("", response_model=list[GarageLevel])
def list_levels(project_id: str):
    store = get_project_store()
    if project_id not in store:
        raise HTTPException(status_code=404, detail="Project not found")
    return store[project_id]["levels"]


@router.post("", response_model=GarageLevel)
async def upload_level(
    project_id: str,
    background_tasks: BackgroundTasks,
    display_name: str = Form(...),
    floor_elevation: float = Form(...),
    file: UploadFile = File(...),
):
    store = get_project_store()
    if project_id not in store:
        raise HTTPException(status_code=404, detail="Project not found")

    level_id = str(uuid.uuid4())

    upload_dir = os.path.join(settings.upload_dir, project_id)
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1].lower() or ".png"
    file_path = os.path.join(upload_dir, f"{level_id}{ext}")

    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    level = {
        "id": level_id,
        "display_name": display_name,
        "floor_elevation": floor_elevation,
        "source_image_url": file_path,
        "processed_image_url": "",
        "parse_status": "processing",
        "scale_meters_per_pixel": 0.033,
        "origin_pixel": {"x": 0, "y": 0},
        "geometry": {"walls": [], "lanes": [], "ramp_regions": [], "columns": [], "perimeter_openings": []},
        "features": {"cameras": [], "signs": [], "entry_points": [], "exit_points": [], "pedestrian_paths": []},
        "nav_graph": {"nodes": [], "edges": []},
    }
    store[project_id]["levels"].append(level)
    store[project_id]["metadata"]["total_levels"] = len(store[project_id]["levels"])

    # Run parse pipeline in background — no Celery, no Redis, works on Windows
    background_tasks.add_task(
        _run_parse_background,
        file_path, level_id, floor_elevation, upload_dir, project_id, display_name,
    )

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

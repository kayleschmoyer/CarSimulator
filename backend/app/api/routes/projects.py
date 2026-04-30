import json
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models.schema.garage import (
    GarageProject, CreateProjectRequest, RampConnection,
    ProjectMetadata, GarageLevel
)

router = APIRouter(prefix="/projects", tags=["projects"])

# In-memory store for MVP (replace with DB in production)
_projects: dict[str, dict] = {}


@router.post("", response_model=GarageProject)
def create_project(req: CreateProjectRequest):
    pid = str(uuid.uuid4())
    project = {
        "id": pid,
        "name": req.name,
        "created_at": datetime.utcnow().isoformat(),
        "levels": [],
        "ramp_connections": [],
        "metadata": {
            "building_name": req.building_name,
            "total_levels": 0,
            "designer": "",
            "drawing_revision": "",
            "parse_log": [],
        },
    }
    _projects[pid] = project
    return project


@router.get("", response_model=list[GarageProject])
def list_projects():
    return list(_projects.values())


@router.get("/{project_id}", response_model=GarageProject)
def get_project(project_id: str):
    if project_id not in _projects:
        raise HTTPException(status_code=404, detail="Project not found")
    return _projects[project_id]


@router.delete("/{project_id}")
def delete_project(project_id: str):
    if project_id not in _projects:
        raise HTTPException(status_code=404, detail="Project not found")
    del _projects[project_id]
    return {"deleted": project_id}


@router.post("/{project_id}/ramp-connections")
def add_ramp_connection(project_id: str, conn: RampConnection):
    if project_id not in _projects:
        raise HTTPException(status_code=404, detail="Project not found")
    _projects[project_id]["ramp_connections"].append(conn.model_dump())
    return conn


def get_project_store() -> dict:
    """Expose in-memory store to other routes."""
    return _projects

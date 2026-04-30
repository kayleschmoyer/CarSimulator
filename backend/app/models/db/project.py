import json
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel, Column, Text


class ProjectDB(SQLModel, table=True):
    __tablename__ = "projects"

    id: str = Field(primary_key=True)
    name: str
    building_name: str = ""
    designer: str = ""
    drawing_revision: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    ramp_connections_json: str = Field(default="[]", sa_column=Column(Text))
    parse_log_json: str = Field(default="[]", sa_column=Column(Text))


class LevelDB(SQLModel, table=True):
    __tablename__ = "levels"

    id: str = Field(primary_key=True)
    project_id: str = Field(foreign_key="projects.id")
    display_name: str
    floor_elevation: float
    source_image_url: str = ""
    processed_image_url: str = ""
    parse_status: str = "pending"
    scale_meters_per_pixel: float = 0.01
    origin_pixel_x: float = 0.0
    origin_pixel_y: float = 0.0
    geometry_json: str = Field(default="{}", sa_column=Column(Text))
    features_json: str = Field(default="{}", sa_column=Column(Text))
    nav_graph_json: str = Field(default="{}", sa_column=Column(Text))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

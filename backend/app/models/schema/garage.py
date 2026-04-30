from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class Vector2(BaseModel):
    x: float
    y: float


class Wall(BaseModel):
    id: str
    points: list[Vector2]
    height: float = 2.5
    thickness: float = 0.2


class DrivingLane(BaseModel):
    id: str
    polygon: list[Vector2]
    type: str = "straight"  # straight | curved | intersection
    width: float
    one_way: bool = False
    direction: Optional[float] = None  # radians


class RampRegion(BaseModel):
    id: str
    polygon: list[Vector2]
    direction: str  # up | down | bidirectional
    connects_to_level_id: str
    start_elevation: float
    end_elevation: float
    angle: float  # slope degrees
    entry_edge: list[Vector2]
    exit_edge: list[Vector2]


class Column(BaseModel):
    id: str
    position: Vector2
    width: float = 0.4
    depth: float = 0.4


class Opening(BaseModel):
    id: str
    position: Vector2
    width: float
    type: str  # entry | exit | both


class CameraFeature(BaseModel):
    id: str
    position: Vector2
    elevation: float = 2.2
    coverage_angle: float = 90.0
    facing_direction: float = 0.0
    source: str  # cv_detected | manual | cad_imported
    confidence: float = 1.0
    notes: str = ""


class SignFeature(BaseModel):
    id: str
    position: Vector2
    elevation: float = 2.0
    type: str  # exit | directional | level_id | speed_limit | height_clearance | unknown
    text: str = ""
    source: str
    confidence: float = 1.0


class EntryPoint(BaseModel):
    id: str
    position: Vector2
    direction: float = 0.0  # radians, facing direction into garage


class ExitPoint(BaseModel):
    id: str
    position: Vector2
    direction: float = 0.0


class PedestrianPath(BaseModel):
    id: str
    polygon: list[Vector2]


class LevelGeometry(BaseModel):
    walls: list[Wall] = []
    lanes: list[DrivingLane] = []
    ramp_regions: list[RampRegion] = []
    columns: list[Column] = []
    perimeter_openings: list[Opening] = []


class LevelFeatures(BaseModel):
    cameras: list[CameraFeature] = []
    signs: list[SignFeature] = []
    entry_points: list[EntryPoint] = []
    exit_points: list[ExitPoint] = []
    pedestrian_paths: list[PedestrianPath] = []


class NavNode(BaseModel):
    id: str
    position: Vector2
    elevation: float
    type: str  # waypoint | ramp_entry | ramp_exit | entry | exit | intersection
    feature_id: Optional[str] = None


class NavEdge(BaseModel):
    id: str
    from_node_id: str
    to_node_id: str
    distance_meters: float
    bidirectional: bool = True
    speed_limit_kph: float = 15.0


class NavGraph(BaseModel):
    nodes: list[NavNode] = []
    edges: list[NavEdge] = []


class GarageLevel(BaseModel):
    id: str
    display_name: str
    floor_elevation: float  # meters above datum
    source_image_url: str = ""
    processed_image_url: str = ""
    parse_status: str = "pending"  # pending | processing | complete | needs_review | failed
    scale_meters_per_pixel: float = 0.01
    origin_pixel: Vector2 = Vector2(x=0, y=0)
    geometry: LevelGeometry = LevelGeometry()
    features: LevelFeatures = LevelFeatures()
    nav_graph: NavGraph = NavGraph()


class RampConnection(BaseModel):
    id: str
    from_level_id: str
    from_ramp_region_id: str
    to_level_id: str
    to_ramp_region_id: str


class ParseLogEntry(BaseModel):
    timestamp: str
    level_id: str
    stage: str
    message: str
    severity: str = "info"  # info | warning | error


class ProjectMetadata(BaseModel):
    building_name: str = ""
    total_levels: int = 0
    designer: str = ""
    drawing_revision: str = ""
    parse_log: list[ParseLogEntry] = []


class GarageProject(BaseModel):
    id: str
    name: str
    created_at: str
    levels: list[GarageLevel] = []
    ramp_connections: list[RampConnection] = []
    metadata: ProjectMetadata = ProjectMetadata()


class CreateProjectRequest(BaseModel):
    name: str
    building_name: str = ""


class AddLevelRequest(BaseModel):
    display_name: str
    floor_elevation: float


class UpdateFeatureRequest(BaseModel):
    cameras: Optional[list[CameraFeature]] = None
    signs: Optional[list[SignFeature]] = None
    entry_points: Optional[list[EntryPoint]] = None
    exit_points: Optional[list[ExitPoint]] = None

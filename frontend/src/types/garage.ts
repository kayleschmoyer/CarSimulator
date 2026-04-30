export interface Vector2 {
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  points: Vector2[];
  height: number;
  thickness: number;
}

export interface DrivingLane {
  id: string;
  polygon: Vector2[];
  type: "straight" | "curved" | "intersection";
  width: number;
  one_way: boolean;
  direction: number | null;
}

export interface RampRegion {
  id: string;
  polygon: Vector2[];
  direction: "up" | "down" | "bidirectional";
  connects_to_level_id: string;
  start_elevation: number;
  end_elevation: number;
  angle: number;
  entry_edge: Vector2[];
  exit_edge: Vector2[];
}

export interface Column {
  id: string;
  position: Vector2;
  width: number;
  depth: number;
}

export interface Opening {
  id: string;
  position: Vector2;
  width: number;
  type: "entry" | "exit" | "both";
}

export interface CameraFeature {
  id: string;
  position: Vector2;
  elevation: number;
  coverage_angle: number;
  facing_direction: number;
  source: "cv_detected" | "manual" | "cad_imported";
  confidence: number;
  notes: string;
}

export interface SignFeature {
  id: string;
  position: Vector2;
  elevation: number;
  type: string;
  text: string;
  source: string;
  confidence: number;
}

export interface EntryPoint {
  id: string;
  position: Vector2;
  direction: number;
}

export interface ExitPoint {
  id: string;
  position: Vector2;
  direction: number;
}

export interface LevelGeometry {
  walls: Wall[];
  lanes: DrivingLane[];
  ramp_regions: RampRegion[];
  columns: Column[];
  perimeter_openings: Opening[];
}

export interface LevelFeatures {
  cameras: CameraFeature[];
  signs: SignFeature[];
  entry_points: EntryPoint[];
  exit_points: ExitPoint[];
  pedestrian_paths: unknown[];
}

export interface NavNode {
  id: string;
  position: Vector2;
  elevation: number;
  type: string;
  feature_id?: string;
}

export interface NavEdge {
  id: string;
  from_node_id: string;
  to_node_id: string;
  distance_meters: number;
  bidirectional: boolean;
  speed_limit_kph: number;
}

export interface NavGraph {
  nodes: NavNode[];
  edges: NavEdge[];
}

export interface GarageLevel {
  id: string;
  display_name: string;
  floor_elevation: number;
  source_image_url: string;
  processed_image_url: string;
  parse_status: "pending" | "processing" | "complete" | "needs_review" | "failed";
  scale_meters_per_pixel: number;
  origin_pixel: Vector2;
  geometry: LevelGeometry;
  features: LevelFeatures;
  nav_graph: NavGraph;
}

export interface RampConnection {
  id: string;
  from_level_id: string;
  from_ramp_region_id: string;
  to_level_id: string;
  to_ramp_region_id: string;
}

export interface GarageProject {
  id: string;
  name: string;
  created_at: string;
  levels: GarageLevel[];
  ramp_connections: RampConnection[];
  metadata: {
    building_name: string;
    total_levels: number;
    designer: string;
    drawing_revision: string;
    parse_log: unknown[];
  };
}

export interface SimulationSpawnPoint {
  level_id: string;
  position: Vector2;
  elevation: number;
  direction: number;
}

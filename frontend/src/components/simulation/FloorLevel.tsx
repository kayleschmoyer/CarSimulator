import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useSimulationStore } from "../../store/simulationStore";
import { useNotificationStore } from "../../store/notificationStore";
import { buildWallGeometry } from "../../lib/geometry/wallGeometry";
import { buildLaneGeometry } from "../../lib/geometry/laneGeometry";
import { pointInPolygon } from "../../lib/geometry/pointInPolygon";
import type { GarageLevel, CameraFeature, SignFeature } from "../../types/garage";

const CONCRETE_COLOR = "#b0b0b0";
const WALL_COLOR = "#999999";
const CEILING_COLOR = "#c8c8c8";
const FLOOR_HEIGHT = 2.7; // m floor-to-ceiling

const CAMERA_TRIGGER_RADIUS = 4.0; // m
const CAMERA_CLEAR_RADIUS = 7.0;
const SIGN_TRIGGER_RADIUS = 6.0;

interface Props {
  level: GarageLevel;
  visible: boolean;
  wallMeshRef: (mesh: THREE.Mesh | null) => void;
}

export default function FloorLevel({ level, visible, wallMeshRef }: Props) {
  const wallGeo = useMemo(() => buildWallGeometry(level.geometry.walls), [level.id]);
  const laneGeo = useMemo(() => buildLaneGeometry(level.geometry.lanes, level.floor_elevation), [level.id]);

  const wallMeshLocal = useRef<THREE.Mesh>(null);

  useEffect(() => {
    wallMeshRef(wallMeshLocal.current);
    return () => wallMeshRef(null);
  }, [wallMeshLocal.current]);

  return (
    <group visible={visible}>
      {/* Floor slab */}
      <mesh
        position={[0, level.floor_elevation, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color={CONCRETE_COLOR} roughness={0.9} metalness={0.0} />
      </mesh>

      {/* Ceiling */}
      <mesh
        position={[0, level.floor_elevation + FLOOR_HEIGHT, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color={CEILING_COLOR} roughness={0.95} metalness={0.0} side={THREE.BackSide} />
      </mesh>

      {/* Lane surfaces */}
      {laneGeo.getAttribute("position") && (
        <mesh geometry={laneGeo} receiveShadow>
          <meshStandardMaterial color="#707070" roughness={0.85} metalness={0.0} />
        </mesh>
      )}

      {/* Walls */}
      {wallGeo.getAttribute("position") && (
        <mesh ref={wallMeshLocal} geometry={wallGeo} castShadow receiveShadow>
          <meshStandardMaterial color={WALL_COLOR} roughness={0.8} metalness={0.0} />
        </mesh>
      )}

      {/* Columns */}
      {level.geometry.columns.map((col) => (
        <mesh
          key={col.id}
          position={[col.position.x, level.floor_elevation + FLOOR_HEIGHT / 2, col.position.y]}
          castShadow
        >
          <boxGeometry args={[col.width, FLOOR_HEIGHT, col.depth]} />
          <meshStandardMaterial color={WALL_COLOR} roughness={0.7} />
        </mesh>
      ))}

      {/* Ramp surfaces */}
      {level.geometry.ramp_regions.map((ramp) => (
        <RampMesh key={ramp.id} ramp={ramp} />
      ))}

      {/* Camera markers */}
      {level.features.cameras.map((cam) => (
        <CameraMarker key={cam.id} camera={cam} levelElevation={level.floor_elevation} />
      ))}

      {/* Sign markers */}
      {level.features.signs.map((sign) => (
        <SignMarker key={sign.id} sign={sign} levelElevation={level.floor_elevation} />
      ))}

      {/* Overhead fluorescent lights — bright, tight grid */}
      {generateLightPositions(level.floor_elevation).map((pos, i) => (
        <pointLight
          key={i}
          position={pos}
          intensity={60}
          distance={18}
          decay={1}
          color="#fffef0"
          castShadow={false}
        />
      ))}
    </group>
  );
}

function RampMesh({ ramp }: { ramp: GarageLevel["geometry"]["ramp_regions"][0] }) {
  const geo = useMemo(() => {
    if (ramp.polygon.length < 3) return null;

    // Build a flat polygon at start elevation, then tilt it
    const shape = new THREE.Shape();
    shape.moveTo(ramp.polygon[0].x, ramp.polygon[0].y);
    for (let i = 1; i < ramp.polygon.length; i++) {
      shape.lineTo(ramp.polygon[i].x, ramp.polygon[i].y);
    }
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape, 8);
    geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
    return geo;
  }, [ramp.id]);

  if (!geo) return null;

  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial color="#686868" roughness={0.9} side={THREE.DoubleSide} />
    </mesh>
  );
}

function CameraMarker({ camera, levelElevation }: { camera: CameraFeature; levelElevation: number }) {
  const carPos = useSimulationStore((s) => s.carPosition);
  const { addNotification, markTriggered, clearTriggered, isTriggered } = useNotificationStore();

  const camWorldPos = new THREE.Vector3(
    camera.position.x,
    levelElevation + camera.elevation,
    camera.position.y
  );
  const carVec = new THREE.Vector3(carPos[0], carPos[1], carPos[2]);
  const dist = camWorldPos.distanceTo(carVec);

  if (dist < CAMERA_TRIGGER_RADIUS && !isTriggered(camera.id)) {
    markTriggered(camera.id);
    addNotification({
      type: "camera",
      title: "Security Camera",
      body: camera.notes || `Camera detected — ${Math.round(dist)}m away`,
    });
  } else if (dist > CAMERA_CLEAR_RADIUS && isTriggered(camera.id)) {
    clearTriggered(camera.id);
  }

  const confidenceColor = camera.confidence > 0.85 ? "#00ff88" : camera.confidence > 0.6 ? "#ffaa00" : "#ff4444";

  return (
    <group position={[camera.position.x, levelElevation + camera.elevation, camera.position.y]}>
      {/* Camera body */}
      <mesh>
        <boxGeometry args={[0.15, 0.1, 0.25]} />
        <meshStandardMaterial color="#222222" roughness={0.3} metalness={0.6} />
      </mesh>
      {/* Lens */}
      <mesh position={[0, 0, 0.15]}>
        <cylinderGeometry args={[0.04, 0.04, 0.08, 8]} />
        <meshStandardMaterial color="#111111" roughness={0.1} metalness={0.8} />
      </mesh>
      {/* Indicator light */}
      <mesh position={[0.05, 0.06, 0]}>
        <sphereGeometry args={[0.02]} />
        <meshStandardMaterial color={confidenceColor} emissive={confidenceColor} emissiveIntensity={2} />
      </mesh>
    </group>
  );
}

function SignMarker({ sign, levelElevation }: { sign: SignFeature; levelElevation: number }) {
  const carPos = useSimulationStore((s) => s.carPosition);
  const { addNotification, markTriggered, clearTriggered, isTriggered } = useNotificationStore();

  const signWorldPos = new THREE.Vector3(sign.position.x, levelElevation + sign.elevation, sign.position.y);
  const carVec = new THREE.Vector3(carPos[0], carPos[1], carPos[2]);
  const dist = signWorldPos.distanceTo(carVec);

  if (dist < SIGN_TRIGGER_RADIUS && !isTriggered(sign.id)) {
    markTriggered(sign.id);
    addNotification({
      type: "sign",
      title: `Sign: ${sign.type.toUpperCase()}`,
      body: sign.text || `${sign.type} sign detected`,
    });
  } else if (dist > SIGN_TRIGGER_RADIUS * 1.5 && isTriggered(sign.id)) {
    clearTriggered(sign.id);
  }

  const signColors: Record<string, string> = {
    exit: "#00cc44",
    directional: "#0055cc",
    speed_limit: "#ffffff",
    height_clearance: "#ffcc00",
    unknown: "#888888",
  };
  const color = signColors[sign.type] ?? "#888888";

  return (
    <group position={[sign.position.x, levelElevation + sign.elevation, sign.position.y]}>
      <mesh>
        <boxGeometry args={[0.6, 0.3, 0.04]} />
        <meshStandardMaterial color={color} roughness={0.4} emissive={color} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function generateLightPositions(elevation: number): [number, number, number][] {
  const lights: [number, number, number][] = [];
  // Cover 0–120m × 0–70m with 12m spacing to match typical garage layout
  const spacingX = 12;
  const spacingZ = 12;
  for (let x = 6; x < 120; x += spacingX) {
    for (let z = 6; z < 70; z += spacingZ) {
      lights.push([x, elevation + 2.5, z]);
    }
  }
  return lights;
}

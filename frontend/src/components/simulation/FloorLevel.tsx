import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useSimulationStore } from "../../store/simulationStore";
import { useNotificationStore } from "../../store/notificationStore";
import { buildWallGeometry } from "../../lib/geometry/wallGeometry";
import { buildLaneGeometry } from "../../lib/geometry/laneGeometry";
import type { GarageLevel, CameraFeature, SignFeature } from "../../types/garage";

const FLOOR_H = 3.0;           // floor-to-ceiling height (m)
const CAMERA_TRIGGER = 4.0;
const CAMERA_CLEAR   = 7.0;
const SIGN_TRIGGER   = 6.0;

interface Props {
  level: GarageLevel;
  visible: boolean;
  wallMeshRef: (mesh: THREE.Mesh | null) => void;
}

export default function FloorLevel({ level, visible, wallMeshRef }: Props) {
  const wallGeo  = useMemo(() => buildWallGeometry(level.geometry.walls), [level.id]);
  const laneGeo  = useMemo(() => buildLaneGeometry(level.geometry.lanes, level.floor_elevation), [level.id]);
  const wallMeshLocal = useRef<THREE.Mesh>(null);
  const el = level.floor_elevation;

  useEffect(() => {
    wallMeshRef(wallMeshLocal.current);
    return () => wallMeshRef(null);
  }, [wallMeshLocal.current]);

  return (
    <group visible={visible}>

      {/* ── Floor — concrete tan ───────────────────────────────────────────── */}
      <mesh position={[0, el, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color="#b8b0a0" roughness={0.95} metalness={0} />
      </mesh>

      {/* ── Ceiling — dark charcoal so the space feels enclosed ───────────── */}
      <mesh position={[0, el + FLOOR_H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color="#282830" roughness={0.9} metalness={0} side={THREE.DoubleSide} />
      </mesh>

      {/* ── Lane asphalt — slightly darker than floor ─────────────────────── */}
      {laneGeo.getAttribute("position") && (
        <mesh geometry={laneGeo} receiveShadow>
          <meshStandardMaterial color="#9a9590" roughness={0.9} metalness={0} />
        </mesh>
      )}

      {/* ── Concrete walls ───────────────────────────────────────────────── */}
      {wallGeo.getAttribute("position") && (
        <mesh ref={wallMeshLocal} geometry={wallGeo} castShadow receiveShadow>
          <meshStandardMaterial color="#c0b8a8" roughness={0.85} metalness={0} />
        </mesh>
      )}

      {/* ── Columns ──────────────────────────────────────────────────────── */}
      {level.geometry.columns.map((col) => (
        <mesh key={col.id}
          position={[col.position.x, el + FLOOR_H / 2, col.position.y]}
          castShadow receiveShadow>
          <boxGeometry args={[col.width + 0.3, FLOOR_H, col.depth + 0.3]} />
          <meshStandardMaterial color="#b0aa9a" roughness={0.8} metalness={0} />
        </mesh>
      ))}

      {/* ── Ramp surfaces ────────────────────────────────────────────────── */}
      {level.geometry.ramp_regions.map((ramp) => (
        <RampMesh key={ramp.id} ramp={ramp} />
      ))}

      {/* ── Fluorescent ceiling lights — visible fixture strips ───────────── */}
      <CeilingLights elevation={el} floorH={FLOOR_H} />

      {/* ── Point lights — actual illumination ───────────────────────────── */}
      {generateLightPositions(el).map((pos, i) => (
        <pointLight key={i} position={pos} intensity={2.5} distance={16} decay={1} color="#fff8e8" />
      ))}

      {/* ── Parking floor markings ───────────────────────────────────────── */}
      <ParkingMarkings level={level} elevation={el} />

      {/* ── Yellow safety stripes on perimeter ───────────────────────────── */}
      <PerimeterStripes elevation={el} />

      {/* ── Feature markers ──────────────────────────────────────────────── */}
      {level.features.cameras.map((cam) => (
        <CameraMarker key={cam.id} camera={cam} levelElevation={el} />
      ))}
      {level.features.signs.map((sign) => (
        <SignMarker key={sign.id} sign={sign} levelElevation={el} />
      ))}
    </group>
  );
}

// ── Fluorescent ceiling fixture strips ────────────────────────────────────────
function CeilingLights({ elevation, floorH }: { elevation: number; floorH: number }) {
  const fixtures = useMemo(() => {
    const out: { x: number; z: number; rot: number }[] = [];
    // Rows along garage length
    for (let x = 10; x < 100; x += 12) {
      for (let z = 6; z < 60; z += 10) {
        out.push({ x, z, rot: 0 });
      }
    }
    return out;
  }, []);

  return (
    <>
      {fixtures.map((f, i) => (
        <group key={i} position={[f.x, elevation + floorH - 0.05, f.z]}>
          {/* Fixture housing */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <boxGeometry args={[0.3, 1.8, 0.08]} />
            <meshStandardMaterial color="#e8e8e8" roughness={0.3} />
          </mesh>
          {/* Glowing tube */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.03]}>
            <boxGeometry args={[0.18, 1.6, 0.02]} />
            <meshStandardMaterial color="#fffff0" emissive="#fffff0" emissiveIntensity={3} roughness={0} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ── Parking stall lines + aisle markings ──────────────────────────────────────
function ParkingMarkings({ level, elevation }: { level: GarageLevel; elevation: number }) {
  const Y = elevation + 0.01; // just above floor

  // Horizontal aisles from mock layout — stall lines perpendicular to aisle
  const horizontalAisles = level.geometry.lanes
    .filter((l) => l.id?.startsWith("lane_top") || l.id?.startsWith("lane_mid") || l.id?.startsWith("lane_bot"));

  const lines: { x: number; z: number; w: number; d: number; rot?: number; color: string }[] = [];

  // Generate stall lines along each horizontal aisle
  horizontalAisles.forEach((lane) => {
    const xs = lane.polygon.map((p) => p.x);
    const zs = lane.polygon.map((p) => p.y);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minZ = Math.min(...zs); const maxZ = Math.max(...zs);
    const centerZ = (minZ + maxZ) / 2;

    // Stall lines every 2.5m
    for (let x = minX + 2.5; x < maxX - 1; x += 2.5) {
      // Stalls above aisle
      lines.push({ x, z: minZ - 2.5, w: 0.1, d: 5, color: "#ffffff" });
      // Stalls below aisle
      lines.push({ x, z: maxZ + 2.5, w: 0.1, d: 5, color: "#ffffff" });
    }

    // Yellow dashed centerline in aisle
    for (let x = minX + 3; x < maxX - 3; x += 6) {
      lines.push({ x: x + 1.5, z: centerZ, w: 3, d: 0.15, color: "#f5c518" });
    }
  });

  return (
    <>
      {lines.map((l, i) => (
        <mesh key={i} position={[l.x, Y, l.z]}>
          <boxGeometry args={[l.w, 0.01, l.d]} />
          <meshStandardMaterial color={l.color} roughness={0.5} />
        </mesh>
      ))}
    </>
  );
}

// ── Yellow safety stripes at edges / curbs ────────────────────────────────────
function PerimeterStripes({ elevation }: { elevation: number }) {
  const Y = elevation + 0.01;
  // Black-yellow diagonal stripes along south wall
  const stripes = useMemo(() => {
    const out = [];
    for (let x = 2; x < 98; x += 2) {
      out.push(x);
    }
    return out;
  }, []);

  return (
    <>
      {stripes.map((x, i) => (
        <mesh key={i} position={[x, Y, 58.5]}>
          <boxGeometry args={[1, 0.01, 0.5]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#f5c518" : "#1a1a1a"} roughness={0.6} />
        </mesh>
      ))}
      {stripes.map((x, i) => (
        <mesh key={`n${i}`} position={[x, Y, 1.5]}>
          <boxGeometry args={[1, 0.01, 0.5]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#f5c518" : "#1a1a1a"} roughness={0.6} />
        </mesh>
      ))}
    </>
  );
}

// ── Ramp ──────────────────────────────────────────────────────────────────────
function RampMesh({ ramp }: { ramp: GarageLevel["geometry"]["ramp_regions"][0] }) {
  const geo = useMemo(() => {
    if (ramp.polygon.length < 3) return null;
    const shape = new THREE.Shape();
    shape.moveTo(ramp.polygon[0].x, ramp.polygon[0].y);
    for (let i = 1; i < ramp.polygon.length; i++) shape.lineTo(ramp.polygon[i].x, ramp.polygon[i].y);
    shape.closePath();
    const g = new THREE.ShapeGeometry(shape, 8);
    g.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
    return g;
  }, [ramp.id]);
  if (!geo) return null;
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#a8a098" roughness={0.9} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ── Camera marker ─────────────────────────────────────────────────────────────
function CameraMarker({ camera, levelElevation }: { camera: CameraFeature; levelElevation: number }) {
  const carPos = useSimulationStore((s) => s.carPosition);
  const { addNotification, markTriggered, clearTriggered, isTriggered } = useNotificationStore();

  const camVec = new THREE.Vector3(camera.position.x, levelElevation + camera.elevation, camera.position.y);
  const carVec = new THREE.Vector3(carPos[0], carPos[1], carPos[2]);
  const dist = camVec.distanceTo(carVec);

  if (dist < CAMERA_TRIGGER && !isTriggered(camera.id)) {
    markTriggered(camera.id);
    addNotification({ type: "camera", title: "Security Camera", body: camera.notes || `Camera — ${Math.round(dist)}m` });
  } else if (dist > CAMERA_CLEAR && isTriggered(camera.id)) {
    clearTriggered(camera.id);
  }

  return (
    <group position={[camera.position.x, levelElevation + camera.elevation, camera.position.y]}>
      <mesh>
        <boxGeometry args={[0.2, 0.12, 0.3]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.17]}>
        <cylinderGeometry args={[0.05, 0.05, 0.1, 8]} rotation={[Math.PI / 2, 0, 0]} />
        <meshStandardMaterial color="#111" roughness={0.1} metalness={0.9} />
      </mesh>
      {/* Red LED */}
      <mesh position={[0.08, 0.07, 0]}>
        <sphereGeometry args={[0.025]} />
        <meshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={4} />
      </mesh>
    </group>
  );
}

// ── Sign marker ───────────────────────────────────────────────────────────────
function SignMarker({ sign, levelElevation }: { sign: SignFeature; levelElevation: number }) {
  const carPos = useSimulationStore((s) => s.carPosition);
  const { addNotification, markTriggered, clearTriggered, isTriggered } = useNotificationStore();

  const signVec = new THREE.Vector3(sign.position.x, levelElevation + sign.elevation, sign.position.y);
  const carVec  = new THREE.Vector3(carPos[0], carPos[1], carPos[2]);
  const dist = signVec.distanceTo(carVec);

  if (dist < SIGN_TRIGGER && !isTriggered(sign.id)) {
    markTriggered(sign.id);
    addNotification({ type: "sign", title: `Sign: ${sign.type.toUpperCase()}`, body: sign.text || sign.type });
  } else if (dist > SIGN_TRIGGER * 1.5 && isTriggered(sign.id)) {
    clearTriggered(sign.id);
  }

  const faceColor: Record<string, string> = {
    exit:             "#00aa33",
    directional:      "#003399",
    speed_limit:      "#ffffff",
    height_clearance: "#ffcc00",
  };
  const face = faceColor[sign.type] ?? "#334466";

  return (
    <group position={[sign.position.x, levelElevation + sign.elevation, sign.position.y]}>
      {/* Sign pole */}
      <mesh position={[0, -0.8, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.2, 6]} />
        <meshStandardMaterial color="#888" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Sign face */}
      <mesh>
        <boxGeometry args={[0.7, 0.35, 0.05]} />
        <meshStandardMaterial color={face} roughness={0.4} emissive={face} emissiveIntensity={0.4} />
      </mesh>
      {/* White border */}
      <mesh position={[0, 0, 0.03]}>
        <boxGeometry args={[0.74, 0.39, 0.01]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5} />
      </mesh>
    </group>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateLightPositions(elevation: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let x = 10; x < 100; x += 12) {
    for (let z = 6; z < 60; z += 10) {
      out.push([x, elevation + FLOOR_H - 0.1, z]);
    }
  }
  return out;
}

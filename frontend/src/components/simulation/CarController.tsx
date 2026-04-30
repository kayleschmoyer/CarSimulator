import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import * as THREE from "three";
import { useSimulationStore } from "../../store/simulationStore";
import { pointInPolygon } from "../../lib/geometry/pointInPolygon";
import type { GarageLevel } from "../../types/garage";

const MAX_SPEED = 4.2; // m/s ≈ 15 km/h
const ACCELERATION = 2.5;
const BRAKE_FORCE = 5.0;
const STEERING_SPEED = 1.8; // radians/s at full speed
const CAR_LENGTH = 4.5;
const CAR_WIDTH = 2.0;
const COLLISION_RAYS = 8;
const COLLISION_DISTANCE = 1.5;
const CAMERA_HEIGHT = 1.2; // driver eye height

export enum Controls {
  forward = "forward",
  back = "back",
  left = "left",
  right = "right",
}

interface Props {
  levels: GarageLevel[];
  wallMeshes: React.MutableRefObject<THREE.Mesh[]>;
}

export default function CarController({ levels, wallMeshes }: Props) {
  const { camera } = useThree();
  const carPos = useRef(new THREE.Vector3());
  const carRot = useRef(0);
  const speed = useRef(0);
  const targetRot = useRef(0);

  const { carPosition, carRotation, setRampTraversal, setCurrentLevel, updateCarState } =
    useSimulationStore();

  const [, getKeys] = useKeyboardControls<Controls>();

  // Initialize position from store
  useEffect(() => {
    carPos.current.set(carPosition[0], carPosition[1], carPosition[2]);
    carRot.current = carRotation;
    targetRot.current = carRotation;
  }, []);

  const raycaster = useRef(new THREE.Raycaster());
  const rayDir = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05); // cap at 50ms for stability
    const { forward, back, left, right } = getKeys();

    // Acceleration / braking
    if (forward) {
      speed.current = Math.min(speed.current + ACCELERATION * dt, MAX_SPEED);
    } else if (back) {
      speed.current = Math.max(speed.current - BRAKE_FORCE * dt, -MAX_SPEED * 0.4);
    } else {
      // Natural deceleration
      speed.current *= Math.pow(0.85, dt * 60);
      if (Math.abs(speed.current) < 0.02) speed.current = 0;
    }

    // Steering (only effective when moving)
    if (Math.abs(speed.current) > 0.05) {
      const steerFactor = (speed.current / MAX_SPEED) * STEERING_SPEED * dt;
      if (left) targetRot.current += steerFactor;
      if (right) targetRot.current -= steerFactor;
    }

    // Smooth rotation lerp
    carRot.current += (targetRot.current - carRot.current) * Math.min(dt * 12, 1);

    // Compute intended movement
    const moveX = Math.sin(carRot.current) * speed.current * dt;
    const moveZ = Math.cos(carRot.current) * speed.current * dt;

    const nextPos = carPos.current.clone();
    nextPos.x += moveX;
    nextPos.z += moveZ;

    // Raycast collision detection against wall meshes
    const blocked = checkCollision(
      carPos.current,
      nextPos,
      carRot.current,
      wallMeshes.current,
      raycaster.current,
      rayDir.current
    );

    if (!blocked) {
      carPos.current.copy(nextPos);
    } else {
      // Sliding: try X-only then Z-only movement
      const tryX = carPos.current.clone();
      tryX.x += moveX;
      const tryZ = carPos.current.clone();
      tryZ.z += moveZ;

      const blockedX = checkCollision(carPos.current, tryX, carRot.current, wallMeshes.current, raycaster.current, rayDir.current);
      const blockedZ = checkCollision(carPos.current, tryZ, carRot.current, wallMeshes.current, raycaster.current, rayDir.current);

      if (!blockedX) carPos.current.copy(tryX);
      else if (!blockedZ) carPos.current.copy(tryZ);

      speed.current *= 0.5; // lose speed on collision
    }

    // Ramp traversal — check if car entered a ramp polygon
    updateRampElevation(levels, carPos.current, setRampTraversal, setCurrentLevel);

    // Update first-person camera (child of car position)
    camera.position.set(carPos.current.x, carPos.current.y + CAMERA_HEIGHT, carPos.current.z);
    camera.rotation.set(0, carRot.current, 0, "YXZ");

    // Sync to store (throttled — every 10 frames is enough for HUD)
    updateCarState(
      [carPos.current.x, carPos.current.y, carPos.current.z],
      carRot.current,
      speed.current
    );
  });

  return null; // No visual — camera IS the car in first-person
}

function checkCollision(
  from: THREE.Vector3,
  to: THREE.Vector3,
  rotation: number,
  meshes: THREE.Mesh[],
  raycaster: THREE.Raycaster,
  dir: THREE.Vector3
): boolean {
  if (meshes.length === 0) return false;

  const move = to.clone().sub(from);
  const dist = move.length();
  if (dist < 0.001) return false;

  dir.copy(move).normalize();
  raycaster.set(from, dir);
  raycaster.far = dist + COLLISION_DISTANCE;

  const hits = raycaster.intersectObjects(meshes);
  return hits.length > 0 && hits[0].distance < dist + COLLISION_DISTANCE;
}

function updateRampElevation(
  levels: GarageLevel[],
  pos: THREE.Vector3,
  setRampTraversal: (s: ReturnType<typeof useSimulationStore.getState>["rampTraversal"]) => void,
  setCurrentLevel: (id: string) => void
) {
  for (const level of levels) {
    for (const ramp of level.geometry.ramp_regions) {
      const inRamp = pointInPolygon({ x: pos.x, z: pos.z }, ramp.polygon);
      if (!inRamp) continue;

      // Find progress along ramp (simplified: based on Z position within bounding box)
      const minY = Math.min(...ramp.polygon.map((p) => p.y));
      const maxY = Math.max(...ramp.polygon.map((p) => p.y));
      const progress = maxY === minY ? 0.5 : (pos.z - minY) / (maxY - minY);
      const clampedProgress = Math.max(0, Math.min(1, progress));

      const targetY = ramp.start_elevation + (ramp.end_elevation - ramp.start_elevation) * clampedProgress;
      pos.y += (targetY - pos.y) * 0.15; // smooth lerp

      if (clampedProgress > 0.9 && ramp.connects_to_level_id) {
        setCurrentLevel(ramp.connects_to_level_id);
      }
      return;
    }
  }
}

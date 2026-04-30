import { useRef, useCallback } from "react";
import * as THREE from "three";
import { KeyboardControls } from "@react-three/drei";
import { useSimulationStore } from "../../store/simulationStore";
import FloorLevel from "./FloorLevel";
import CarController, { Controls } from "./CarController";

const KEYBOARD_MAP = [
  { name: Controls.forward, keys: ["ArrowUp", "KeyW"] },
  { name: Controls.back, keys: ["ArrowDown", "KeyS"] },
  { name: Controls.left, keys: ["ArrowLeft", "KeyA"] },
  { name: Controls.right, keys: ["ArrowRight", "KeyD"] },
];

export default function GarageScene() {
  const { levels, currentLevelId, carPosition } = useSimulationStore();
  const wallMeshes = useRef<THREE.Mesh[]>([]);

  const registerWallMesh = useCallback((mesh: THREE.Mesh | null) => {
    if (mesh) {
      if (!wallMeshes.current.includes(mesh)) wallMeshes.current.push(mesh);
    } else {
      wallMeshes.current = wallMeshes.current.filter((m) => m !== null);
    }
  }, []);

  const currentLevel = levels.find((l) => l.id === currentLevelId);
  const currentElevation = currentLevel?.floor_elevation ?? 0;

  return (
    <KeyboardControls map={KEYBOARD_MAP}>
      {/* Ambient fill light */}
      <ambientLight intensity={0.4} color="#e8e8f0" />

      {/* Each floor level */}
      {levels.map((level) => {
        const elevDiff = Math.abs(level.floor_elevation - currentElevation);
        // Show current + 1 level above/below
        const visible = elevDiff <= 3.5;
        return (
          <FloorLevel
            key={level.id}
            level={level}
            visible={visible}
            wallMeshRef={registerWallMesh}
          />
        );
      })}

      {/* Car controller — manages camera + physics */}
      <CarController levels={levels} wallMeshes={wallMeshes} />
    </KeyboardControls>
  );
}

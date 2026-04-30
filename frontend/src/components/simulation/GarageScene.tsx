import { useRef, useCallback } from "react";
import * as THREE from "three";
import { KeyboardControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useSimulationStore } from "../../store/simulationStore";
import FloorLevel from "./FloorLevel";
import CarController, { Controls } from "./CarController";

const KEYBOARD_MAP = [
  { name: Controls.forward, keys: ["ArrowUp", "KeyW"] },
  { name: Controls.back, keys: ["ArrowDown", "KeyS"] },
  { name: Controls.left, keys: ["ArrowLeft", "KeyA"] },
  { name: Controls.right, keys: ["ArrowRight", "KeyD"] },
];

function SceneBackground() {
  const { scene } = useThree();
  scene.background = new THREE.Color("#1a1a2e"); // dark blue-gray — visible through openings
  return null;
}

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
      <SceneBackground />
      {/* Bright ambient so every surface is clearly visible */}
      <ambientLight intensity={3.5} color="#ffffff" />
      {/* Hemisphere: warm ceiling / cool floor */}
      <hemisphereLight args={["#fffbe8", "#d0cfc8", 2.0]} />

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

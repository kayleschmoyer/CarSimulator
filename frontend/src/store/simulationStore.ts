import { create } from "zustand";
import type { GarageLevel, SimulationSpawnPoint } from "../types/garage";

interface SimulationState {
  active: boolean;
  levels: GarageLevel[];
  currentLevelId: string | null;
  spawnPoint: SimulationSpawnPoint | null;

  // Car state (updated by CarController each frame)
  carPosition: [number, number, number];
  carRotation: number; // yaw in radians
  carSpeed: number; // m/s

  // Ramp traversal state
  rampTraversal: {
    active: boolean;
    rampId: string;
    progress: number;
    startY: number;
    endY: number;
    angle: number;
  } | null;

  startSimulation: (levels: GarageLevel[], spawn: SimulationSpawnPoint) => void;
  stopSimulation: () => void;
  updateCarState: (pos: [number, number, number], rotation: number, speed: number) => void;
  setCurrentLevel: (levelId: string) => void;
  setRampTraversal: (state: SimulationState["rampTraversal"]) => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  active: false,
  levels: [],
  currentLevelId: null,
  spawnPoint: null,
  carPosition: [0, 0, 0],
  carRotation: 0,
  carSpeed: 0,
  rampTraversal: null,

  startSimulation: (levels, spawn) =>
    set({
      active: true,
      levels,
      currentLevelId: spawn.level_id,
      spawnPoint: spawn,
      carPosition: [spawn.position.x, spawn.elevation + 0.5, spawn.position.y],
      carRotation: spawn.direction,
      carSpeed: 0,
      rampTraversal: null,
    }),

  stopSimulation: () => set({ active: false }),

  updateCarState: (pos, rotation, speed) =>
    set({ carPosition: pos, carRotation: rotation, carSpeed: speed }),

  setCurrentLevel: (levelId) => set({ currentLevelId: levelId }),

  setRampTraversal: (state) => set({ rampTraversal: state }),
}));

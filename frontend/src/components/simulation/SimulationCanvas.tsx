import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { useSimulationStore } from "../../store/simulationStore";
import GarageScene from "./GarageScene";
import HUD from "./HUD";

interface Props {
  onExit: () => void;
}

export default function SimulationCanvas({ onExit }: Props) {
  const stopSimulation = useSimulationStore((s) => s.stopSimulation);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stopSimulation();
        onExit();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <Canvas
        camera={{ fov: 75, near: 0.1, far: 500 }}
        shadows={false}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        style={{ width: "100%", height: "100%" }}
      >
        <GarageScene />
      </Canvas>
      <HUD />
    </div>
  );
}

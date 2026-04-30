import { useState, useEffect } from "react";
import { useProjectStore } from "../../store/projectStore";
import { useSimulationStore } from "../../store/simulationStore";
import type { GarageLevel, SimulationSpawnPoint } from "../../types/garage";
import FloorPlanUploader from "../upload/FloorPlanUploader";
import FloorPlanReviewer from "../review/FloorPlanReviewer";
import SimulationCanvas from "../simulation/SimulationCanvas";

type Screen = "projects" | "levels" | "upload" | "review" | "sim";

export default function ProjectDashboard() {
  const { projects, activeProject, fetchProjects, createProject, setActiveProject, refreshLevel } =
    useProjectStore();
  const { startSimulation, active: simActive, stopSimulation } = useSimulationStore();

  const [screen, setScreen] = useState<Screen>("projects");
  const [reviewLevel, setReviewLevel] = useState<GarageLevel | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [polling, setPolling] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  // Poll for level parse completion
  useEffect(() => {
    if (!polling || !activeProject) return;
    const interval = setInterval(async () => {
      await refreshLevel(activeProject.id, polling);
      const level = useProjectStore.getState().activeProject?.levels.find((l) => l.id === polling);
      if (level?.parse_status === "needs_review") {
        setPolling(null);
        setReviewLevel(level);
        setScreen("review");
      } else if (level?.parse_status === "failed") {
        setPolling(null);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [polling, activeProject]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    await createProject(newProjectName.trim());
    setNewProjectName("");
    setScreen("levels");
  };

  const handleUploaded = () => {
    // Check for newly processing level and start polling
    if (!activeProject) return;
    const processing = activeProject.levels.find((l) => l.parse_status === "processing");
    if (processing) setPolling(processing.id);
    setScreen("levels");
  };

  const launchSimulation = (startLevelId?: string) => {
    if (!activeProject) return;
    const approvedLevels = activeProject.levels.filter((l) => l.parse_status === "complete");
    if (approvedLevels.length === 0) return;

    const startLevel = approvedLevels.find((l) => l.id === startLevelId) ?? approvedLevels[0];
    const entryPoint = startLevel.features.entry_points[0];
    const spawn: SimulationSpawnPoint = {
      level_id: startLevel.id,
      position: entryPoint?.position ?? { x: 0, y: 0 },
      elevation: startLevel.floor_elevation,
      direction: entryPoint?.direction ?? 0,
    };
    startSimulation(approvedLevels, spawn);
    setScreen("sim");
  };

  if (simActive && screen === "sim") {
    return <SimulationCanvas onExit={() => { stopSimulation(); setScreen("levels"); }} />;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <div className="text-2xl">🏗️</div>
        <div>
          <h1 className="font-bold text-lg leading-none">Garage Simulator</h1>
          <p className="text-xs text-gray-400">Parking Garage Validation Tool</p>
        </div>
        {activeProject && (
          <>
            <span className="text-gray-600 mx-2">/</span>
            <button onClick={() => setScreen("levels")} className="text-sm text-blue-400 hover:text-blue-300">
              {activeProject.name}
            </button>
          </>
        )}
      </header>

      <div className="flex-1 p-6">
        {/* Project list */}
        {screen === "projects" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-xl font-semibold">Your Projects</h2>
            <div className="flex gap-3">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                placeholder="New project name (e.g. Newport Garage)"
                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleCreateProject}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Create
              </button>
            </div>
            {projects.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-8">No projects yet. Create one above.</p>
            )}
            <div className="space-y-2">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setActiveProject(p); setScreen("levels"); }}
                  className="w-full text-left bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 transition-colors"
                >
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{p.levels?.length ?? 0} levels • Created {new Date(p.created_at).toLocaleDateString()}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Level management */}
        {screen === "levels" && activeProject && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{activeProject.name} — Levels</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setScreen("upload")}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  + Upload Floor Plan
                </button>
                {activeProject.levels.some((l) => l.parse_status === "complete") && (
                  <button
                    onClick={() => launchSimulation()}
                    className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    ▶ Launch Simulation
                  </button>
                )}
              </div>
            </div>

            {activeProject.levels.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <div className="text-5xl mb-4">📐</div>
                <p className="text-sm">Upload a floor plan to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeProject.levels.map((level) => (
                  <div
                    key={level.id}
                    className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 flex items-center gap-4"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{level.display_name}</div>
                      <div className="text-xs text-gray-400">Elevation: {level.floor_elevation}m</div>
                    </div>
                    <StatusBadge status={level.parse_status} />
                    {level.parse_status === "needs_review" && (
                      <button
                        onClick={() => { setReviewLevel(level); setScreen("review"); }}
                        className="text-xs bg-yellow-700 hover:bg-yellow-600 text-white px-3 py-1.5 rounded-lg"
                      >
                        Review
                      </button>
                    )}
                    {level.parse_status === "complete" && (
                      <button
                        onClick={() => launchSimulation(level.id)}
                        className="text-xs bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg"
                      >
                        ▶ Drive
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upload screen */}
        {screen === "upload" && activeProject && (
          <div className="max-w-xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setScreen("levels")} className="text-gray-400 hover:text-white text-sm">
                ← Back
              </button>
              <h2 className="text-xl font-semibold">Upload Floor Plan</h2>
            </div>
            <div className="bg-gray-800/30 border border-gray-700 rounded-2xl p-6">
              <FloorPlanUploader
                projectId={activeProject.id}
                onUploaded={handleUploaded}
              />
            </div>
          </div>
        )}

        {/* Review screen */}
        {screen === "review" && activeProject && reviewLevel && (
          <div className="max-w-5xl mx-auto h-[calc(100vh-10rem)] flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setScreen("levels")} className="text-gray-400 hover:text-white text-sm">
                ← Back
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <FloorPlanReviewer
                projectId={activeProject.id}
                level={reviewLevel}
                onApprove={() => setScreen("levels")}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-gray-700 text-gray-300",
    processing: "bg-blue-800 text-blue-200 animate-pulse",
    needs_review: "bg-yellow-800 text-yellow-200",
    complete: "bg-green-800 text-green-200",
    failed: "bg-red-800 text-red-200",
  };
  const labels: Record<string, string> = {
    pending: "Pending",
    processing: "Processing...",
    needs_review: "Needs Review",
    complete: "Ready",
    failed: "Failed",
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${styles[status] ?? styles.pending}`}>
      {labels[status] ?? status}
    </span>
  );
}

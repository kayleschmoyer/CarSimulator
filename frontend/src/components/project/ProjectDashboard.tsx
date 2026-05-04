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

  useEffect(() => { fetchProjects(); }, []);

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
    // Spawn in the first driving lane centre if no entry point defined
    const defaultSpawn = { x: 50, y: 15 };
    const spawn: SimulationSpawnPoint = {
      level_id: startLevel.id,
      position: entryPoint?.position ?? defaultSpawn,
      elevation: startLevel.floor_elevation,
      direction: entryPoint?.direction ?? Math.PI,
    };
    startSimulation(approvedLevels, spawn);
    setScreen("sim");
  };

  if (simActive && screen === "sim") {
    return <SimulationCanvas onExit={() => { stopSimulation(); setScreen("levels"); }} />;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface)" }}
        className="px-8 py-4 flex items-center gap-4 sticky top-0 z-20 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
            style={{ background: "linear-gradient(135deg, #3b82f6, #06b6d4)" }}>
            P
          </div>
          <div>
            <div className="font-semibold text-sm tracking-tight" style={{ color: "var(--text-primary)" }}>
              Garage Simulator
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              Parking Garage Validation Tool
            </div>
          </div>
        </div>

        {activeProject && (
          <div className="flex items-center gap-2 ml-2">
            <span style={{ color: "var(--text-muted)" }}>/</span>
            <button
              onClick={() => setScreen("levels")}
              className="text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: "var(--cyan)" }}
            >
              {activeProject.name}
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 p-8 overflow-y-auto">

        {/* ── Projects ── */}
        {screen === "projects" && (
          <div className="max-w-2xl mx-auto space-y-8">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight mb-1" style={{ color: "var(--text-primary)" }}>
                Projects
              </h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Each project holds one or more floor plan levels.
              </p>
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                placeholder="Project name — e.g. Newport Parking Garage"
                className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              />
              <button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                Create
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="text-center py-20" style={{ color: "var(--text-muted)" }}>
                <div className="text-5xl mb-4 opacity-30">🏗</div>
                <p className="text-sm">No projects yet. Create one above to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setActiveProject(p); setScreen("levels"); }}
                    className="w-full text-left rounded-2xl px-5 py-4 transition-all group"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                        {p.name}
                      </div>
                      <svg className="w-4 h-4 opacity-30 group-hover:opacity-60 transition-opacity"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      {p.levels?.length ?? 0} level{(p.levels?.length ?? 0) !== 1 ? "s" : ""} · Created {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Levels ── */}
        {screen === "levels" && activeProject && (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
                  {activeProject.name}
                </h1>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                  Manage floor plan levels and launch the simulation.
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setScreen("upload")}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  + Upload Floor Plan
                </button>
                {activeProject.levels.some((l) => l.parse_status === "complete") && (
                  <button
                    onClick={() => launchSimulation()}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-all text-white"
                    style={{ background: "linear-gradient(135deg, #3b82f6, #06b6d4)" }}
                  >
                    ▶ Launch Simulation
                  </button>
                )}
              </div>
            </div>

            {activeProject.levels.length === 0 ? (
              <div className="rounded-2xl p-16 text-center"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="text-4xl mb-4 opacity-30">📐</div>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Upload a floor plan to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeProject.levels.map((level) => (
                  <div
                    key={level.id}
                    className="rounded-2xl px-5 py-4 flex items-center gap-4"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
                        {level.display_name}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        Elevation: {level.floor_elevation}m
                      </div>
                      {level.parse_status === "failed" && (level as any).parse_error && (
                        <div className="text-xs mt-1 font-mono break-all" style={{ color: "#fca5a5" }}>
                          {(level as any).parse_error}
                        </div>
                      )}
                    </div>
                    <StatusBadge status={level.parse_status} />
                    {level.parse_status === "needs_review" && (
                      <button
                        onClick={() => { setReviewLevel(level); setScreen("review"); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{ background: "#78350f", color: "#fde68a", border: "1px solid #92400e" }}
                      >
                        Review
                      </button>
                    )}
                    {level.parse_status === "complete" && (
                      <button
                        onClick={() => launchSimulation(level.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all"
                        style={{ background: "linear-gradient(135deg, #3b82f6, #06b6d4)" }}
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

        {/* ── Upload ── */}
        {screen === "upload" && activeProject && (
          <div className="max-w-xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <button
                onClick={() => setScreen("levels")}
                className="text-sm transition-colors flex items-center gap-1"
                style={{ color: "var(--text-secondary)" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                Upload Floor Plan
              </h2>
            </div>
            <div className="rounded-2xl p-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <FloorPlanUploader projectId={activeProject.id} onUploaded={handleUploaded} />
            </div>
          </div>
        )}

        {/* ── Review ── */}
        {screen === "review" && activeProject && reviewLevel && (
          <div className="max-w-5xl mx-auto" style={{ height: "calc(100vh - 9rem)" }}>
            <div className="flex items-center gap-3 mb-5">
              <button
                onClick={() => setScreen("levels")}
                className="text-sm transition-colors flex items-center gap-1"
                style={{ color: "var(--text-secondary)" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            </div>
            <div className="h-full">
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
  const config: Record<string, { bg: string; text: string; label: string }> = {
    pending:      { bg: "#1f2937", text: "#9ca3af", label: "Pending" },
    processing:   { bg: "#1e3a5f", text: "#93c5fd", label: "Processing…" },
    needs_review: { bg: "#78350f", text: "#fde68a", label: "Needs Review" },
    complete:     { bg: "#064e3b", text: "#6ee7b7", label: "Ready" },
    failed:       { bg: "#7f1d1d", text: "#fca5a5", label: "Failed" },
  };
  const c = config[status] ?? config.pending;
  return (
    <span
      className={`text-xs px-2.5 py-1 rounded-full font-medium ${status === "processing" ? "animate-pulse" : ""}`}
      style={{ background: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  );
}

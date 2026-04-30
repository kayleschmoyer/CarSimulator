import { useSimulationStore } from "../../store/simulationStore";
import { useNotificationStore } from "../../store/notificationStore";

const typeAccent: Record<string, string> = {
  camera: "#10b981",
  sign:   "#3b82f6",
  ramp:   "#f59e0b",
  entry:  "#8b5cf6",
  exit:   "#ef4444",
};

const typeIcon: Record<string, string> = {
  camera: "◉",
  sign:   "▣",
  ramp:   "⬆",
  entry:  "→",
  exit:   "✕",
};

export default function HUD() {
  const { carSpeed, currentLevelId, levels } = useSimulationStore();
  const { notifications, dismissNotification } = useNotificationStore();

  const currentLevel = levels.find((l) => l.id === currentLevelId);
  const speedKph = Math.round(Math.abs(carSpeed) * 3.6);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">

      {/* Speed + level — bottom center */}
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 flex items-end gap-3">
        <div className="rounded-2xl px-5 py-3 text-center"
          style={{ background: "rgba(7,11,18,0.82)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
          <div className="text-3xl font-bold tabular-nums leading-none" style={{ color: "#f0f4ff", fontFamily: "Inter, sans-serif" }}>
            {speedKph}
          </div>
          <div className="text-xs mt-1 font-medium uppercase tracking-widest" style={{ color: "#3d4f6e" }}>
            km/h
          </div>
        </div>
        {currentLevel && (
          <div className="rounded-2xl px-4 py-3 text-center"
            style={{ background: "rgba(7,11,18,0.82)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
            <div className="text-sm font-semibold" style={{ color: "#f0f4ff" }}>{currentLevel.display_name}</div>
            <div className="text-xs mt-0.5" style={{ color: "#3d4f6e" }}>Elev. {currentLevel.floor_elevation}m</div>
          </div>
        )}
      </div>

      {/* Controls — bottom left */}
      <div className="absolute bottom-7 left-7 rounded-xl px-3 py-2.5 space-y-0.5"
        style={{ background: "rgba(7,11,18,0.75)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(10px)" }}>
        {[["W / ↑", "Accelerate"], ["S / ↓", "Brake / Reverse"], ["A D / ← →", "Steer"]].map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span className="font-medium" style={{ color: "rgba(255,255,255,0.55)", minWidth: 60 }}>{k}</span>
            <span style={{ color: "#3d4f6e" }}>{v}</span>
          </div>
        ))}
        <div className="text-xs pt-1 border-t" style={{ color: "#3d4f6e", borderColor: "rgba(255,255,255,0.06)" }}>
          ESC — Exit
        </div>
      </div>

      {/* Notifications — right side */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 w-72 pointer-events-auto">
        {notifications.map((n) => {
          const accent = typeAccent[n.type] ?? "#94a3b8";
          return (
            <div
              key={n.id}
              className="rounded-2xl px-4 py-3.5 animate-slide-in cursor-pointer"
              style={{
                background: "rgba(13,20,32,0.92)",
                border: `1px solid ${accent}40`,
                borderLeft: `3px solid ${accent}`,
                backdropFilter: "blur(16px)",
              }}
              onClick={() => dismissNotification(n.id)}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base" style={{ color: accent }}>{typeIcon[n.type] ?? "i"}</span>
                <span className="font-semibold text-sm" style={{ color: "#eef2ff" }}>{n.title}</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "#7c8db0" }}>{n.body}</p>
            </div>
          );
        })}
      </div>

      {/* Crosshair */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-6 h-6">
          <div className="absolute top-1/2 left-0 w-full h-px -translate-y-1/2" style={{ background: "rgba(255,255,255,0.25)" }} />
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2" style={{ background: "rgba(255,255,255,0.25)" }} />
          <div className="absolute inset-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "rgba(255,255,255,0.5)" }} />
        </div>
      </div>
    </div>
  );
}

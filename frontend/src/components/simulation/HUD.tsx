import { useSimulationStore } from "../../store/simulationStore";
import { useNotificationStore } from "../../store/notificationStore";

const typeIcon: Record<string, string> = {
  camera: "📷",
  sign: "🪧",
  ramp: "⬆️",
  entry: "🚗",
  exit: "🏁",
};

const typeColor: Record<string, string> = {
  camera: "border-green-400 bg-green-950/80",
  sign: "border-blue-400 bg-blue-950/80",
  ramp: "border-yellow-400 bg-yellow-950/80",
  entry: "border-purple-400 bg-purple-950/80",
  exit: "border-red-400 bg-red-950/80",
};

export default function HUD() {
  const { carSpeed, currentLevelId, levels } = useSimulationStore();
  const { notifications, dismissNotification } = useNotificationStore();

  const currentLevel = levels.find((l) => l.id === currentLevelId);
  const speedKph = Math.round(Math.abs(carSpeed) * 3.6);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      {/* Speed + level indicator — bottom center */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
        <div className="bg-black/70 border border-white/20 rounded-xl px-5 py-2 text-center">
          <div className="text-2xl font-bold tabular-nums text-white">{speedKph}</div>
          <div className="text-xs text-gray-400 uppercase tracking-wider">km/h</div>
        </div>
        {currentLevel && (
          <div className="bg-black/70 border border-white/20 rounded-xl px-4 py-2 text-center">
            <div className="text-sm font-semibold text-white">{currentLevel.display_name}</div>
            <div className="text-xs text-gray-400">Elevation {currentLevel.floor_elevation}m</div>
          </div>
        )}
      </div>

      {/* Controls reminder — bottom left */}
      <div className="absolute bottom-6 left-6 bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-400">
        <div>W / ↑ — Accelerate</div>
        <div>S / ↓ — Brake / Reverse</div>
        <div>A D / ← → — Steer</div>
        <div className="mt-1 text-white/40">ESC — Exit simulation</div>
      </div>

      {/* Camera/Sign notifications — right side */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 w-72 pointer-events-auto">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`border rounded-xl px-4 py-3 backdrop-blur-sm transition-all animate-slide-in ${typeColor[n.type] ?? "border-gray-500 bg-gray-900/80"}`}
            onClick={() => dismissNotification(n.id)}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{typeIcon[n.type] ?? "ℹ️"}</span>
              <span className="font-semibold text-white text-sm">{n.title}</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">{n.body}</p>
          </div>
        ))}
      </div>

      {/* Crosshair */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-6 h-6">
          <div className="absolute top-1/2 left-0 w-full h-px bg-white/30 -translate-y-1/2" />
          <div className="absolute left-1/2 top-0 h-full w-px bg-white/30 -translate-x-1/2" />
          <div className="absolute inset-1/2 w-1 h-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60" />
        </div>
      </div>
    </div>
  );
}

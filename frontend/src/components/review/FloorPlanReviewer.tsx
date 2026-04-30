import { useState, useRef } from "react";
import type { GarageLevel, CameraFeature, SignFeature } from "../../types/garage";
import { useProjectStore } from "../../store/projectStore";

interface Props {
  projectId: string;
  level: GarageLevel;
  onApprove: () => void;
}

type PlacementMode = "none" | "camera" | "sign";

function resolveImageUrl(rawUrl: string): string | null {
  if (!rawUrl) return null;
  // Normalize Windows backslashes and find the /uploads/ segment
  const normalized = rawUrl.replace(/\\/g, "/");
  const idx = normalized.indexOf("/uploads/");
  if (idx !== -1) return normalized.substring(idx);
  // Fallback: if the path literally starts at uploads dir, prepend
  const uploadsIdx = normalized.indexOf("uploads/");
  if (uploadsIdx !== -1) return "/" + normalized.substring(uploadsIdx);
  return null;
}

export default function FloorPlanReviewer({ projectId, level, onApprove }: Props) {
  const { updateLevelFeatures, markLevelApproved } = useProjectStore();
  const [cameras, setCameras] = useState<CameraFeature[]>(level.features.cameras);
  const [signs, setSigns] = useState<SignFeature[]>(level.features.signs);

  const isDemoMode = cameras.some((c) => c.source === "mock") || signs.some((s) => (s as any).source === "mock");
  const [placement, setPlacement] = useState<PlacementMode>("none");
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const imageUrl = resolveImageUrl(level.processed_image_url) ??
                   resolveImageUrl(level.source_image_url);

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (placement === "none" || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    const pxX = relX * imgRef.current.naturalWidth;
    const pxY = relY * imgRef.current.naturalHeight;
    const mX = (pxX - level.origin_pixel.x) * level.scale_meters_per_pixel;
    const mY = (pxY - level.origin_pixel.y) * level.scale_meters_per_pixel;

    if (placement === "camera") {
      setCameras((prev) => [...prev, {
        id: `cam_manual_${Date.now()}`,
        position: { x: mX, y: mY },
        elevation: 2.2, coverage_angle: 90, facing_direction: 0,
        source: "manual", confidence: 1.0, notes: "Manually placed",
      }]);
    } else {
      setSigns((prev) => [...prev, {
        id: `sign_manual_${Date.now()}`,
        position: { x: mX, y: mY },
        elevation: 2.0, type: "unknown", text: "",
        source: "manual", confidence: 1.0,
      }]);
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      await updateLevelFeatures(projectId, level.id, { cameras, signs });
      markLevelApproved(projectId, level.id);
      onApprove();
    } finally {
      setSaving(false);
    }
  };

  const confColor = (c: number) =>
    c > 0.85 ? { bg: "rgba(16,185,129,0.15)", text: "#6ee7b7" }
    : c > 0.6 ? { bg: "rgba(251,191,36,0.15)", text: "#fde68a" }
    : { bg: "rgba(239,68,68,0.15)", text: "#fca5a5" };

  return (
    <div className="flex flex-col h-full gap-5">

      {/* Demo mode banner */}
      {isDemoMode && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-3"
          style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.35)" }}>
          <span className="text-lg leading-none mt-0.5">⚠</span>
          <div>
            <div className="text-sm font-semibold" style={{ color: "#fbbf24" }}>Demo Mode — Simulated Detections</div>
            <div className="text-xs mt-0.5" style={{ color: "#92400e", color: "#d97706" }}>
              No API key is set, so these cameras and signs are <strong>pre-built demo data</strong> — they do not reflect your uploaded drawing.
              Add <code className="px-1 rounded text-xs" style={{ background: "rgba(0,0,0,0.3)" }}>ANTHROPIC_API_KEY</code> to <code className="px-1 rounded text-xs" style={{ background: "rgba(0,0,0,0.3)" }}>backend/.env</code> for real AI detection.
              You can still drive the demo simulation below.
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {level.display_name} — Review Detections
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Verify detected cameras and signs, add missing ones, then approve.
          </p>
        </div>
        <div className="flex gap-2">
          {(["camera", "sign"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setPlacement((p) => (p === mode ? "none" : mode))}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: placement === mode
                  ? (mode === "camera" ? "rgba(16,185,129,0.2)" : "rgba(59,130,246,0.2)")
                  : "var(--bg-elevated)",
                border: `1px solid ${placement === mode
                  ? (mode === "camera" ? "#10b981" : "var(--accent)")
                  : "var(--border)"}`,
                color: placement === mode
                  ? (mode === "camera" ? "#10b981" : "#93c5fd")
                  : "var(--text-secondary)",
              }}
            >
              + {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Floor plan image with SVG overlay */}
      <div
        className="relative flex-1 min-h-0 overflow-hidden rounded-2xl"
        style={{
          border: `1px solid ${placement !== "none" ? "#f59e0b" : "var(--border)"}`,
          background: "var(--bg-elevated)",
          cursor: placement !== "none" ? "crosshair" : "default",
        }}
        onClick={handleImageClick}
      >
        {imageUrl ? (
          <>
            <img
              ref={imgRef}
              src={imageUrl}
              alt={level.display_name}
              className="w-full h-full object-contain"
              style={{ display: "block" }}
            />
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {cameras.map((cam) => {
                const rw = imgRef.current?.naturalWidth || 1;
                const rh = imgRef.current?.naturalHeight || 1;
                const rx = ((cam.position.x / level.scale_meters_per_pixel + level.origin_pixel.x) / rw) * 100;
                const ry = ((cam.position.y / level.scale_meters_per_pixel + level.origin_pixel.y) / rh) * 100;
                const col = cam.source === "manual" ? "#10b981" : cam.confidence > 0.85 ? "#10b981" : cam.confidence > 0.6 ? "#f59e0b" : "#ef4444";
                return (
                  <g key={cam.id} transform={`translate(${rx}%, ${ry}%)`}>
                    <circle r="7" fill={col} fillOpacity="0.25" stroke={col} strokeWidth="1.5" />
                    <line x1="0" y1="-10" x2="0" y2="-4" stroke={col} strokeWidth="1.5" />
                    <text y="-13" fontSize="5.5" fill={col} textAnchor="middle" fontFamily="Inter,sans-serif">CAM</text>
                  </g>
                );
              })}
              {signs.map((sign) => {
                const rw = imgRef.current?.naturalWidth || 1;
                const rh = imgRef.current?.naturalHeight || 1;
                const rx = ((sign.position.x / level.scale_meters_per_pixel + level.origin_pixel.x) / rw) * 100;
                const ry = ((sign.position.y / level.scale_meters_per_pixel + level.origin_pixel.y) / rh) * 100;
                return (
                  <g key={sign.id} transform={`translate(${rx}%, ${ry}%)`}>
                    <rect x="-9" y="-6" width="18" height="12" fill="rgba(59,130,246,0.3)" stroke="#3b82f6" strokeWidth="1.5" rx="2" />
                    <text fontSize="5" fill="#93c5fd" textAnchor="middle" dy="2" fontFamily="Inter,sans-serif">SGN</text>
                  </g>
                );
              })}
            </svg>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-sm" style={{ color: "var(--text-muted)" }}>
            No floor plan image available
          </div>
        )}
        {placement !== "none" && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs pointer-events-none font-medium"
            style={{ background: "rgba(245,158,11,0.9)", color: "#000" }}>
            Click to place {placement}
          </div>
        )}
      </div>

      {/* Feature lists */}
      <div className="grid grid-cols-2 gap-4 max-h-36 overflow-y-auto">
        {[
          { label: "Cameras", items: cameras, remove: (id: string) => setCameras(p => p.filter(c => c.id !== id)), getLabel: (c: CameraFeature) => c.source === "manual" ? "Manual" : c.source === "mock" ? "Demo" : "Auto", getConf: (c: CameraFeature) => c.confidence },
          { label: "Signs", items: signs, remove: (id: string) => setSigns(p => p.filter(s => s.id !== id)), getLabel: (s: SignFeature) => s.text || s.type, getConf: (s: SignFeature) => s.confidence },
        ].map(({ label, items, remove, getLabel, getConf }) => (
          <div key={label}>
            <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
              {label} ({items.length})
            </div>
            <div className="space-y-1">
              {items.map((item: any) => {
                const cc = confColor(getConf(item));
                return (
                  <div key={item.id}
                    className="flex items-center justify-between rounded-lg px-3 py-1.5"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded"
                        style={{ background: cc.bg, color: cc.text }}>
                        {Math.round(getConf(item) * 100)}%
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{getLabel(item)}</span>
                    </div>
                    <button onClick={() => remove(item.id)}
                      className="text-xs transition-colors hover:opacity-80"
                      style={{ color: "var(--text-muted)" }}>✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleApprove}
        disabled={saving}
        className="w-full rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-50 text-white"
        style={{ background: "linear-gradient(135deg, #3b82f6, #06b6d4)" }}
      >
        {saving ? "Saving…" : "Approve & Launch Simulation →"}
      </button>
    </div>
  );
}

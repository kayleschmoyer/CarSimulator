import { useState, useRef } from "react";
import type { GarageLevel, CameraFeature, SignFeature } from "../../types/garage";
import { useProjectStore } from "../../store/projectStore";

interface Props {
  projectId: string;
  level: GarageLevel;
  onApprove: () => void;
}

type PlacementMode = "none" | "camera" | "sign";

export default function FloorPlanReviewer({ projectId, level, onApprove }: Props) {
  const { updateLevelFeatures, markLevelApproved } = useProjectStore();
  const [cameras, setCameras] = useState<CameraFeature[]>(level.features.cameras);
  const [signs, setSigns] = useState<SignFeature[]>(level.features.signs);
  const [placement, setPlacement] = useState<PlacementMode>("none");
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const imageUrl = level.processed_image_url
    ? `/uploads/${level.processed_image_url.split("/uploads/").pop()}`
    : level.source_image_url
    ? `/uploads/${level.source_image_url.split("/uploads/").pop()}`
    : null;

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (placement === "none" || !imgRef.current) return;

    const rect = imgRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    // Convert relative position to meter coords using scale
    const imgW = imgRef.current.naturalWidth;
    const imgH = imgRef.current.naturalHeight;
    const pxX = relX * imgW;
    const pxY = relY * imgH;
    const mX = (pxX - level.origin_pixel.x) * level.scale_meters_per_pixel;
    const mY = (pxY - level.origin_pixel.y) * level.scale_meters_per_pixel;

    if (placement === "camera") {
      const newCam: CameraFeature = {
        id: `cam_manual_${Date.now()}`,
        position: { x: mX, y: mY },
        elevation: 2.2,
        coverage_angle: 90,
        facing_direction: 0,
        source: "manual",
        confidence: 1.0,
        notes: "Manually placed",
      };
      setCameras((prev) => [...prev, newCam]);
    } else if (placement === "sign") {
      const newSign: SignFeature = {
        id: `sign_manual_${Date.now()}`,
        position: { x: mX, y: mY },
        elevation: 2.0,
        type: "unknown",
        text: "",
        source: "manual",
        confidence: 1.0,
      };
      setSigns((prev) => [...prev, newSign]);
    }
  };

  const removeCamera = (id: string) => setCameras((prev) => prev.filter((c) => c.id !== id));
  const removeSign = (id: string) => setSigns((prev) => prev.filter((s) => s.id !== id));

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

  const confidenceBadge = (conf: number) =>
    conf > 0.85 ? "bg-green-800 text-green-200" : conf > 0.6 ? "bg-yellow-800 text-yellow-200" : "bg-red-800 text-red-200";

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{level.display_name} — Review Detections</h2>
          <p className="text-xs text-gray-400">Verify detected cameras and signs, add missing ones, then approve.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPlacement((p) => (p === "camera" ? "none" : "camera"))}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${placement === "camera" ? "bg-green-600 border-green-500 text-white" : "bg-gray-800 border-gray-600 text-gray-300 hover:border-green-500"}`}
          >
            + Camera
          </button>
          <button
            onClick={() => setPlacement((p) => (p === "sign" ? "none" : "sign"))}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${placement === "sign" ? "bg-blue-600 border-blue-500 text-white" : "bg-gray-800 border-gray-600 text-gray-300 hover:border-blue-500"}`}
          >
            + Sign
          </button>
        </div>
      </div>

      {/* Floor plan image with SVG overlay */}
      <div
        className={`relative flex-1 min-h-0 overflow-hidden rounded-xl border ${placement !== "none" ? "border-yellow-500 cursor-crosshair" : "border-gray-700"}`}
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
            {/* SVG overlay for detected features */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ mixBlendMode: "normal" }}>
              {cameras.map((cam) => {
                const relX = ((cam.position.x / level.scale_meters_per_pixel + level.origin_pixel.x) / (imgRef.current?.naturalWidth || 1)) * 100;
                const relY = ((cam.position.y / level.scale_meters_per_pixel + level.origin_pixel.y) / (imgRef.current?.naturalHeight || 1)) * 100;
                const color = cam.source === "manual" ? "#00ff88" : cam.confidence > 0.85 ? "#00cc66" : cam.confidence > 0.6 ? "#ffaa00" : "#ff4444";
                return (
                  <g key={cam.id} transform={`translate(${relX}%, ${relY}%)`}>
                    <circle r="8" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="2" />
                    <line x1="0" y1="-12" x2="0" y2="-5" stroke={color} strokeWidth="2" />
                    <text y="-14" fontSize="6" fill={color} textAnchor="middle">CAM</text>
                  </g>
                );
              })}
              {signs.map((sign) => {
                const relX = ((sign.position.x / level.scale_meters_per_pixel + level.origin_pixel.x) / (imgRef.current?.naturalWidth || 1)) * 100;
                const relY = ((sign.position.y / level.scale_meters_per_pixel + level.origin_pixel.y) / (imgRef.current?.naturalHeight || 1)) * 100;
                return (
                  <g key={sign.id} transform={`translate(${relX}%, ${relY}%)`}>
                    <rect x="-8" y="-5" width="16" height="10" fill="#0055cc" fillOpacity="0.4" stroke="#4488ff" strokeWidth="1.5" rx="2" />
                    <text fontSize="5" fill="#aaccff" textAnchor="middle" dy="2">SGN</text>
                  </g>
                );
              })}
            </svg>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No floor plan image available
          </div>
        )}
        {placement !== "none" && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-yellow-900/90 border border-yellow-600 rounded-full px-4 py-1 text-xs text-yellow-200 pointer-events-none">
            Click to place {placement}
          </div>
        )}
      </div>

      {/* Feature lists */}
      <div className="grid grid-cols-2 gap-4 max-h-40 overflow-y-auto">
        <div>
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            Cameras ({cameras.length})
          </h3>
          <div className="space-y-1">
            {cameras.map((cam) => (
              <div key={cam.id} className="flex items-center justify-between bg-gray-800/50 rounded px-2 py-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 rounded ${confidenceBadge(cam.confidence)}`}>
                    {Math.round(cam.confidence * 100)}%
                  </span>
                  <span className="text-xs text-gray-300">{cam.source === "manual" ? "Manual" : "Auto"}</span>
                </div>
                <button onClick={() => removeCamera(cam.id)} className="text-gray-500 hover:text-red-400 text-xs">✕</button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            Signs ({signs.length})
          </h3>
          <div className="space-y-1">
            {signs.map((sign) => (
              <div key={sign.id} className="flex items-center justify-between bg-gray-800/50 rounded px-2 py-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 rounded ${confidenceBadge(sign.confidence)}`}>
                    {Math.round(sign.confidence * 100)}%
                  </span>
                  <span className="text-xs text-gray-300">{sign.text || sign.type}</span>
                </div>
                <button onClick={() => removeSign(sign.id)} className="text-gray-500 hover:text-red-400 text-xs">✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={handleApprove}
        disabled={saving}
        className="w-full bg-green-700 hover:bg-green-600 disabled:bg-gray-700 text-white font-semibold rounded-xl py-3 transition-colors"
      >
        {saving ? "Saving..." : "Approve & Launch Simulation →"}
      </button>
    </div>
  );
}

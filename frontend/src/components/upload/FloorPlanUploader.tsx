import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useProjectStore } from "../../store/projectStore";
import { api } from "../../lib/api/client";

interface Props {
  projectId: string;
  onUploaded: () => void;
}

const ACCEPTED_TYPES = { "image/*": [".png", ".bmp", ".jpg", ".jpeg"], "application/pdf": [".pdf"] };

export default function FloorPlanUploader({ projectId, onUploaded }: Props) {
  const { uploadLevel, refreshLevel } = useProjectStore();
  const [displayName, setDisplayName] = useState("");
  const [elevation, setElevation] = useState(0);
  const [elevationStep, setElevationStep] = useState(3.0);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ stage: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    if (!accepted[0]) return;
    setFile(accepted[0]);
    const isPdf = accepted[0].name.toLowerCase().endsWith(".pdf");
    if (isPdf) setBatchMode(true);
    else setBatchMode(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: ACCEPTED_TYPES, maxFiles: 1, maxSize: 100 * 1024 * 1024,
  });

  const pollUntilDone = (levelIds: string[]) => {
    let remaining = new Set(levelIds);
    pollRef.current = setInterval(async () => {
      for (const id of [...remaining]) {
        try {
          await refreshLevel(projectId, id);
          const updated = useProjectStore.getState().activeProject?.levels.find((l) => l.id === id);
          if (!updated) continue;
          if (updated.parse_status === "needs_review" || updated.parse_status === "complete" || updated.parse_status === "failed") {
            remaining.delete(id);
          }
        } catch {}
      }
      if (remaining.size === 0) {
        clearInterval(pollRef.current!);
        setUploading(false);
        onUploaded();
      }
    }, 2500);
  };

  const handleUpload = async () => {
    if (!file) return;
    if (!batchMode && !displayName.trim()) return;
    setUploading(true);
    setError(null);

    try {
      if (batchMode) {
        setProgress({ stage: "Upload", message: "Uploading PDF…" });
        const form = new FormData();
        form.append("file", file);
        form.append("base_name", displayName.trim() || "Level");
        form.append("base_elevation", String(elevation));
        form.append("elevation_step", String(elevationStep));
        const levels = await api.postForm<{ id: string }[]>(
          `/projects/${projectId}/levels/batch`, form
        );
        setProgress({ stage: "Processing", message: `Parsing ${levels.length} levels with AI — this may take a few minutes…` });
        pollUntilDone(levels.map((l) => l.id));
      } else {
        setProgress({ stage: "Upload", message: "Uploading file…" });
        const level = await uploadLevel(projectId, displayName, elevation, file);
        setProgress({ stage: "Processing", message: "Analyzing floor plan — this may take 1–2 minutes…" });
        pollUntilDone([level.id]);
      }
    } catch (e) {
      setError(String(e));
      setUploading(false);
    }
  };

  const isPdf = file?.name.toLowerCase().endsWith(".pdf");

  const inputStyle = {
    background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)",
  } as React.CSSProperties;

  return (
    <div className="space-y-5">

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className="rounded-2xl p-10 text-center cursor-pointer transition-all"
        style={{
          border: `2px dashed ${file ? "#10b981" : isDragActive ? "var(--accent)" : "var(--border-hover)"}`,
          background: file ? "rgba(16,185,129,0.05)" : isDragActive ? "rgba(59,130,246,0.07)" : "var(--bg-elevated)",
        }}
      >
        <input {...getInputProps()} />
        {file ? (
          <div>
            <div className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center text-lg"
              style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>✓</div>
            <div className="text-sm font-medium" style={{ color: "#10b981" }}>{file.name}</div>
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {(file.size / 1024 / 1024).toFixed(1)} MB
              {isPdf && <span className="ml-2 px-1.5 py-0.5 rounded text-xs" style={{ background: "rgba(59,130,246,0.2)", color: "#93c5fd" }}>PDF</span>}
            </div>
          </div>
        ) : (
          <div>
            <div className="text-3xl mb-3 opacity-40">📐</div>
            <div className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Drop floor plan here or click to browse
            </div>
            <div className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
              PDF (multi-page), PNG, BMP, JPG · up to 100 MB
            </div>
          </div>
        )}
      </div>

      {/* PDF batch toggle */}
      {isPdf && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-3"
          style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
          <input
            type="checkbox"
            id="batchMode"
            checked={batchMode}
            onChange={(e) => setBatchMode(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-blue-500"
          />
          <div>
            <label htmlFor="batchMode" className="text-sm font-medium cursor-pointer" style={{ color: "var(--text-primary)" }}>
              Import all pages as separate levels
            </label>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Each page of the PDF becomes a floor level (Level 02, 03…). AI parses all of them automatically.
            </p>
          </div>
        </div>
      )}

      {/* Fields */}
      <div className={`grid gap-4 ${batchMode ? "grid-cols-3" : "grid-cols-2"}`}>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {batchMode ? "Base Name" : "Level Name"}
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={batchMode ? "Level" : "e.g. Level 02"}
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
            style={inputStyle}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {batchMode ? "Start Elevation (m)" : "Floor Elevation (m)"}
          </label>
          <input
            type="number" value={elevation} onChange={(e) => setElevation(Number(e.target.value))} step={0.5}
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
            style={inputStyle}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          />
        </div>
        {batchMode && (
          <div className="space-y-1.5">
            <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Floor Height (m)
            </label>
            <input
              type="number" value={elevationStep} onChange={(e) => setElevationStep(Number(e.target.value))} step={0.5}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
          </div>
        )}
      </div>

      {progress && (
        <div className="rounded-xl px-4 py-3"
          style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--cyan)" }}>
              {progress.stage}
            </span>
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{progress.message}</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
          {error}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || (!batchMode && !displayName.trim()) || uploading}
        className="w-full rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-40 text-white"
        style={{ background: "linear-gradient(135deg, #3b82f6, #06b6d4)" }}
      >
        {uploading ? "Processing…" : batchMode ? `Import All PDF Pages` : "Upload & Parse Floor Plan"}
      </button>
    </div>
  );
}

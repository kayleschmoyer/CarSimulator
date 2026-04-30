import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useProjectStore } from "../../store/projectStore";

interface Props {
  projectId: string;
  onUploaded: () => void;
}

const ACCEPTED_TYPES = { "image/*": [".png", ".bmp", ".jpg", ".jpeg"], "application/pdf": [".pdf"] };

export default function FloorPlanUploader({ projectId, onUploaded }: Props) {
  const { uploadLevel, refreshLevel } = useProjectStore();
  const [displayName, setDisplayName] = useState("");
  const [elevation, setElevation] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ stage: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024,
  });

  const handleUpload = async () => {
    if (!file || !displayName.trim()) return;
    setUploading(true);
    setError(null);
    setProgress({ stage: "Upload", message: "Uploading file…" });

    try {
      const level = await uploadLevel(projectId, displayName, elevation, file);
      setProgress({ stage: "Processing", message: "Analyzing floor plan — this may take 1–2 minutes…" });

      pollRef.current = setInterval(async () => {
        try {
          await refreshLevel(projectId, level.id);
          const updated = useProjectStore.getState().activeProject?.levels.find((l) => l.id === level.id);
          if (!updated) return;
          if (updated.parse_status === "needs_review" || updated.parse_status === "complete") {
            clearInterval(pollRef.current!);
            setUploading(false);
            onUploaded();
          } else if (updated.parse_status === "failed") {
            clearInterval(pollRef.current!);
            setUploading(false);
            setError("Parse failed — check that your API key is set, or try again.");
          }
        } catch {}
      }, 2500);
    } catch (e) {
      setError(String(e));
      setUploading(false);
    }
  };

  const inputStyle = {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
  } as React.CSSProperties;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Level Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Level 02"
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
            style={inputStyle}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Floor Elevation (m)
          </label>
          <input
            type="number"
            value={elevation}
            onChange={(e) => setElevation(Number(e.target.value))}
            step={0.5}
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
            style={inputStyle}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          />
        </div>
      </div>

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
            <div className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>
              ✓
            </div>
            <div className="text-sm font-medium" style={{ color: "#10b981" }}>{file.name}</div>
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {(file.size / 1024 / 1024).toFixed(1)} MB
            </div>
          </div>
        ) : (
          <div>
            <div className="text-3xl mb-3 opacity-40">📐</div>
            <div className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Drop floor plan here or click to browse
            </div>
            <div className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
              PDF, PNG, BMP, JPG · up to 100 MB
            </div>
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
        disabled={!file || !displayName.trim() || uploading}
        className="w-full rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #3b82f6, #06b6d4)", color: "#fff" }}
      >
        {uploading ? "Processing…" : "Upload & Parse Floor Plan"}
      </button>
    </div>
  );
}

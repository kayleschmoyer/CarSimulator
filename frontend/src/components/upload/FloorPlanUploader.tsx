import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useProjectStore } from "../../store/projectStore";
import { createParseProgressSocket } from "../../lib/api/client";

interface Props {
  projectId: string;
  onUploaded: () => void;
}

const ACCEPTED_TYPES = { "image/*": [".png", ".bmp", ".jpg", ".jpeg"], "application/pdf": [".pdf"] };

export default function FloorPlanUploader({ projectId, onUploaded }: Props) {
  const { uploadLevel } = useProjectStore();
  const [displayName, setDisplayName] = useState("");
  const [elevation, setElevation] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ stage: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setProgress({ stage: "upload", message: "Uploading file..." });

    try {
      const level = await uploadLevel(projectId, displayName, elevation, file);

      // Subscribe to parse progress via WebSocket
      const ws = createParseProgressSocket(level.id, (data) => {
        setProgress(data);
        if (data.stage === "complete") {
          ws.close();
          setUploading(false);
          onUploaded();
        } else if (data.stage === "failed") {
          ws.close();
          setUploading(false);
          setError(data.message);
        }
      });

      // Fallback: poll if WebSocket unavailable
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          setProgress({ stage: "processing", message: "Processing (parsing may take 1-2 minutes)..." });
          const poll = setInterval(async () => {
            try {
              const { refreshLevel } = useProjectStore.getState();
              await refreshLevel(projectId, level.id);
              const updated = useProjectStore.getState().activeProject?.levels.find((l) => l.id === level.id);
              if (updated?.parse_status === "needs_review" || updated?.parse_status === "complete") {
                clearInterval(poll);
                setUploading(false);
                onUploaded();
              }
            } catch {}
          }, 3000);
        }
      }, 1000);
    } catch (e) {
      setError(String(e));
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Level Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Level 02"
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Floor Elevation (m)</label>
          <input
            type="number"
            value={elevation}
            onChange={(e) => setElevation(Number(e.target.value))}
            step={0.5}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? "border-blue-400 bg-blue-950/30" : "border-gray-600 hover:border-gray-400"
        } ${file ? "border-green-500 bg-green-950/20" : ""}`}
      >
        <input {...getInputProps()} />
        {file ? (
          <div>
            <div className="text-green-400 text-sm font-medium">{file.name}</div>
            <div className="text-gray-500 text-xs mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
          </div>
        ) : (
          <div>
            <div className="text-4xl mb-2">📐</div>
            <div className="text-gray-300 text-sm">Drop floor plan here or click to browse</div>
            <div className="text-gray-500 text-xs mt-1">PDF, PNG, BMP, JPG — up to 100 MB</div>
          </div>
        )}
      </div>

      {progress && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            <span className="text-xs text-blue-300 font-medium uppercase tracking-wide">{progress.stage}</span>
          </div>
          <p className="text-sm text-gray-300 mt-1">{progress.message}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-950/50 border border-red-700 rounded-lg px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || !displayName.trim() || uploading}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
      >
        {uploading ? "Processing..." : "Upload & Parse Floor Plan"}
      </button>
    </div>
  );
}

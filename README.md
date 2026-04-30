# Garage Simulator

First-person parking garage simulation for validating camera placement and signage before construction.

Upload floor plan images (PDF, PNG, BMP) → AI parses the layout → drive through a 3D simulation → cameras and signs trigger notifications as you pass them.

---

## Quick Start (Windows / Mac / Linux)

### Requirements
- Python 3.11+
- Node.js 18+

No Docker, no Redis, no Celery required.

---

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
```

Copy the env file:
```bash
cp ../.env.example .env
# Optionally add ANTHROPIC_API_KEY — leave blank for demo mode
```

Start the server:
```bash
uvicorn app.main:app --reload
# → http://localhost:8000
```

> **Windows:** `uvicorn` works natively on Windows. No extra processes needed.

---

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

---

## Demo Mode (No API Key Required)

If `ANTHROPIC_API_KEY` is not set in `.env`, the app uses **demo mode**:
- Upload any image — a realistic pre-built garage layout is generated instead of parsing it
- All simulation features work: driving, cameras, signs, notifications
- Perfect for testing or sharing with people who don't have an API key

To enable real AI floor plan parsing:
```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## How to Use

1. **Create a project** — e.g. "Newport Parking Garage"
2. **Upload a floor plan** — PDF or image of one level at a time
3. **Set level name and elevation** — e.g. "Level 02" at 0m, "Level 03" at 3m
4. **Review detections** — cameras and signs overlaid on the floor plan; add/remove as needed
5. **Launch simulation** — drive with WASD or arrow keys
6. **Notifications** — camera and sign alerts appear as you approach them

### Controls
| Key | Action |
|-----|--------|
| W / ↑ | Accelerate |
| S / ↓ | Brake / Reverse |
| A / ← | Steer left |
| D / → | Steer right |
| ESC | Exit simulation |

---

## Architecture

```
backend/
  app/
    api/routes/          FastAPI endpoints
    services/parse_pipeline/
      ingest.py          PDF/image → PNG
      preprocess.py      OpenCV cleanup
      claude_geometry.py AI geometry extraction (walls, lanes, ramps)
      claude_features.py AI camera/sign detection
      ocr.py             Tesseract text labels
      coordinate_norm.py Pixel → meters
      graph_builder.py   Navigation graph
      mock_layout.py     Demo mode (no API key)
      orchestrator.py    Pipeline coordinator

frontend/src/
  components/simulation/
    CarController        Kinematic physics + raycast collision
    FloorLevel           3D geometry per floor
    GarageScene          Scene root + lighting
    HUD                  Speed + camera/sign notifications
  components/upload/     File upload UI
  components/review/     Detection review + manual placement
  components/project/    Project dashboard
  store/                 Zustand state
  lib/geometry/          Three.js geometry builders
```

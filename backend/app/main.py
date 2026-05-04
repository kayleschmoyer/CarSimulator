import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.api.routes import projects, levels, websocket

app = FastAPI(
    title="Parking Garage Simulator API",
    description="Floor plan parsing and garage simulation backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api")
app.include_router(levels.router, prefix="/api")
app.include_router(websocket.router)

# Serve processed images
os.makedirs(settings.upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/check-key")
def check_key():
    """Quick diagnostic — tests whether the API key is loaded and valid."""
    key = settings.anthropic_api_key
    if not key or key == "your-api-key-here":
        return {"ok": False, "error": "ANTHROPIC_API_KEY is not set in .env"}
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=key)
        # Minimal test call
        client.messages.create(
            model=settings.claude_model,
            max_tokens=10,
            messages=[{"role": "user", "content": "hi"}],
        )
        return {"ok": True, "model": settings.claude_model, "key_prefix": key[:16] + "..."}
    except Exception as e:
        return {"ok": False, "error": str(e), "key_prefix": key[:16] + "..."}

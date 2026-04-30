"""
WebSocket parse progress — simplified version using in-memory level status polling.
No Redis required. Frontend polls GET /levels/{id} every 2s instead.
Kept as a stub so the import in main.py doesn't break.
"""
from fastapi import APIRouter

router = APIRouter(tags=["websocket"])

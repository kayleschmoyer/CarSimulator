"""
WebSocket endpoint for streaming parse progress to the frontend.
Subscribes to Redis pub/sub channel for the given level ID.
"""
import asyncio
import json

import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import settings

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/parse/{level_id}")
async def parse_progress(websocket: WebSocket, level_id: str):
    await websocket.accept()
    r = aioredis.from_url(settings.redis_url)
    pubsub = r.pubsub()
    await pubsub.subscribe(f"parse:{level_id}")

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = message["data"]
                if isinstance(data, bytes):
                    data = data.decode()
                await websocket.send_text(data)
                parsed = json.loads(data)
                if parsed.get("stage") in ("complete", "failed"):
                    break
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(f"parse:{level_id}")
        await r.aclose()

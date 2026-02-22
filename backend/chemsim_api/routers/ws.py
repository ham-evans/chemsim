"""WebSocket endpoint for streaming calculation progress."""
import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from chemsim_api.services.computation import get_queue, remove_queue

router = APIRouter()


@router.websocket("/api/ws/calculations/{calc_id}")
async def calculation_ws(websocket: WebSocket, calc_id: str):
    await websocket.accept()

    q = get_queue(calc_id)
    if q is None:
        await websocket.send_json({"type": "error", "error": "No active calculation"})
        await websocket.close()
        return

    try:
        while True:
            try:
                msg = await asyncio.wait_for(q.get(), timeout=60.0)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "heartbeat"})
                continue

            await websocket.send_json(msg)

            if msg.get("type") in ("completed", "error"):
                break
    except WebSocketDisconnect:
        pass
    finally:
        remove_queue(calc_id)

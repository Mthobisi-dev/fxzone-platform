"""WebRTC signaling handler for live screen share and peer-to-peer audio/video routing."""
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from shared.database import AsyncSessionLocal
from shared.security import get_ws_user
from shared.websocket_manager import manager
from services.live_sessions.service import LiveSessionService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Live Session WebSockets"])


@router.websocket("/ws/rtc/signal/{session_id}")
async def rtc_signaling_endpoint(websocket: WebSocket, session_id: str):
    """WebRTC signaling WebSocket to broker SDP offers/answers and ICE candidates."""
    # 1. Authenticate user
    user = await get_ws_user(websocket)
    if not user:
        logger.warning("Unauthenticated WebSocket in WebRTC signaling.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = str(user["user_id"])
    channel_name = f"rtc_signal_{session_id}"

    # 2. Check if the session exists and is active
    async with AsyncSessionLocal() as db:
        session_service = LiveSessionService(db)
        session = await session_service.get_session_by_id(session_id)
        if not session or session.status == "ended":
            logger.warning(f"WebRTC signaling attempt to inactive or non-existent session {session_id}.")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    # 3. Connect to the WebSocket manager
    await manager.connect(websocket, channel_name, user_id)
    
    # Broadcast to the channel that a new peer has joined signaling
    await manager.broadcast(channel_name, {
        "type": "peer_joined",
        "user_id": user_id,
        "username": user["username"],
        "role": "host" if str(user_id) == str(session.host_id) else "viewer"
    })

    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                continue

            target_user_id = payload.get("target_user_id")
            if not target_user_id:
                # If no target specified, broadcast message (e.g. presenter announcing stream starts)
                await manager.broadcast(channel_name, {
                    "sender_id": user_id,
                    "type": payload.get("type"),
                    "data": payload.get("data")
                })
                continue

            # Route peer-to-peer signal directly to the target user
            signal_type = payload.get("type")  # e.g., 'offer', 'answer', 'candidate'
            await manager.send_personal(str(target_user_id), {
                "sender_id": user_id,
                "sender_username": user["username"],
                "type": signal_type,
                "data": payload.get("data")
            })

    except WebSocketDisconnect:
        await manager.disconnect(websocket, channel_name)
        # Broadcast peer left signaling channel
        await manager.broadcast(channel_name, {
            "type": "peer_left",
            "user_id": user_id,
            "username": user["username"]
        })
    except Exception as e:
        logger.error(f"WebRTC signaling socket exception: {e}")
        await manager.disconnect(websocket, channel_name)

"""WebSocket handler for FxZone chat messaging."""
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from shared.database import AsyncSessionLocal
from shared.security import get_ws_user
from shared.websocket_manager import manager
from services.chat.service import ChatService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Chat WebSockets"])


@router.websocket("/ws/chat/{conversation_id}")
async def chat_websocket_endpoint(websocket: WebSocket, conversation_id: str):
    """WebSocket endpoint for real-time messaging, typing, and read statuses."""
    # 1. Authenticate user
    user = await get_ws_user(websocket)
    if not user:
        logger.warning("Unauthenticated WebSocket connection attempt in chat.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = str(user["user_id"])
    channel_name = f"chat_{conversation_id}"

    # 2. Check if user is a member of the conversation
    async with AsyncSessionLocal() as db:
        chat_service = ChatService(db)
        is_member = await chat_service.verify_membership(user_id, conversation_id)
        if not is_member:
            logger.warning(f"User {user_id} unauthorized to join conversation {conversation_id}.")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    # 3. Connect to the WebSocket manager
    await manager.connect(websocket, channel_name, str(user_id))

    # Broadcast user joined status
    await manager.broadcast(channel_name, {
        "type": "status",
        "user_id": user_id,
        "username": user["username"],
        "status": "online"
    })

    try:
        while True:
            # Receive message from WebSocket
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                logger.error(f"Malformed JSON from user {user_id}: {data}")
                continue

            msg_type = payload.get("type", "message")

            if msg_type == "message":
                content = payload.get("content", "").strip()
                if not content:
                    continue

                # Save message to DB asynchronously
                async with AsyncSessionLocal() as db:
                    chat_service = ChatService(db)
                    saved_msg = await chat_service.save_message(
                        conversation_id=conversation_id,
                        sender_id=user_id,
                        content=content,
                        message_type=payload.get("message_type", "text")
                    )
                    
                    # Prepare broadcast response payload
                    broadcast_payload = {
                        "type": "message",
                        "id": saved_msg.id,
                        "conversation_id": conversation_id,
                        "sender_id": user_id,
                        "sender": {
                            "id": saved_msg.sender.id,
                            "username": saved_msg.sender.username,
                            "display_name": saved_msg.sender.display_name,
                            "avatar_url": saved_msg.sender.avatar_url,
                            "role": saved_msg.sender.role
                        },
                        "content": saved_msg.content,
                        "message_type": saved_msg.message_type,
                        "created_at": saved_msg.created_at.isoformat()
                    }

                # Broadcast saved message to conversation channel
                await manager.broadcast(channel_name, broadcast_payload)

            elif msg_type == "typing":
                # Broadcast typing status to other members of the channel
                is_typing = payload.get("typing", False)
                await manager.broadcast(channel_name, {
                    "type": "typing",
                    "user_id": user_id,
                    "username": user["username"],
                    "typing": is_typing
                })

            elif msg_type == "read":
                # Broadcast read receipt to other members of the channel
                await manager.broadcast(channel_name, {
                    "type": "read",
                    "user_id": user_id,
                    "username": user["username"],
                    "conversation_id": conversation_id
                })

    except WebSocketDisconnect:
        # Clean up connection
        await manager.disconnect(websocket, channel_name)
        # Broadcast offline status
        await manager.broadcast(channel_name, {
            "type": "status",
            "user_id": user_id,
            "username": user["username"],
            "status": "offline"
        })
    except Exception as e:
        logger.error(f"WebSocket error in chat endpoint: {e}")
        await manager.disconnect(websocket, channel_name)

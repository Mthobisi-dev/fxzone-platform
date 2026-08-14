"""FastAPI router for FxZone Live Trading Sessions."""
import json
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status, WebSocket, WebSocketDisconnect
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from shared.security import get_current_user, get_ws_user
from shared.websocket_manager import manager
from shared.models import User
from services.live_sessions.service import LiveSessionService
from services.live_sessions.schemas import (
    LiveSessionCreate,
    LiveSessionResponse,
    ParticipantResponse
)

router = APIRouter(prefix="/api/sessions", tags=["Live Trading Sessions"])

logger = logging.getLogger(__name__)


@router.get("", response_model=List[LiveSessionResponse])
async def get_active_sessions(
    limit: int = Query(15, ge=1, le=50),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve list of active or scheduled live trading sessions."""
    service = LiveSessionService(db)
    sessions = await service.get_active_sessions(limit=limit, offset=offset)
    
    # Format database models to schema
    formatted = []
    for s in sessions:
        participants = await service.get_participants(s.id)
        formatted.append({
            "id": s.id,
            "host_id": s.host_id,
            "host": {
                "id": s.host.id,
                "username": s.host.username,
                "display_name": s.host.display_name,
                "avatar_url": s.host.avatar_url,
                "role": s.host.role
            },
            "title": s.title,
            "description": s.description,
            "session_type": s.session_type,
            "status": s.status,
            "max_participants": s.max_participants,
            "participants_count": len(participants),
            "started_at": s.started_at,
            "ended_at": s.ended_at,
            "created_at": s.created_at
        })
    return formatted


@router.post("", response_model=LiveSessionResponse, status_code=status.HTTP_201_CREATED)
async def host_new_session(
    request: LiveSessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Host or schedule a new live screen-sharing stream."""
    service = LiveSessionService(db)
    s = await service.create_session(host_id=current_user.id, data=request)
    participants = await service.get_participants(s.id)
    return {
        "id": s.id,
        "host_id": s.host_id,
        "host": {
            "id": s.host.id,
            "username": s.host.username,
            "display_name": s.host.display_name,
            "avatar_url": s.host.avatar_url,
            "role": s.host.role
        },
        "title": s.title,
        "description": s.description,
        "session_type": s.session_type,
        "status": s.status,
        "max_participants": s.max_participants,
        "participants_count": len(participants),
        "started_at": s.started_at,
        "ended_at": s.ended_at,
        "created_at": s.created_at
    }


@router.get("/{session_id}", response_model=LiveSessionResponse)
async def get_session_details(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetch profile and settings metadata for a specific session ID."""
    service = LiveSessionService(db)
    s = await service.get_session_by_id(session_id)
    if not s:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found."
        )
    participants = await service.get_participants(s.id)
    return {
        "id": s.id,
        "host_id": s.host_id,
        "host": {
            "id": s.host.id,
            "username": s.host.username,
            "display_name": s.host.display_name,
            "avatar_url": s.host.avatar_url,
            "role": s.host.role
        },
        "title": s.title,
        "description": s.description,
        "session_type": s.session_type,
        "status": s.status,
        "max_participants": s.max_participants,
        "participants_count": len(participants),
        "started_at": s.started_at,
        "ended_at": s.ended_at,
        "created_at": s.created_at
    }


@router.post("/{session_id}/join", response_model=ParticipantResponse)
async def join_session(
    session_id: str,
    role: str = Query("viewer", description="Role to assume: 'viewer' or 'co-host'"),
    current_user: Any = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Join a live session, registering as a participant and activating host status if applicable."""
    service = LiveSessionService(db)
    try:
        user_id = str(getattr(current_user, 'user_id', None) or getattr(current_user, 'id', ''))
        p = await service.join_session(user_id=user_id, session_id=session_id, role=role)
        
        user_dict = {}
        try:
            if hasattr(p, 'user') and p.user is not None:
                user_dict = {
                    "id": str(p.user.id),
                    "username": str(p.user.username or ""),
                    "display_name": str(p.user.display_name or ""),
                    "avatar_url": str(p.user.avatar_url or ""),
                    "role": str(getattr(p.user.role, 'value', p.user.role) if p.user.role else "trader")
                }
        except Exception:
            pass

        if not user_dict:
            user_dict = {
                "id": user_id,
                "username": str(getattr(current_user, 'username', '')),
                "display_name": str(getattr(current_user, 'display_name', '')),
                "avatar_url": str(getattr(current_user, 'avatar_url', '')),
                "role": str(getattr(current_user, 'role', 'trader'))
            }

        return {
            "id": p.id,
            "session_id": p.session_id,
            "user_id": p.user_id,
            "user": user_dict,
            "role": p.role,
            "joined_at": p.joined_at,
            "left_at": p.left_at
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{session_id}/leave", status_code=status.HTTP_200_OK)
async def leave_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Leave the live session, updating participant record timestamps."""
    service = LiveSessionService(db)
    await service.leave_session(user_id=current_user.id, session_id=session_id)
    return {"status": "success", "message": "Successfully left the session."}


@router.post("/{session_id}/end", response_model=LiveSessionResponse)
async def end_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Host or admin endpoint to terminate a live session."""
    service = LiveSessionService(db)
    is_admin = (
        getattr(current_user, 'role', None) == 'admin'
        or (hasattr(current_user.role, 'value') and current_user.role.value == 'admin')
        or getattr(current_user, 'username', '') == 'admin'
        or getattr(current_user, 'email', '') == 'admin@fxzone.io'
    )
    try:
        s = await service.end_session(host_id=current_user.id, session_id=session_id, is_admin=is_admin)
        # Broadcast ended status over WebSocket
        channel_name = f"session_chat_{session_id}"
        await manager.broadcast(channel_name, {
            "type": "session_ended",
            "session_id": session_id,
            "message": "The session has been terminated."
        })
        return {
            "id": s.id,
            "host_id": s.host_id,
            "host": {
                "id": s.host.id,
                "username": s.host.username,
                "display_name": s.host.display_name,
                "avatar_url": s.host.avatar_url,
                "role": s.host.role
            },
            "title": s.title,
            "description": s.description,
            "session_type": s.session_type,
            "status": s.status,
            "max_participants": s.max_participants,
            "started_at": s.started_at,
            "ended_at": s.ended_at,
            "created_at": s.created_at
        }
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/{session_id}/participants", response_model=List[ParticipantResponse])
async def get_session_participants(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve list of active or pending participants in a session."""
    service = LiveSessionService(db)
    participants = await service.get_participants(session_id)
    
    formatted = []
    for p in participants:
        formatted.append({
            "id": p.id,
            "session_id": p.session_id,
            "user_id": p.user_id,
            "user": {
                "id": p.user.id,
                "username": p.user.username,
                "display_name": p.user.display_name,
                "avatar_url": p.user.avatar_url,
                "role": p.user.role
            },
            "role": p.role,
            "joined_at": p.joined_at,
            "left_at": p.left_at
        })
    return formatted


@router.post("/{session_id}/approve/{user_id}", response_model=ParticipantResponse)
async def approve_participant(
    session_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Host-only endpoint to approve a pending participant."""
    service = LiveSessionService(db)
    try:
        p = await service.approve_participant(
            host_id=current_user.id, session_id=session_id, participant_user_id=user_id
        )
        
        # Broadcast approval event over WebSocket so the approved user instantly joins
        channel_name = f"session_chat_{session_id}"
        await manager.broadcast(channel_name, {
            "type": "participant_approved",
            "user_id": str(user_id),
            "session_id": str(session_id),
            "message": "Access approved by the session host."
        })
        
        return {
            "id": p.id,
            "session_id": p.session_id,
            "user_id": p.user_id,
            "user": {
                "id": p.user.id,
                "username": p.user.username,
                "display_name": p.user.display_name,
                "avatar_url": p.user.avatar_url,
                "role": p.user.role
            },
            "role": p.role,
            "joined_at": p.joined_at,
            "left_at": p.left_at
        }
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{session_id}/reject/{user_id}")
async def reject_participant(
    session_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Host-only endpoint to reject a pending participant."""
    service = LiveSessionService(db)
    try:
        await service.reject_participant(
            host_id=current_user.id, session_id=session_id, participant_user_id=user_id
        )
        # Broadcast rejection event
        channel_name = f"session_chat_{session_id}"
        await manager.broadcast(channel_name, {
            "type": "participant_rejected",
            "user_id": str(user_id),
            "session_id": str(session_id),
            "message": "Access request was declined by the session host."
        })
        return {"status": "success", "message": "Participant rejected."}
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/history")
async def clear_session_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Admin-only: clear all ended sessions and their participant history."""
    is_admin = (
        getattr(current_user, 'role', None) == 'admin'
        or (hasattr(current_user.role, 'value') and current_user.role.value == 'admin')
        or getattr(current_user, 'username', '') == 'admin'
        or getattr(current_user, 'email', '') == 'admin@fxzone.io'
    )
    if not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only platform admins can clear session history.")
    service = LiveSessionService(db)
    count = await service.clear_ended_sessions(user_id=current_user.id)
    return {"status": "success", "message": f"Cleared {count} ended sessions and their participant history."}


@router.delete("/{session_id}")
async def delete_single_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a live session by ID (admin can delete any session)."""
    service = LiveSessionService(db)
    is_admin = (
        getattr(current_user, 'role', None) == 'admin'
        or (hasattr(current_user.role, 'value') and current_user.role.value == 'admin')
        or getattr(current_user, 'username', '') == 'admin'
        or getattr(current_user, 'email', '') == 'admin@fxzone.io'
    )
    try:
        deleted = await service.delete_session(session_id=session_id, user_id=current_user.id, is_admin=is_admin)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found."
            )
        return {"status": "success", "message": "Session deleted successfully."}
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.websocket("/ws/session/{session_id}")
async def session_chat_websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket handler for in-room live chat, WebRTC signaling, and stream presence."""
    user = await get_ws_user(websocket)
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = str(user["user_id"])
    channel_name = f"session_chat_{session_id}"

    # Connect to session channel
    await manager.connect(websocket, channel_name, user_id)

    # Broadcast user joined session
    await manager.broadcast(channel_name, {
        "type": "chat_status",
        "user_id": user_id,
        "username": user["username"],
        "status": "joined"
    })
    
    # Broadcast updated participant count
    total_members = len(manager.active_connections.get(channel_name, []))
    await manager.broadcast(channel_name, {
        "type": "members_update",
        "data": {"count": total_members}
    })

    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                continue

            msg_type = payload.get("type", "chat_message")
            
            # 1. Chat Message
            if msg_type == "chat_message":
                inner = payload.get("data", payload)
                content = inner.get("content", "").strip()
                if not content:
                    continue

                await manager.broadcast(channel_name, {
                    "type": "chat_message",
                    "user_id": user_id,
                    "username": user["username"],
                    "avatar_url": user.get("avatar_url"),
                    "content": content,
                    "timestamp": datetime.utcnow().isoformat()
                })

            # 2. WebRTC Peer-to-Peer Signaling (Screen Share & Audio Routing)
            elif msg_type in ["rtc_signal", "offer", "answer", "candidate", "peer_joined", "request_stream", "presenter_stream_started", "presenter_stream_stopped"]:
                inner_data = payload.get("data", {})
                target_user_id = payload.get("target_user_id") or inner_data.get("target_user_id")
                signal_type = inner_data.get("type") or msg_type

                signal_message = {
                    "type": "rtc_signal",
                    "data": {
                        **inner_data,
                        "type": signal_type,
                        "sender_id": user_id,
                        "sender_username": user["username"]
                    }
                }

                if target_user_id and str(target_user_id) != user_id:
                    # Send direct signal to targeted participant
                    await manager.send_personal(str(target_user_id), signal_message)
                else:
                    # Broadcast signal to all room participants (e.g. host starting screen share)
                    await manager.broadcast(channel_name, signal_message)

            # 3. Live Recording Status (Broadcast when host toggles recording)
            elif msg_type == "recording_status":
                await manager.broadcast(channel_name, {
                    "type": "recording_status",
                    "data": {
                        **payload.get("data", {}),
                        "sender_id": user_id,
                        "sender_username": user["username"]
                    }
                })

    except WebSocketDisconnect:
        await manager.disconnect(websocket, channel_name)
        total_members = len(manager.active_connections.get(channel_name, []))
        await manager.broadcast(channel_name, {
            "type": "chat_status",
            "user_id": user_id,
            "username": user["username"],
            "status": "left"
        })
        await manager.broadcast(channel_name, {
            "type": "members_update",
            "data": {"count": max(1, total_members)}
        })
        # Announce peer left for WebRTC cleanup
        await manager.broadcast(channel_name, {
            "type": "rtc_signal",
            "data": {
                "type": "peer_left",
                "sender_id": user_id,
                "user_id": user_id
            }
        })
    except Exception as e:
        logger.error(f"Session chat WebSocket error: {e}")
        await manager.disconnect(websocket, channel_name)

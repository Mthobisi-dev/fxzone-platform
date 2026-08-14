"""FastAPI router for the FxZone chat system."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from shared.security import get_current_user
from shared.models import User
from services.chat.service import ChatService
from services.chat.schemas import (
    ConversationCreate,
    ConversationResponse,
    MessageCreate,
    MessageResponse
)

router = APIRouter(prefix="/api/chat", tags=["Chat Messaging"])


@router.get("/conversations", response_model=List[ConversationResponse])
async def get_user_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve all conversations the current authenticated user participates in."""
    service = ChatService(db)
    conversations = await service.get_user_conversations(user_id=current_user.id)
    
    # Format database models to schema
    formatted = []
    for conv in conversations:
        members = [member.user for member in conv.members if member.user is not None]
        formatted.append({
            "id": conv.id,
            "name": conv.name,
            "description": getattr(conv, "description", None),
            "is_group": conv.is_group,
            "creator_id": getattr(conv, "creator_id", None),
            "created_at": conv.created_at,
            "updated_at": conv.updated_at,
            "members": members
        })
    return formatted


@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_new_conversation(
    request: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Start a new private 1:1 chat or a multi-user group chat."""
    service = ChatService(db)
    try:
        conv = await service.create_conversation(creator_id=current_user.id, data=request)
        members = [member.user for member in conv.members if member.user is not None]
        return {
            "id": conv.id,
            "name": conv.name,
            "description": getattr(conv, "description", None),
            "is_group": conv.is_group,
            "creator_id": getattr(conv, "creator_id", None),
            "created_at": conv.created_at,
            "updated_at": conv.updated_at,
            "members": members
        }
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception(f"Error creating conversation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create conversation: {str(e)}"
        )


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_conversation_messages(
    conversation_id: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve paginated chat messages for a specific conversation channel."""
    service = ChatService(db)
    
    # Verify user is a member first
    is_member = await service.verify_membership(current_user.id, conversation_id)
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this conversation's messages."
        )
        
    messages = await service.get_conversation_messages(
        conversation_id=conversation_id,
        limit=limit,
        offset=offset
    )
    return messages


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    conversation_id: str,
    request: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a message in a specific conversation."""
    service = ChatService(db)
    is_member = await service.verify_membership(current_user.id, conversation_id)
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to send messages in this conversation."
        )
    msg = await service.save_message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=request.content,
        message_type=request.message_type
    )

    # Broadcast saved message over WebSocket to other members
    from shared.websocket_manager import manager
    channel_name = f"chat_{conversation_id}"
    await manager.broadcast(channel_name, {
        "type": "message",
        "id": msg.id,
        "conversation_id": conversation_id,
        "sender_id": str(current_user.id),
        "sender": {
            "id": msg.sender.id,
            "username": msg.sender.username,
            "display_name": msg.sender.display_name,
            "avatar_url": msg.sender.avatar_url,
            "role": msg.sender.role
        },
        "content": msg.content,
        "message_type": msg.message_type,
        "created_at": msg.created_at.isoformat()
    })

    return msg


@router.delete("/messages/{message_id}")
async def delete_chat_message(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a chat message by ID (sender or Admin)."""
    service = ChatService(db)
    is_admin = (current_user.email == 'mthobisimzimela031@gmail.com' or current_user.username == 'admin' or current_user.role == 'admin')
    deleted = await service.delete_message(message_id=message_id, user_id=current_user.id, is_admin=is_admin)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found or unauthorized to delete."
        )
    return {"status": "success", "message": "Chat message deleted successfully."}

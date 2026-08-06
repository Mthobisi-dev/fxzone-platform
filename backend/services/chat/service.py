"""Business logic for the FxZone chat system."""
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, update
from sqlalchemy.orm import selectinload

from shared.models import Conversation, ConversationMember, Message, User
from services.chat.schemas import ConversationCreate

logger = logging.getLogger(__name__)


class ChatService:
    """Service to handle 1:1 and group chat rooms, membership details, and messages."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_conversation(self, creator_id: str, data: ConversationCreate) -> Conversation:
        """Create a new DM or group chat conversation and assign members."""
        now = datetime.utcnow()
        
        import uuid
        # Convert creator_id to UUID if string
        try:
            creator_uuid = uuid.UUID(str(creator_id))
        except ValueError:
            creator_uuid = creator_id

        # Determine participants
        participant_ids = [creator_uuid]
        if data.username:
            stmt = select(User).where(User.username == data.username)
            res = await self.db.execute(stmt)
            target_user = res.scalar_one_or_none()
            if not target_user:
                raise ValueError(f"User with username '{data.username}' not found.")
            participant_ids.append(target_user.id)
        elif data.participant_ids:
            for p_id in data.participant_ids:
                try:
                    p_uuid = uuid.UUID(str(p_id))
                except ValueError:
                    p_uuid = p_id
                participant_ids.append(p_uuid)
        else:
            raise ValueError("Either participant_ids or username must be provided.")

        # De-duplicate
        participant_ids = list(set(participant_ids))

        # Check target user restrictions (FxZone Bot & Admin)
        for target_id in participant_ids:
            if str(target_id) != str(creator_id):
                t_stmt = select(User).where(User.id == target_id)
                t_res = await self.db.execute(t_stmt)
                t_user = t_res.scalar_one_or_none()
                if t_user:
                    if t_user.username == 'fxzone_bot' or t_user.email == 'bot@fxzone.com':
                        raise ValueError("Direct messaging with FxZone Bot is restricted. Use the AI Analyst panel instead.")
                    if t_user.username == 'admin' or t_user.email == 'mthobisimzimela031@gmail.com' or t_user.role == 'admin':
                        # Check if creator is admin
                        c_stmt = select(User).where(User.id == creator_uuid)
                        c_res = await self.db.execute(c_stmt)
                        c_user = c_res.scalar_one_or_none()
                        if not (c_user and (c_user.username == 'admin' or c_user.role == 'admin' or c_user.email == 'mthobisimzimela031@gmail.com')):
                            raise ValueError("Direct messaging with FxZone Admin is restricted.")



        # Check for existing DM between these two users
        if not data.is_group and len(participant_ids) == 2:
            # Select all conversation IDs for user 1
            stmt1 = select(ConversationMember.conversation_id).where(
                ConversationMember.user_id == participant_ids[0]
            )
            res1 = await self.db.execute(stmt1)
            user1_convs = {row[0] for row in res1.all()}

            # Select all conversation IDs for user 2
            stmt2 = select(ConversationMember.conversation_id).where(
                ConversationMember.user_id == participant_ids[1]
            )
            res2 = await self.db.execute(stmt2)
            user2_convs = {row[0] for row in res2.all()}

            # Find the intersection
            common_convs = list(user1_convs.intersection(user2_convs))
            if common_convs:
                # Check if any is a 1:1 conversation (is_group = False)
                stmt3 = select(Conversation).where(
                    and_(
                        Conversation.id.in_(common_convs),
                        Conversation.is_group == False
                    )
                )
                res3 = await self.db.execute(stmt3)
                existing = res3.scalars().first()
                if existing:
                    # Return the existing conversation with preloaded relations
                    query = (
                        select(Conversation)
                        .where(Conversation.id == existing.id)
                        .options(
                            selectinload(Conversation.members).selectinload(ConversationMember.user)
                        )
                    )
                    res = await self.db.execute(query)
                    return res.scalar_one()
        
        # 1. Create conversation record
        conv = Conversation(
            name=data.name,
            is_group=data.is_group,
            created_at=now,
            updated_at=now
        )
        self.db.add(conv)
        await self.db.flush()

        # 2. Add members
        for user_id in participant_ids:
            member = ConversationMember(
                conversation_id=conv.id,
                user_id=user_id,
                joined_at=now,
                last_read_at=now
            )
            self.db.add(member)
        
        await self.db.flush()
        
        # 3. Retrieve conversation with loaded members
        query = (
            select(Conversation)
            .where(Conversation.id == conv.id)
            .options(
                selectinload(Conversation.members).selectinload(ConversationMember.user)
            )
        )
        res = await self.db.execute(query)
        return res.scalar_one()

    async def get_user_conversations(self, user_id: str) -> List[Conversation]:
        """Fetch list of conversations the current user is active in."""
        import uuid
        try:
            u_uuid = uuid.UUID(str(user_id))
        except ValueError:
            u_uuid = user_id

        # Find conversation IDs where user is member
        member_query = select(ConversationMember.conversation_id).where(
            ConversationMember.user_id == u_uuid
        )
        subquery = await self.db.execute(member_query)
        conv_ids = [row[0] for row in subquery.all()]

        if not conv_ids:
            return []

        # Load conversations with members
        query = (
            select(Conversation)
            .where(Conversation.id.in_(conv_ids))
            .options(
                selectinload(Conversation.members).selectinload(ConversationMember.user)
            )
            .order_by(Conversation.updated_at.desc())
        )
        res = await self.db.execute(query)
        return list(res.scalars().all())

    async def get_conversation_messages(
        self, 
        conversation_id: str, 
        limit: int = 50, 
        offset: int = 0
    ) -> List[Message]:
        """Fetch chat message log within a specific conversation, ordered chronologically."""
        import uuid
        try:
            conv_uuid = uuid.UUID(str(conversation_id))
        except ValueError:
            conv_uuid = conversation_id

        query = (
            select(Message)
            .where(Message.conversation_id == conv_uuid)
            .options(selectinload(Message.sender))
            .order_by(Message.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        res = await self.db.execute(query)
        messages = list(res.scalars().all())
        # Return in ascending (chronological) order for the UI
        messages.reverse()
        return messages

    async def save_message(
        self, 
        conversation_id: str, 
        sender_id: str, 
        content: str, 
        message_type: str = "text"
    ) -> Message:
        """Insert a message log entry and touch updated_at timestamp on parent conversation."""
        now = datetime.utcnow()
        import uuid
        try:
            conv_uuid = uuid.UUID(str(conversation_id))
        except ValueError:
            conv_uuid = conversation_id

        try:
            sender_uuid = uuid.UUID(str(sender_id))
        except ValueError:
            sender_uuid = sender_id
        
        # 1. Create message
        msg = Message(
            conversation_id=conv_uuid,
            sender_id=sender_uuid,
            content=content,
            message_type=message_type,
            created_at=now
        )
        self.db.add(msg)
        
        # 2. Touch conversation updated_at
        conv_stmt = (
            update(Conversation)
            .where(Conversation.id == conv_uuid)
            .values(updated_at=now)
        )
        await self.db.execute(conv_stmt)
        await self.db.flush()
        
        # 3. Retrieve with loaded sender details
        query = select(Message).where(Message.id == msg.id).options(selectinload(Message.sender))
        res = await self.db.execute(query)
        return res.scalar_one()

    async def verify_membership(self, user_id: str, conversation_id: str) -> bool:
        """Verify if a user is authorized inside a target chat room."""
        import uuid
        try:
            conv_uuid = uuid.UUID(str(conversation_id))
        except ValueError:
            conv_uuid = conversation_id

        try:
            user_uuid = uuid.UUID(str(user_id))
        except ValueError:
            user_uuid = user_id

        query = select(ConversationMember).where(
            and_(
                ConversationMember.conversation_id == conv_uuid,
                ConversationMember.user_id == user_uuid
            )
        )
        res = await self.db.execute(query)
        return res.scalar_one_or_none() is not None

    async def delete_message(self, message_id: str, user_id: str, is_admin: bool = False) -> bool:
        """Delete a chat message by ID if user is sender or admin."""
        import uuid
        try:
            msg_uuid = uuid.UUID(str(message_id))
        except ValueError:
            msg_uuid = message_id

        try:
            user_uuid = uuid.UUID(str(user_id))
        except ValueError:
            user_uuid = user_id

        if is_admin:
            stmt = select(Message).where(Message.id == msg_uuid)
        else:
            stmt = select(Message).where(and_(Message.id == msg_uuid, Message.sender_id == user_uuid))

        res = await self.db.execute(stmt)
        msg = res.scalar_one_or_none()
        if not msg:
            return False

        await self.db.delete(msg)
        await self.db.flush()
        return True

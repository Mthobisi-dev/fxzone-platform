"""Business logic for the FxZone Live Trading Sessions service."""
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, update
from sqlalchemy.orm import selectinload

from shared.models import LiveSession, SessionParticipant, User
from services.live_sessions.schemas import LiveSessionCreate

logger = logging.getLogger(__name__)


class LiveSessionService:
    """Service to handle live stream sessions, participant joining/leaving, and state updates."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_session(self, host_id: int, data: LiveSessionCreate) -> LiveSession:
        """Host or schedule a new live trading session."""
        now = datetime.now(timezone.utc)
        session = LiveSession(
            host_id=host_id,
            title=data.title,
            description=data.description,
            session_type=data.session_type,
            status="scheduled",  # Starts when host joins or activates
            max_participants=data.max_participants,
            created_at=now
        )
        self.db.add(session)
        await self.db.flush()
        
        # Load host details
        query = select(LiveSession).where(LiveSession.id == session.id).options(selectinload(LiveSession.host))
        res = await self.db.execute(query)
        return res.scalar_one()

    async def get_active_sessions(self, limit: int = 15, offset: int = 0) -> List[LiveSession]:
        """Fetch all sessions that are currently 'live' or 'scheduled'."""
        query = (
            select(LiveSession)
            .where(LiveSession.status.in_(["live", "scheduled"]))
            .options(selectinload(LiveSession.host))
            .order_by(LiveSession.status.desc(), LiveSession.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        res = await self.db.execute(query)
        return list(res.scalars().all())

    async def get_session_by_id(self, session_id: int) -> Optional[LiveSession]:
        """Retrieve details of a session by ID."""
        query = (
            select(LiveSession)
            .where(LiveSession.id == session_id)
            .options(selectinload(LiveSession.host))
        )
        res = await self.db.execute(query)
        return res.scalar_one_or_none()

    async def join_session(self, user_id: int, session_id: int, role: str = "viewer") -> SessionParticipant:
        """Register a user as a participant (viewer or co-host) in a live session."""
        now = datetime.now(timezone.utc)
        
        # 1. Fetch session
        session = await self.get_session_by_id(session_id)
        if not session:
            raise ValueError("Session not found.")
            
        if session.status == "ended":
            raise ValueError("This session has already ended.")

        # 2. Check if host is joining, if so, turn session status to 'live'
        if str(user_id) == str(session.host_id):
            session.status = "live"
            session.started_at = now
            role = "host"
        elif getattr(session, 'requires_approval', True):
            role = "pending"

        # 3. Check for existing active participation to avoid duplicate entries
        check_query = (
            select(SessionParticipant)
            .where(
                and_(
                    SessionParticipant.session_id == session_id,
                    SessionParticipant.user_id == user_id,
                    SessionParticipant.left_at == None
                )
            )
            .options(selectinload(SessionParticipant.user))
        )
        res = await self.db.execute(check_query)
        existing = res.scalar_one_or_none()
        
        if existing:
            return existing

        # 4. Insert participant record
        participant = SessionParticipant(
            session_id=session_id,
            user_id=user_id,
            role=role,
            joined_at=now
        )
        self.db.add(participant)
        await self.db.flush()

        # Load user details
        query = select(SessionParticipant).where(SessionParticipant.id == participant.id).options(selectinload(SessionParticipant.user))
        res = await self.db.execute(query)
        return res.scalar_one()

    async def leave_session(self, user_id: int, session_id: int) -> None:
        """Mark a participant as having left the live session."""
        now = datetime.utcnow()
        
        stmt = (
            update(SessionParticipant)
            .where(
                and_(
                    SessionParticipant.session_id == session_id,
                    SessionParticipant.user_id == user_id,
                    SessionParticipant.left_at == None
                )
            )
            .values(left_at=now)
        )
        await self.db.execute(stmt)

    async def end_session(self, host_id: int, session_id: int) -> LiveSession:
        """End a live session (host privilege only), marking all participants as left."""
        session = await self.get_session_by_id(session_id)
        if not session:
            raise ValueError("Session not found.")

        if session.host_id != host_id:
            raise PermissionError("Only the session host can terminate a session.")

        now = datetime.utcnow()
        session.status = "ended"
        session.ended_at = now

        # Update all active participants to left_at = now
        stmt = (
            update(SessionParticipant)
            .where(
                and_(
                    SessionParticipant.session_id == session_id,
                    SessionParticipant.left_at == None
                )
            )
            .values(left_at=now)
        )
        await self.db.execute(stmt)
        await self.db.flush()
        
        return session

    async def approve_participant(self, host_id: str, session_id: str, participant_user_id: str) -> SessionParticipant:
        """Host approves a pending participant to join the session."""
        session = await self.get_session_by_id(session_id)
        if not session:
            raise ValueError("Session not found.")
        if str(session.host_id) != str(host_id):
            raise PermissionError("Only the session host can approve participants.")

        # Find active pending participant
        query = select(SessionParticipant).where(
            and_(
                SessionParticipant.session_id == session_id,
                SessionParticipant.user_id == participant_user_id,
                SessionParticipant.role == "pending",
                SessionParticipant.left_at == None
            )
        )
        res = await self.db.execute(query)
        p = res.scalar_one_or_none()
        if not p:
            raise ValueError("Pending participant not found.")

        p.role = "viewer"
        await self.db.flush()
        
        # Load user details
        query = select(SessionParticipant).where(SessionParticipant.id == p.id).options(selectinload(SessionParticipant.user))
        res = await self.db.execute(query)
        return res.scalar_one()

    async def get_participants(self, session_id: str) -> List[SessionParticipant]:
        """Fetch active participant list for a specific session."""
        import uuid
        try:
            s_uuid = uuid.UUID(str(session_id))
        except ValueError:
            s_uuid = session_id

        query = (
            select(SessionParticipant)
            .where(
                and_(
                    SessionParticipant.session_id == s_uuid,
                    SessionParticipant.left_at == None
                )
            )
            .options(selectinload(SessionParticipant.user))
        )
        res = await self.db.execute(query)
        return list(res.scalars().all())

    async def reject_participant(self, host_id: str, session_id: str, participant_user_id: str) -> bool:
        """Host rejects a pending participant."""
        session = await self.get_session_by_id(session_id)
        if not session:
            raise ValueError("Session not found.")
        if str(session.host_id) != str(host_id):
            raise PermissionError("Only the session host can reject participants.")

        query = select(SessionParticipant).where(
            and_(
                SessionParticipant.session_id == session_id,
                SessionParticipant.user_id == participant_user_id,
                SessionParticipant.role == "pending",
                SessionParticipant.left_at == None
            )
        )
        res = await self.db.execute(query)
        p = res.scalar_one_or_none()
        if p:
            p.left_at = datetime.utcnow()
            await self.db.flush()
        return True

    async def clear_ended_sessions(self, user_id: str) -> int:
        """Clear all ended sessions from history."""
        from sqlalchemy import delete
        stmt = delete(LiveSession).where(LiveSession.status == "ended")
        res = await self.db.execute(stmt)
        await self.db.flush()
        return res.rowcount

    async def delete_session(self, session_id: str, user_id: str) -> bool:
        """Delete a single session by ID."""
        session = await self.get_session_by_id(session_id)
        if not session:
            return False
        await self.db.delete(session)
        await self.db.flush()
        return True

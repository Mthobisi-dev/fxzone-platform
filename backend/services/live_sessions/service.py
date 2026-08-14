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
        created = res.scalar_one()

        # Notify active traders about the new live broadcast
        try:
            from services.notifications.service import NotificationService
            notif_service = NotificationService(self.db)
            host_name = created.host.display_name if created.host else "Verified Educator"
            host_handle = created.host.username if created.host else "educator"
            
            # Fetch active users (excluding host)
            u_stmt = select(User.id).where(User.id != created.host_id).limit(50)
            u_res = await self.db.execute(u_stmt)
            trader_ids = u_res.scalars().all()

            for tid in trader_ids:
                await notif_service.create_notification(
                    user_id=tid,
                    notification_type="market",
                    title=f"Live Stream: {created.title}",
                    message=f"@{host_handle} scheduled a new live trading stream.",
                    data={"session_id": str(created.id)}
                )
        except Exception as e:
            logger.error(f"Error dispatching live session notification: {e}")

        return created

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

    async def get_session_by_id(self, session_id: Any) -> Optional[LiveSession]:
        """Retrieve details of a session by ID."""
        import uuid
        try:
            s_uuid = uuid.UUID(str(session_id))
        except ValueError:
            s_uuid = session_id

        query = (
            select(LiveSession)
            .where(LiveSession.id == s_uuid)
            .options(selectinload(LiveSession.host))
        )
        res = await self.db.execute(query)
        return res.scalar_one_or_none()

    async def join_session(self, user_id: Any, session_id: Any, role: str = "viewer") -> SessionParticipant:
        """Register a user as a participant (viewer or co-host) in a live session."""
        now = datetime.now(timezone.utc)
        import uuid
        try:
            s_uuid = uuid.UUID(str(session_id))
        except ValueError:
            s_uuid = session_id
        try:
            u_uuid = uuid.UUID(str(user_id))
        except ValueError:
            u_uuid = user_id
        
        # 1. Fetch session
        session = await self.get_session_by_id(s_uuid)
        if not session:
            raise ValueError("Session not found.")
            
        if session.status == "ended":
            raise ValueError("This session has already ended.")

        # 2. Check if host is joining, if so, turn session status to 'live'
        if str(u_uuid) == str(session.host_id):
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
                    SessionParticipant.session_id == s_uuid,
                    SessionParticipant.user_id == u_uuid,
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
            session_id=s_uuid,
            user_id=u_uuid,
            role=role,
            joined_at=now
        )
        self.db.add(participant)
        await self.db.commit()

        # Load user details
        query = select(SessionParticipant).where(SessionParticipant.id == participant.id).options(selectinload(SessionParticipant.user))
        res = await self.db.execute(query)
        return res.scalar_one()

    async def leave_session(self, user_id: Any, session_id: Any) -> None:
        """Mark a participant as having left the live session."""
        now = datetime.utcnow()
        import uuid
        try:
            s_uuid = uuid.UUID(str(session_id))
        except ValueError:
            s_uuid = session_id
        try:
            u_uuid = uuid.UUID(str(user_id))
        except ValueError:
            u_uuid = user_id
        
        stmt = (
            update(SessionParticipant)
            .where(
                and_(
                    SessionParticipant.session_id == s_uuid,
                    SessionParticipant.user_id == u_uuid,
                    SessionParticipant.left_at == None
                )
            )
            .values(left_at=now)
        )
        await self.db.execute(stmt)
        await self.db.commit()

    async def end_session(self, host_id: Any, session_id: Any, is_admin: bool = False) -> LiveSession:
        """End a live session. Host or platform admin can terminate any session."""
        import uuid
        try:
            s_uuid = uuid.UUID(str(session_id))
        except ValueError:
            s_uuid = session_id
        try:
            h_uuid = uuid.UUID(str(host_id))
        except ValueError:
            h_uuid = host_id

        session = await self.get_session_by_id(s_uuid)
        if not session:
            raise ValueError("Session not found.")

        if not is_admin and str(session.host_id) != str(h_uuid):
            raise PermissionError("Only the session host or a platform admin can terminate a session.")

        now = datetime.utcnow()
        session.status = "ended"
        session.ended_at = now

        # Mark all active participants as left
        stmt = (
            update(SessionParticipant)
            .where(
                and_(
                    SessionParticipant.session_id == s_uuid,
                    SessionParticipant.left_at == None
                )
            )
            .values(left_at=now)
        )
        await self.db.execute(stmt)
        await self.db.commit()
        
        return session

    async def approve_participant(self, host_id: Any, session_id: Any, participant_user_id: Any) -> SessionParticipant:
        """Host approves a pending participant to join the session."""
        import uuid
        try:
            s_uuid = uuid.UUID(str(session_id))
        except ValueError:
            s_uuid = session_id
        try:
            u_uuid = uuid.UUID(str(participant_user_id))
        except ValueError:
            u_uuid = participant_user_id
        try:
            h_uuid = uuid.UUID(str(host_id))
        except ValueError:
            h_uuid = host_id

        session = await self.get_session_by_id(s_uuid)
        if not session:
            raise ValueError("Session not found.")
        if str(session.host_id) != str(h_uuid):
            raise PermissionError("Only the session host can approve participants.")

        # Find active participant
        query = select(SessionParticipant).where(
            and_(
                SessionParticipant.session_id == s_uuid,
                SessionParticipant.user_id == u_uuid,
                SessionParticipant.left_at == None
            )
        )
        res = await self.db.execute(query)
        p = res.scalar_one_or_none()
        if not p:
            raise ValueError("Pending participant not found.")

        p.role = "viewer"
        await self.db.commit()
        
        # Load user details
        query = select(SessionParticipant).where(SessionParticipant.id == p.id).options(selectinload(SessionParticipant.user))
        res = await self.db.execute(query)
        return res.scalar_one()

    async def get_participants(self, session_id: Any) -> List[SessionParticipant]:
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

    async def reject_participant(self, host_id: Any, session_id: Any, participant_user_id: Any) -> bool:
        """Host rejects a pending participant."""
        import uuid
        try:
            s_uuid = uuid.UUID(str(session_id))
        except ValueError:
            s_uuid = session_id
        try:
            u_uuid = uuid.UUID(str(participant_user_id))
        except ValueError:
            u_uuid = participant_user_id
        try:
            h_uuid = uuid.UUID(str(host_id))
        except ValueError:
            h_uuid = host_id

        session = await self.get_session_by_id(s_uuid)
        if not session:
            raise ValueError("Session not found.")
        if str(session.host_id) != str(h_uuid):
            raise PermissionError("Only the session host can reject participants.")

        query = select(SessionParticipant).where(
            and_(
                SessionParticipant.session_id == s_uuid,
                SessionParticipant.user_id == u_uuid,
                SessionParticipant.left_at == None
            )
        )
        res = await self.db.execute(query)
        p = res.scalar_one_or_none()
        if p:
            p.left_at = datetime.utcnow()
            await self.db.commit()
        return True

    async def clear_ended_sessions(self, user_id: Any) -> int:
        """Clear all ended sessions and their participant history from the database."""
        from sqlalchemy import delete
        # First purge participant records for ended sessions to avoid FK violations
        ended_stmt = select(LiveSession.id).where(LiveSession.status == "ended")
        ended_res = await self.db.execute(ended_stmt)
        ended_ids = ended_res.scalars().all()
        if ended_ids:
            purge_participants = delete(SessionParticipant).where(SessionParticipant.session_id.in_(ended_ids))
            await self.db.execute(purge_participants)
        purge_sessions = delete(LiveSession).where(LiveSession.status == "ended")
        res = await self.db.execute(purge_sessions)
        await self.db.commit()
        return res.rowcount

    async def delete_session(self, session_id: Any, user_id: Any, is_admin: bool = False) -> bool:
        """Delete a single session and its participant history (admin or host only)."""
        import uuid
        try:
            s_uuid = uuid.UUID(str(session_id))
        except ValueError:
            s_uuid = session_id
        try:
            u_uuid = uuid.UUID(str(user_id))
        except ValueError:
            u_uuid = user_id

        session = await self.get_session_by_id(s_uuid)
        if not session:
            return False

        if not is_admin and str(session.host_id) != str(u_uuid):
            raise PermissionError("Only the session host or a platform admin can delete this session.")

        from sqlalchemy import delete as sa_delete
        # Purge participant rows first
        await self.db.execute(sa_delete(SessionParticipant).where(SessionParticipant.session_id == s_uuid))
        await self.db.delete(session)
        await self.db.commit()
        return True

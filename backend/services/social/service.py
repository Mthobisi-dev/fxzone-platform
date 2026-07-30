"""Business logic for the FxZone Social Trading network."""
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete, func, and_
from sqlalchemy.orm import selectinload

from shared.models import User, Post, Comment, Reaction, Follow, Asset
from services.social.schemas import PostCreate, CommentCreate

logger = logging.getLogger(__name__)


class SocialService:
    """Service handling trading dashboard social updates, profiles, and relationships."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_post(self, user_id: int, data: PostCreate) -> Post:
        """Create a new post or a 24-hour expiring story."""
        now = datetime.utcnow()
        expires_at = None
        
        if data.is_story:
            expires_at = now + timedelta(hours=24)

        # Resolve asset tags (symbols) to Asset records
        tagged_assets = []
        if data.asset_tags:
            stmt = select(Asset).where(Asset.symbol.in_(data.asset_tags))
            res = await self.db.execute(stmt)
            tagged_assets = list(res.scalars().all())

        post = Post(
            user_id=user_id,
            content=data.content,
            image_url=data.image_url,
            tagged_assets=tagged_assets,
            is_story=data.is_story,
            expires_at=expires_at,
            created_at=now,
            likes_count=0,
            comments_count=0,
            reposts_count=0
        )
        self.db.add(post)
        await self.db.flush()
        
        # Load user relations
        query = select(Post).where(Post.id == post.id).options(selectinload(Post.user))
        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_post_by_id(self, post_id: int) -> Optional[Post]:
        """Fetch a specific post with its author details."""
        query = (
            select(Post)
            .where(Post.id == post_id)
            .options(selectinload(Post.user))
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_feed(self, user_id: int, limit: int = 15, offset: int = 0) -> List[Post]:
        """Fetch a personalized feed ranked by age-decayed engagement score.
        
        Score formula: (likes * 3 + comments * 5 + reposts * 7) / (hours_age + 2)^1.5
        """
        # Fetch active standard posts (not stories)
        query = (
            select(Post)
            .where(Post.is_story == False)
            .options(selectinload(Post.user))
        )
        result = await self.db.execute(query)
        posts = list(result.scalars().all())

        now = datetime.utcnow()

        # Score and rank in Python (simple and accurate for MVP)
        def compute_score(p: Post) -> float:
            created_at = p.created_at or now
            hours_age = (now - created_at).total_seconds() / 3600.0
            likes = p.likes_count or 0
            comments = p.comments_count or 0
            reposts = p.reposts_count or 0
            engagement = (likes * 3) + (comments * 5) + (reposts * 7)
            score = engagement / ((hours_age + 2.0) ** 1.5)
            return score

        posts.sort(key=lambda p: (1 if getattr(p, 'is_pinned', False) else 0, compute_score(p)), reverse=True)
        
        # Apply offset and limit
        return posts[offset:offset + limit]

    async def get_user_posts(self, user_id: int, limit: int = 20, offset: int = 0) -> List[Post]:
        """Retrieve standard posts authored by a specific user."""
        query = (
            select(Post)
            .where(and_(Post.user_id == user_id, Post.is_story == False))
            .options(selectinload(Post.user))
            .order_by(Post.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def add_comment(self, user_id: int, post_id: int, data: CommentCreate) -> Comment:
        """Create a new comment on a post and increment comment counter."""
        comment = Comment(
            post_id=post_id,
            user_id=user_id,
            content=data.content,
            parent_id=data.parent_id,
            created_at=datetime.utcnow()
        )
        self.db.add(comment)
        
        # Increment comments count on post
        post_query = select(Post).where(Post.id == post_id)
        post_result = await self.db.execute(post_query)
        post = post_result.scalar_one_or_none()
        if post and str(post.user_id) != str(user_id):
            try:
                from services.notifications.service import NotificationService
                notif_service = NotificationService(self.db)
                user_stmt = select(User).where(User.id == user_id)
                u_res = await self.db.execute(user_stmt)
                commenter = u_res.scalar_one_or_none()
                commenter_name = commenter.display_name if commenter else "Someone"
                await notif_service.create_notification(
                    user_id=post.user_id,
                    notification_type="comment",
                    title="New Comment on Your Post",
                    message=f"{commenter_name} commented: \"{data.content[:40]}\"",
                    data={"post_id": str(post_id)}
                )
            except Exception as e:
                logger.error(f"Error creating comment notification: {e}")

        await self.db.flush()
        
        # Load user relation
        query = select(Comment).where(Comment.id == comment.id).options(selectinload(Comment.user))
        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_post_comments(self, post_id: int) -> List[Comment]:
        """Fetch comments for a post, ordered chronologically."""
        query = (
            select(Comment)
            .where(Comment.post_id == post_id)
            .options(selectinload(Comment.user))
            .order_by(Comment.created_at.asc())
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def delete_comment(self, comment_id: str, user_id: str, is_admin: bool = False) -> bool:
        """Delete a comment by ID if user is author or admin."""
        if is_admin:
            stmt = select(Comment).where(Comment.id == comment_id)
        else:
            stmt = select(Comment).where(and_(Comment.id == comment_id, Comment.user_id == user_id))
        res = await self.db.execute(stmt)
        comment = res.scalar_one_or_none()
        if not comment:
            return False
        
        # Decrement post comments count
        post_query = select(Post).where(Post.id == comment.post_id)
        p_res = await self.db.execute(post_query)
        post = p_res.scalar_one_or_none()
        if post:
            post.comments_count = max(0, post.comments_count - 1)

        await self.db.delete(comment)
        await self.db.flush()
        return True

    async def toggle_reaction(self, user_id: int, post_id: int, reaction_type: str = "like") -> Dict[str, Any]:
        """Toggle user reaction (like) on a post, keeping post likes count in sync."""
        react_query = select(Reaction).where(
            and_(Reaction.user_id == user_id, Reaction.post_id == post_id)
        )
        result = await self.db.execute(react_query)
        existing_reaction = result.scalar_one_or_none()

        post_query = select(Post).where(Post.id == post_id)
        post_result = await self.db.execute(post_query)
        post = post_result.scalar_one_or_none()
        
        if not post:
            raise ValueError("Post not found.")

        active = False
        if existing_reaction:
            # Remove reaction
            await self.db.delete(existing_reaction)
            post.likes_count = max(0, post.likes_count - 1)
        else:
            # Create reaction
            reaction = Reaction(
                user_id=user_id,
                post_id=post_id,
                reaction_type=reaction_type,
                created_at=datetime.utcnow()
            )
            self.db.add(reaction)
            post.likes_count += 1
            active = True

            if str(post.user_id) != str(user_id):
                try:
                    from services.notifications.service import NotificationService
                    notif_service = NotificationService(self.db)
                    user_stmt = select(User).where(User.id == user_id)
                    u_res = await self.db.execute(user_stmt)
                    liker = u_res.scalar_one_or_none()
                    liker_name = liker.display_name if liker else "Someone"
                    await notif_service.create_notification(
                        user_id=post.user_id,
                        notification_type="like",
                        title="Post Liked",
                        message=f"{liker_name} liked your trading post.",
                        data={"post_id": str(post_id)}
                    )
                except Exception as e:
                    logger.error(f"Error dispatching reaction notification: {e}")

        await self.db.flush()
        return {
            "post_id": post_id,
            "reaction_type": reaction_type,
            "active": active,
            "likes_count": post.likes_count
        }

    async def toggle_follow(self, follower_id: int, following_id: int) -> Dict[str, Any]:
        """Toggle follow relationship between two users and return counts."""
        if follower_id == following_id:
            raise ValueError("Users cannot follow themselves.")

        follow_query = select(Follow).where(
            and_(Follow.follower_id == follower_id, Follow.following_id == following_id)
        )
        result = await self.db.execute(follow_query)
        existing_follow = result.scalar_one_or_none()

        is_following = False
        if existing_follow:
            await self.db.delete(existing_follow)
        else:
            follow = Follow(
                follower_id=follower_id,
                following_id=following_id,
                created_at=datetime.utcnow()
            )
            self.db.add(follow)
            is_following = True

            try:
                from services.notifications.service import NotificationService
                notif_service = NotificationService(self.db)
                follower_stmt = select(User).where(User.id == follower_id)
                f_res = await self.db.execute(follower_stmt)
                follower_user = f_res.scalar_one_or_none()
                follower_name = follower_user.display_name if follower_user else "Someone"
                await notif_service.create_notification(
                    user_id=following_id,
                    notification_type="follow",
                    title="New Follower",
                    message=f"{follower_name} started following your signal stream.",
                    data={"follower_id": str(follower_id)}
                )
            except Exception as e:
                logger.error(f"Error dispatching follow notification: {e}")

        await self.db.flush()

        # Calculate counts
        followers_count = await self.db.scalar(
            select(func.count(Follow.id)).where(Follow.following_id == following_id)
        )
        following_count = await self.db.scalar(
            select(func.count(Follow.id)).where(Follow.follower_id == follower_id)
        )

        return {
            "follower_id": follower_id,
            "following_id": following_id,
            "is_following": is_following,
            "followers_count": followers_count or 0,
            "following_count": following_count or 0
        }

    async def get_user_profile(self, target_user_id: int, current_user_id: int) -> Dict[str, Any]:
        """Fetch user data, posts, follower lists, and follow state for profiles."""
        user_query = select(User).where(User.id == target_user_id)
        user_result = await self.db.execute(user_query)
        user = user_result.scalar_one_or_none()

        if not user:
            raise ValueError("User not found.")

        # Aggregate counts
        followers_count = await self.db.scalar(
            select(func.count(Follow.id)).where(Follow.following_id == target_user_id)
        )
        following_count = await self.db.scalar(
            select(func.count(Follow.id)).where(Follow.follower_id == target_user_id)
        )
        posts_count = await self.db.scalar(
            select(func.count(Post.id)).where(and_(Post.user_id == target_user_id, Post.is_story == False))
        )

        # Check follow state
        follow_check = select(Follow).where(
            and_(Follow.follower_id == current_user_id, Follow.following_id == target_user_id)
        )
        follow_res = await self.db.execute(follow_check)
        is_following = follow_res.scalar_one_or_none() is not None

        return {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
            "bio": user.bio,
            "role": user.role,
            "created_at": user.created_at,
            "followers_count": followers_count or 0,
            "following_count": following_count or 0,
            "posts_count": posts_count or 0,
            "is_following": is_following
        }

    async def get_active_stories(self, user_id: int) -> List[Post]:
        """Fetch stories that haven't expired (expires_at > now)."""
        now = datetime.utcnow()
        
        # Fetch stories of users the current user follows
        following_subquery = select(Follow.following_id).where(Follow.follower_id == user_id)
        
        query = (
            select(Post)
            .where(
                and_(
                    Post.is_story == True,
                    Post.expires_at > now,
                    Post.user_id.in_(following_subquery)
                )
            )
            .options(selectinload(Post.user))
            .order_by(Post.created_at.desc())
        )
        result = await self.db.execute(query)
        stories = list(result.scalars().all())

        # Discovery fallback: if no stories from followed users, fetch any active stories
        if not stories:
            fallback_query = (
                select(Post)
                .where(and_(Post.is_story == True, Post.expires_at > now))
                .options(selectinload(Post.user))
                .order_by(Post.created_at.desc())
                .limit(10)
            )
            result = await self.db.execute(fallback_query)
            stories = list(result.scalars().all())

        return stories

    async def get_all_users(self, query: str = "", limit: int = 20, offset: int = 0, current_user_id=None) -> List[Dict[str, Any]]:
        """List or search all users for the Discover page."""
        from sqlalchemy import or_
        stmt = select(User)
        if query.strip():
            pattern = f"%{query.strip()}%"
            stmt = stmt.where(
                or_(
                    User.username.ilike(pattern),
                    User.display_name.ilike(pattern)
                )
            )
        stmt = stmt.order_by(User.created_at.desc()).offset(offset).limit(limit)
        result = await self.db.execute(stmt)
        users = list(result.scalars().all())

        user_list = []
        for u in users:
            # Check if current user follows this user
            is_following = False
            is_follower = False
            if current_user_id:
                follow_check = select(Follow).where(
                    and_(Follow.follower_id == current_user_id, Follow.following_id == u.id)
                )
                fres = await self.db.execute(follow_check)
                is_following = fres.scalar_one_or_none() is not None

                follower_check = select(Follow).where(
                    and_(Follow.follower_id == u.id, Follow.following_id == current_user_id)
                )
                fres2 = await self.db.execute(follower_check)
                is_follower = fres2.scalar_one_or_none() is not None

            followers_count = await self.db.scalar(
                select(func.count(Follow.id)).where(Follow.following_id == u.id)
            )

            user_list.append({
                "id": str(u.id),
                "username": u.username,
                "display_name": u.display_name,
                "avatar_url": u.avatar_url,
                "bio": u.bio,
                "role": u.role.value if hasattr(u.role, 'value') else u.role,
                "followers_count": followers_count or 0,
                "is_following": is_following,
                "is_follower": is_follower,
                "is_mutual": is_following and is_follower
            })
        return user_list

    async def delete_post(self, post_id: str, user_id: str, is_admin: bool = False) -> bool:
        """Delete a post. Post author or FxZone Admin can delete any post."""
        if is_admin:
            stmt = select(Post).where(Post.id == post_id)
        else:
            stmt = select(Post).where(and_(Post.id == post_id, Post.user_id == user_id))
        res = await self.db.execute(stmt)
        post = res.scalar_one_or_none()
        if not post:
            return False
        await self.db.delete(post)
        await self.db.flush()
        return True

    async def toggle_pin_post(self, post_id: str, user_id: str) -> Optional[Post]:
        """Toggle pinned status for a post authored by the current user."""
        stmt = select(Post).where(and_(Post.id == post_id, Post.user_id == user_id)).options(selectinload(Post.user))
        res = await self.db.execute(stmt)
        post = res.scalar_one_or_none()
        if not post:
            return None
        post.is_pinned = not getattr(post, 'is_pinned', False)
        await self.db.flush()
        return post

    async def delete_user_account(self, user_id: Any) -> bool:
        """Cascade purge all user data (posts, comments, reactions, messages, sessions) and delete user."""
        import uuid
        try:
            u_uuid = uuid.UUID(str(user_id))
        except ValueError:
            u_uuid = user_id

        stmt = select(User).where(User.id == u_uuid)
        res = await self.db.execute(stmt)
        u = res.scalar_one_or_none()
        if not u:
            return False

        # Import ORM models for deletion
        from shared.models import Comment, Reaction, Follow, Message, ConversationMember, LiveSession, SessionParticipant

        # Delete comments made by user
        await self.db.execute(delete(Comment).where(Comment.user_id == u_uuid))
        # Delete reactions made by user
        await self.db.execute(delete(Reaction).where(Reaction.user_id == u_uuid))
        # Delete posts made by user
        await self.db.execute(delete(Post).where(Post.user_id == u_uuid))
        # Delete follows involving user
        await self.db.execute(delete(Follow).where(or_(Follow.follower_id == u_uuid, Follow.following_id == u_uuid)))
        # Delete messages sent by user
        await self.db.execute(delete(Message).where(Message.sender_id == u_uuid))
        # Delete conversation memberships
        await self.db.execute(delete(ConversationMember).where(ConversationMember.user_id == u_uuid))
        # Delete session participations
        await self.db.execute(delete(SessionParticipant).where(SessionParticipant.user_id == u_uuid))
        # Delete hosted sessions
        await self.db.execute(delete(LiveSession).where(LiveSession.host_id == u_uuid))
        # Delete user
        await self.db.delete(u)
        await self.db.flush()
        return True


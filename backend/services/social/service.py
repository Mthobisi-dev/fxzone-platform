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

    async def get_post_by_id(self, post_id: Any, current_user_id: Any = None) -> Optional[Dict[str, Any]]:
        """Fetch a specific post with its author details and user reaction state."""
        import uuid
        try:
            p_uuid = uuid.UUID(str(post_id))
        except ValueError:
            p_uuid = post_id

        query = (
            select(Post)
            .where(Post.id == p_uuid)
            .options(
                selectinload(Post.user),
                selectinload(Post.tagged_assets),
                selectinload(Post.reactions),
                selectinload(Post.comments)
            )
        )
        result = await self.db.execute(query)
        p = result.scalar_one_or_none()
        if not p:
            return None

        is_liked = False
        is_reposted = False
        is_bookmarked = False

        if current_user_id:
            try:
                u_uuid = uuid.UUID(str(current_user_id))
            except ValueError:
                u_uuid = current_user_id
            
            from shared.models import Bookmark
            bm = await self.db.scalar(select(Bookmark.id).where(and_(Bookmark.user_id == u_uuid, Bookmark.post_id == p_uuid)))
            is_bookmarked = bm is not None

            if p.reactions:
                is_liked = any(str(r.user_id) == str(u_uuid) and r.reaction_type == "like" for r in p.reactions)
                is_reposted = any(str(r.user_id) == str(u_uuid) and r.reaction_type == "repost" for r in p.reactions)

        actual_likes = len([r for r in p.reactions if r.reaction_type == 'like']) if p.reactions else (p.likes_count or 0)
        actual_comments = len(p.comments) if p.comments else (p.comments_count or 0)
        actual_reposts = len([r for r in p.reactions if r.reaction_type == 'repost']) if p.reactions else (p.reposts_count or 0)

        return {
            "id": p.id,
            "user_id": p.user_id,
            "user": {
                "id": p.user.id,
                "username": p.user.username,
                "display_name": p.user.display_name or p.user.username,
                "avatar_url": p.user.avatar_url,
                "role": p.user.role.value if hasattr(p.user.role, 'value') else p.user.role
            },
            "content": p.content,
            "image_url": p.image_url,
            "asset_tags": [a.symbol for a in p.tagged_assets] if p.tagged_assets else [],
            "likes_count": max(p.likes_count or 0, actual_likes),
            "comments_count": max(p.comments_count or 0, actual_comments),
            "reposts_count": max(p.reposts_count or 0, actual_reposts),
            "is_story": p.is_story or False,
            "is_pinned": getattr(p, "is_pinned", False),
            "expires_at": p.expires_at,
            "created_at": p.created_at,
            "is_liked_by_user": is_liked,
            "is_reposted_by_user": is_reposted,
            "is_bookmarked_by_user": is_bookmarked
        }

    async def get_feed(self, user_id: Any, limit: int = 15, offset: int = 0) -> List[Dict[str, Any]]:
        """Fetch a personalized feed ranked by age-decayed engagement score with full user action states."""
        import uuid
        try:
            u_uuid = uuid.UUID(str(user_id))
        except ValueError:
            u_uuid = user_id

        # Fetch active standard posts (not stories)
        query = (
            select(Post)
            .where(Post.is_story == False)
            .options(
                selectinload(Post.user),
                selectinload(Post.tagged_assets),
                selectinload(Post.reactions),
                selectinload(Post.comments)
            )
        )
        result = await self.db.execute(query)
        posts = list(result.scalars().all())

        # Bookmarks for user
        from shared.models import Bookmark
        bm_query = select(Bookmark.post_id).where(Bookmark.user_id == u_uuid)
        bm_res = await self.db.execute(bm_query)
        bookmarked_post_ids = {str(row[0]) for row in bm_res.all()}

        # Reactions for user
        user_react_query = select(Reaction).where(Reaction.user_id == u_uuid)
        react_res = await self.db.execute(user_react_query)
        user_reactions = list(react_res.scalars().all())
        liked_post_ids = {str(r.post_id) for r in user_reactions if r.reaction_type == "like"}
        reposted_post_ids = {str(r.post_id) for r in user_reactions if r.reaction_type == "repost"}

        now = datetime.utcnow()

        def compute_score(p: Post) -> float:
            created_at = p.created_at or now
            if created_at.tzinfo is not None:
                created_at = created_at.replace(tzinfo=None)
            hours_age = max(0, (now - created_at).total_seconds() / 3600.0)
            likes = p.likes_count or (len([r for r in p.reactions if r.reaction_type == 'like']) if p.reactions else 0)
            comments = p.comments_count or (len(p.comments) if p.comments else 0)
            reposts = p.reposts_count or (len([r for r in p.reactions if r.reaction_type == 'repost']) if p.reactions else 0)
            engagement = (likes * 3) + (comments * 5) + (reposts * 7)
            return engagement / ((hours_age + 2.0) ** 1.5)

        posts.sort(key=lambda p: (1 if getattr(p, 'is_pinned', False) else 0, compute_score(p)), reverse=True)
        sliced = posts[offset:offset + limit]

        formatted = []
        for p in sliced:
            p_id_str = str(p.id)
            actual_likes = len([r for r in p.reactions if r.reaction_type == 'like']) if p.reactions else (p.likes_count or 0)
            actual_comments = len(p.comments) if p.comments else (p.comments_count or 0)
            actual_reposts = len([r for r in p.reactions if r.reaction_type == 'repost']) if p.reactions else (p.reposts_count or 0)
            
            formatted.append({
                "id": p.id,
                "user_id": p.user_id,
                "user": {
                    "id": p.user.id,
                    "username": p.user.username,
                    "display_name": p.user.display_name or p.user.username,
                    "avatar_url": p.user.avatar_url,
                    "role": p.user.role.value if hasattr(p.user.role, 'value') else p.user.role
                },
                "content": p.content,
                "image_url": p.image_url,
                "asset_tags": [a.symbol for a in p.tagged_assets] if p.tagged_assets else [],
                "likes_count": max(p.likes_count or 0, actual_likes),
                "comments_count": max(p.comments_count or 0, actual_comments),
                "reposts_count": max(p.reposts_count or 0, actual_reposts),
                "is_story": p.is_story or False,
                "is_pinned": getattr(p, "is_pinned", False),
                "expires_at": p.expires_at,
                "created_at": p.created_at,
                "is_liked_by_user": p_id_str in liked_post_ids,
                "is_reposted_by_user": p_id_str in reposted_post_ids,
                "is_bookmarked_by_user": p_id_str in bookmarked_post_ids
            })
        return formatted

    async def get_user_posts(self, user_id: Any, limit: int = 20, offset: int = 0) -> List[Dict[str, Any]]:
        """Retrieve standard posts authored by a specific user."""
        import uuid
        try:
            u_uuid = uuid.UUID(str(user_id))
        except ValueError:
            u_uuid = user_id

        query = (
            select(Post)
            .where(and_(Post.user_id == u_uuid, Post.is_story == False))
            .options(
                selectinload(Post.user),
                selectinload(Post.tagged_assets),
                selectinload(Post.reactions),
                selectinload(Post.comments)
            )
            .order_by(Post.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(query)
        posts = list(result.scalars().all())

        formatted = []
        for p in posts:
            actual_likes = len([r for r in p.reactions if r.reaction_type == 'like']) if p.reactions else (p.likes_count or 0)
            actual_comments = len(p.comments) if p.comments else (p.comments_count or 0)
            actual_reposts = len([r for r in p.reactions if r.reaction_type == 'repost']) if p.reactions else (p.reposts_count or 0)
            formatted.append({
                "id": p.id,
                "user_id": p.user_id,
                "user": {
                    "id": p.user.id,
                    "username": p.user.username,
                    "display_name": p.user.display_name or p.user.username,
                    "avatar_url": p.user.avatar_url,
                    "role": p.user.role.value if hasattr(p.user.role, 'value') else p.user.role
                },
                "content": p.content,
                "image_url": p.image_url,
                "asset_tags": [a.symbol for a in p.tagged_assets] if p.tagged_assets else [],
                "likes_count": max(p.likes_count or 0, actual_likes),
                "comments_count": max(p.comments_count or 0, actual_comments),
                "reposts_count": max(p.reposts_count or 0, actual_reposts),
                "is_story": p.is_story or False,
                "is_pinned": getattr(p, "is_pinned", False),
                "expires_at": p.expires_at,
                "created_at": p.created_at,
                "is_liked_by_user": False,
                "is_reposted_by_user": False,
                "is_bookmarked_by_user": False
            })
        return formatted

    async def add_comment(self, user_id: Any, post_id: Any, data: CommentCreate) -> Comment:
        """Create a new comment on a post and increment comment counter."""
        import uuid
        try:
            u_uuid = uuid.UUID(str(user_id))
        except ValueError:
            u_uuid = user_id
        try:
            p_uuid = uuid.UUID(str(post_id))
        except ValueError:
            p_uuid = post_id

        parent_uuid = None
        if data.parent_id:
            try:
                parent_uuid = uuid.UUID(str(data.parent_id))
            except ValueError:
                parent_uuid = data.parent_id

        comment = Comment(
            post_id=p_uuid,
            user_id=u_uuid,
            content=data.content,
            parent_id=parent_uuid,
            created_at=datetime.utcnow()
        )
        self.db.add(comment)
        
        # Increment comments count on post
        post_query = select(Post).where(Post.id == p_uuid)
        post_result = await self.db.execute(post_query)
        post = post_result.scalar_one_or_none()
        if post:
            post.comments_count = (post.comments_count or 0) + 1
            if str(post.user_id) != str(u_uuid):
                try:
                    from services.notifications.service import NotificationService
                    notif_service = NotificationService(self.db)
                    user_stmt = select(User).where(User.id == u_uuid)
                    u_res = await self.db.execute(user_stmt)
                    commenter = u_res.scalar_one_or_none()
                    commenter_name = commenter.display_name if commenter else "Someone"
                    await notif_service.create_notification(
                        user_id=post.user_id,
                        notification_type="comment",
                        title="New Comment",
                        message=f"{commenter_name} replied: \"{data.content[:45]}...\"",
                        data={"post_id": str(p_uuid)}
                    )
                except Exception as e:
                    logger.error(f"Error creating comment notification: {e}")

        await self.db.commit()
        
        # Load user relation
        query = select(Comment).where(Comment.id == comment.id).options(selectinload(Comment.user))
        result = await self.db.execute(query)
        return result.scalar_one()

    async def get_post_comments(self, post_id: Any) -> List[Comment]:
        """Fetch comments for a post, ordered chronologically."""
        import uuid
        try:
            p_uuid = uuid.UUID(str(post_id))
        except ValueError:
            p_uuid = post_id

        query = (
            select(Comment)
            .where(Comment.post_id == p_uuid)
            .options(selectinload(Comment.user))
            .order_by(Comment.created_at.asc())
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def delete_comment(self, comment_id: str, user_id: str, is_admin: bool = False) -> bool:
        """Delete a comment by ID if user is author or admin."""
        import uuid
        try:
            c_uuid = uuid.UUID(str(comment_id))
        except ValueError:
            c_uuid = comment_id
        try:
            u_uuid = uuid.UUID(str(user_id))
        except ValueError:
            u_uuid = user_id

        if is_admin:
            stmt = select(Comment).where(Comment.id == c_uuid)
        else:
            stmt = select(Comment).where(and_(Comment.id == c_uuid, Comment.user_id == u_uuid))
        res = await self.db.execute(stmt)
        comment = res.scalar_one_or_none()
        if not comment:
            return False
        
        # Decrement post comments count
        post_query = select(Post).where(Post.id == comment.post_id)
        p_res = await self.db.execute(post_query)
        post = p_res.scalar_one_or_none()
        if post:
            post.comments_count = max(0, (post.comments_count or 1) - 1)

        await self.db.delete(comment)
        await self.db.commit()
        return True

    async def toggle_reaction(self, user_id: Any, post_id: Any, reaction_type: str = "like") -> Dict[str, Any]:
        """Toggle user reaction (like) on a post, keeping post likes count in sync."""
        import uuid
        try:
            u_uuid = uuid.UUID(str(user_id))
        except ValueError:
            u_uuid = user_id
        try:
            p_uuid = uuid.UUID(str(post_id))
        except ValueError:
            p_uuid = post_id

        react_query = select(Reaction).where(
            and_(
                Reaction.user_id == u_uuid,
                Reaction.post_id == p_uuid,
                Reaction.reaction_type == reaction_type
            )
        )
        result = await self.db.execute(react_query)
        existing_reaction = result.scalar_one_or_none()

        post_query = select(Post).where(Post.id == p_uuid)
        post_result = await self.db.execute(post_query)
        post = post_result.scalar_one_or_none()
        
        if not post:
            raise ValueError("Post not found.")

        active = False
        if existing_reaction:
            # Remove reaction
            await self.db.delete(existing_reaction)
            post.likes_count = max(0, (post.likes_count or 1) - 1)
        else:
            # Create reaction
            reaction = Reaction(
                user_id=u_uuid,
                post_id=p_uuid,
                reaction_type=reaction_type,
                created_at=datetime.utcnow()
            )
            self.db.add(reaction)
            post.likes_count = (post.likes_count or 0) + 1
            active = True

            if str(post.user_id) != str(u_uuid):
                try:
                    from services.notifications.service import NotificationService
                    notif_service = NotificationService(self.db)
                    user_stmt = select(User).where(User.id == u_uuid)
                    u_res = await self.db.execute(user_stmt)
                    liker = u_res.scalar_one_or_none()
                    liker_name = liker.display_name if liker else "Someone"
                    await notif_service.create_notification(
                        user_id=post.user_id,
                        notification_type="like",
                        title="Post Liked",
                        message=f"{liker_name} liked your trading post.",
                        data={"post_id": str(p_uuid)}
                    )
                except Exception as e:
                    logger.error(f"Error dispatching reaction notification: {e}")

        await self.db.commit()
        return {
            "post_id": str(post_id),
            "reaction_type": reaction_type,
            "active": active,
            "likes_count": post.likes_count or 0
        }

    async def toggle_repost(self, user_id: Any, post_id: Any) -> Dict[str, Any]:
        """Toggle repost / reshare of a post by user."""
        import uuid
        try:
            u_uuid = uuid.UUID(str(user_id))
        except ValueError:
            u_uuid = user_id
        try:
            p_uuid = uuid.UUID(str(post_id))
        except ValueError:
            p_uuid = post_id

        post_stmt = select(Post).where(Post.id == p_uuid)
        res = await self.db.execute(post_stmt)
        post = res.scalar_one_or_none()
        if not post:
            raise ValueError("Post not found.")

        react_stmt = select(Reaction).where(
            and_(
                Reaction.user_id == u_uuid,
                Reaction.post_id == p_uuid,
                Reaction.reaction_type == "repost"
            )
        )
        r_res = await self.db.execute(react_stmt)
        existing = r_res.scalar_one_or_none()

        is_reposted = False
        if existing:
            await self.db.delete(existing)
            post.reposts_count = max(0, (post.reposts_count or 1) - 1)
        else:
            new_r = Reaction(
                user_id=u_uuid,
                post_id=p_uuid,
                reaction_type="repost",
                created_at=datetime.utcnow()
            )
            self.db.add(new_r)
            post.reposts_count = (post.reposts_count or 0) + 1
            is_reposted = True

            if str(post.user_id) != str(u_uuid):
                try:
                    from services.notifications.service import NotificationService
                    notif_service = NotificationService(self.db)
                    u_stmt = select(User).where(User.id == u_uuid)
                    u_res = await self.db.execute(u_stmt)
                    reposter = u_res.scalar_one_or_none()
                    reposter_name = reposter.display_name if reposter else "A trader"
                    await notif_service.create_notification(
                        user_id=post.user_id,
                        notification_type="repost",
                        title="Post Reshared",
                        message=f"{reposter_name} reshared your trading post.",
                        data={"post_id": str(p_uuid)}
                    )
                except Exception as e:
                    logger.error(f"Error creating repost notification: {e}")

        await self.db.commit()
        return {
            "post_id": str(post_id),
            "is_reposted": is_reposted,
            "reposts_count": post.reposts_count or 0
        }
            "reaction_type": reaction_type,
            "active": active,
            "likes_count": post.likes_count
        }

    async def toggle_follow(self, follower_id: int, following_id: int) -> Dict[str, Any]:
        """Toggle follow relationship between two users and return counts."""
        if follower_id == following_id:
            raise ValueError("Users cannot follow themselves.")

        # Prevent following FxZone Bot
        target_user_stmt = select(User).where(User.id == following_id)
        t_res = await self.db.execute(target_user_stmt)
        target_user = t_res.scalar_one_or_none()
        if target_user and (target_user.username in ['fxzone_bot', 'jackbot_analyst'] or target_user.role == 'bot' or target_user.email == 'bot@fxzone.io'):
            raise ValueError("Following FxZone Bot is restricted. Bot market signals are broadcast to all users automatically.")

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

        await self.db.commit()

        # Calculate counts
        followers_count = await self.db.scalar(
            select(func.count(Follow.id)).where(Follow.following_id == following_id)
        )
        following_count = await self.db.scalar(
            select(func.count(Follow.id)).where(Follow.follower_id == follower_id)
        )

        # Update User model stats
        await self.db.execute(update(User).where(User.id == following_id).values(followers_count=followers_count or 0))
        await self.db.execute(update(User).where(User.id == follower_id).values(following_count=following_count or 0))
        await self.db.commit()

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
        from sqlalchemy import or_, not_
        stmt = select(User).where(
            not_(User.username.in_(['trader_bob', 'google_trader']))
        )
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

    async def purge_all_posts(self) -> int:
        """Purge all posts permanently from the social database."""
        from sqlalchemy import delete
        res = await self.db.execute(delete(Post))
        await self.db.commit()
        return res.rowcount or 0

    async def delete_post(self, post_id: str, user_id: str, is_admin: bool = False) -> bool:
        """Permanently delete a post from database. Post author or FxZone Admin can delete any post."""
        if is_admin:
            stmt = select(Post).where(Post.id == post_id)
        else:
            stmt = select(Post).where(and_(Post.id == post_id, Post.user_id == user_id))
        res = await self.db.execute(stmt)
        post = res.scalar_one_or_none()
        if not post:
            return False
        await self.db.delete(post)
        await self.db.commit()
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
        from sqlalchemy import or_, delete, select
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
        from shared.models import Post, Comment, Reaction, Follow, Message, ConversationMember, LiveSession, SessionParticipant, Watchlist, WatchlistItem, post_asset_tags

        try:
            # 1. Purge watchlists
            user_watchlists = await self.db.execute(select(Watchlist.id).where(Watchlist.user_id == u_uuid))
            wl_ids = user_watchlists.scalars().all()
            if wl_ids:
                await self.db.execute(delete(WatchlistItem).where(WatchlistItem.watchlist_id.in_(wl_ids)))
                await self.db.execute(delete(Watchlist).where(Watchlist.user_id == u_uuid))

            # 2. Delete comments & reactions on user's posts
            user_posts = await self.db.execute(select(Post.id).where(Post.user_id == u_uuid))
            post_ids = user_posts.scalars().all()
            if post_ids:
                await self.db.execute(delete(Comment).where(Comment.post_id.in_(post_ids)))
                await self.db.execute(delete(Reaction).where(Reaction.post_id.in_(post_ids)))
                await self.db.execute(delete(post_asset_tags).where(post_asset_tags.c.post_id.in_(post_ids)))
                await self.db.execute(delete(Post).where(Post.id.in_(post_ids)))

            # 3. Delete comments & reactions authored by user
            await self.db.execute(delete(Comment).where(Comment.user_id == u_uuid))
            await self.db.execute(delete(Reaction).where(Reaction.user_id == u_uuid))

            # 4. Delete follows involving user
            await self.db.execute(delete(Follow).where(or_(Follow.follower_id == u_uuid, Follow.following_id == u_uuid)))

            # 5. Delete messages & conversation memberships
            await self.db.execute(delete(Message).where(Message.sender_id == u_uuid))
            await self.db.execute(delete(ConversationMember).where(ConversationMember.user_id == u_uuid))

            # 6. Delete hosted sessions & session participations
            user_sessions = await self.db.execute(select(LiveSession.id).where(LiveSession.host_id == u_uuid))
            ls_ids = user_sessions.scalars().all()
            if ls_ids:
                await self.db.execute(delete(SessionParticipant).where(SessionParticipant.session_id.in_(ls_ids)))
                await self.db.execute(delete(LiveSession).where(LiveSession.host_id.in_(ls_ids)))
            await self.db.execute(delete(SessionParticipant).where(SessionParticipant.user_id == u_uuid))

            # 7. Delete user record
            await self.db.delete(u)
            await self.db.commit()
            return True
        except Exception as e:
            logger.error(f"Error in delete_user_account for user {user_id}: {e}")
            await self.db.rollback()
            raise e

    async def toggle_bookmark(self, user_id: Any, post_id: Any) -> Dict[str, Any]:
        """Bookmark/save or unsave a post for the authenticated user."""
        import uuid
        try:
            u_uuid = uuid.UUID(str(user_id))
        except ValueError:
            u_uuid = user_id

        try:
            p_uuid = uuid.UUID(str(post_id))
        except ValueError:
            p_uuid = post_id

        from shared.models import Bookmark
        stmt = select(Bookmark).where(and_(Bookmark.user_id == u_uuid, Bookmark.post_id == p_uuid))
        res = await self.db.execute(stmt)
        b = res.scalar_one_or_none()

        is_bookmarked = False
        if b:
            await self.db.delete(b)
        else:
            new_b = Bookmark(user_id=u_uuid, post_id=p_uuid)
            self.db.add(new_b)
            is_bookmarked = True

        await self.db.commit()
        return {"post_id": str(post_id), "is_bookmarked": is_bookmarked}

    async def get_saved_posts(self, user_id: Any, limit: int = 20, offset: int = 0) -> List[Post]:
        """Fetch all posts bookmarked/saved by user."""
        import uuid
        try:
            u_uuid = uuid.UUID(str(user_id))
        except ValueError:
            u_uuid = user_id

        from shared.models import Bookmark
        stmt = (
            select(Post)
            .join(Bookmark, Bookmark.post_id == Post.id)
            .where(Bookmark.user_id == u_uuid)
            .options(selectinload(Post.user), selectinload(Post.tagged_assets))
            .order_by(Bookmark.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        res = await self.db.execute(stmt)
        return list(res.scalars().all())


"""FastAPI router for the FxZone Social Trading network."""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
import aiofiles
import uuid as uuid_mod
import os

from shared.database import get_db
from shared.security import get_current_user
from shared.models import User
from services.social.service import SocialService
from services.social.schemas import (
    PostCreate,
    PostResponse,
    CommentCreate,
    CommentResponse,
    ReactionRequest,
    ReactionResponse,
    FollowResponse,
    UserProfileResponse
)

router = APIRouter(prefix="/api/social", tags=["Social Network"])


@router.get("/feed", response_model=List[PostResponse])
async def get_social_feed(
    limit: int = Query(15, ge=1, le=50),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve the main community social feed, ranked by time-decayed engagement."""
    service = SocialService(db)
    return await service.get_feed(user_id=current_user.id, limit=limit, offset=offset)


@router.post("/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_new_post(
    request: PostCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Publish a new post or a 24-hour expiring story to the social feeds."""
    if current_user.email == 'mthobisimzimela031@gmail.com' or current_user.username == 'admin' or current_user.role == 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FxZone Admin account is restricted from posting directly to the social feed."
        )
    service = SocialService(db)
    return await service.create_post(user_id=current_user.id, data=request)


@router.get("/posts/{post_id}", response_model=PostResponse)
async def get_single_post(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve details of a single post by ID."""
    service = SocialService(db)
    post = await service.get_post_by_id(post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found."
        )
    return post


@router.post("/posts/{post_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def comment_on_post(
    post_id: str,
    request: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Publish a comment on a specific post thread."""
    service = SocialService(db)
    # Verify post exists
    post = await service.get_post_by_id(post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found."
        )
    return await service.add_comment(user_id=current_user.id, post_id=post_id, data=request)


@router.get("/posts/{post_id}/comments", response_model=List[CommentResponse])
async def get_comments(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve comments for a specific post, chronologically ordered."""
    service = SocialService(db)
    return await service.get_post_comments(post_id=post_id)


@router.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a comment by ID (author or Admin)."""
    service = SocialService(db)
    is_admin = (current_user.email == 'mthobisimzimela031@gmail.com' or current_user.username == 'admin' or current_user.role == 'admin')
    deleted = await service.delete_comment(comment_id=comment_id, user_id=current_user.id, is_admin=is_admin)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found or unauthorized to delete."
        )
    return {"status": "success", "message": "Comment deleted successfully."}


@router.post("/posts/{post_id}/react", response_model=ReactionResponse)
async def react_to_post(
    post_id: str,
    request: ReactionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Toggle a reaction (e.g. 'like') on a specific post."""
    service = SocialService(db)
    try:
        res = await service.toggle_reaction(user_id=current_user.id, post_id=post_id, reaction_type=request.reaction_type)
        return res
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/users/{following_id}/follow", response_model=FollowResponse)
async def follow_user(
    following_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Toggle follow/unfollow status for a target user ID."""
    service = SocialService(db)
    try:
        res = await service.toggle_follow(follower_id=current_user.id, following_id=following_id)
        return res
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/users/{user_id}", response_model=UserProfileResponse)
async def get_user_profile(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve profile details and follow stats of a specific user."""
    service = SocialService(db)
    try:
        res = await service.get_user_profile(target_user_id=user_id, current_user_id=current_user.id)
        return res
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/users/{user_id}/posts", response_model=List[PostResponse])
async def get_user_posts(
    user_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve feed posts published by a specific user."""
    service = SocialService(db)
    return await service.get_user_posts(user_id=user_id, limit=limit, offset=offset)


@router.get("/stories", response_model=List[PostResponse])
async def get_stories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve active 24-hour stories shared by followed accounts or hot traders."""
    service = SocialService(db)
    return await service.get_active_stories(user_id=current_user.id)


@router.post("/stories", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_story(
    request: PostCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Publish a 24-hour expiring story (auto-sets is_story=True)."""
    # Force story flag regardless of what client sends
    story_data = PostCreate(
        content=request.content,
        image_url=request.image_url,
        asset_tags=request.asset_tags,
        is_story=True,
    )
    service = SocialService(db)
    return await service.create_post(user_id=current_user.id, data=story_data)


ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.webm', '.pdf'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


@router.post("/posts/upload")
async def upload_post_media(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload a media file (image, video, document) for a social post."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Generate unique filename
    unique_name = f"{uuid_mod.uuid4().hex}{ext}"
    upload_path = os.path.join("uploads", unique_name)

    # Stream write to disk
    try:
        async with aiofiles.open(upload_path, "wb") as out_file:
            while chunk := await file.read(1024 * 64):  # 64KB chunks
                await out_file.write(chunk)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

    file_url = f"/uploads/{unique_name}"
    return {"url": file_url, "filename": file.filename, "size": os.path.getsize(upload_path)}


@router.get("/users")
async def list_all_users(
    q: str = Query("", description="Search by username or display name"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List/search users for the Discover page. Supports search by username or display name."""
    service = SocialService(db)
    return await service.get_all_users(query=q, limit=limit, offset=offset, current_user_id=current_user.id)


@router.delete("/posts/purge-all")
async def purge_all_posts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Purge all posts from the social feed (Admin only)."""
    is_admin = (
        current_user.username == 'admin' 
        or current_user.role == 'admin' 
        or (hasattr(current_user.role, 'value') and current_user.role.value == 'admin')
        or current_user.email == 'mthobisimzimela031@gmail.com'
    )
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only platform administrators can purge social posts."
        )
    service = SocialService(db)
    count = await service.purge_all_posts()
    return {"status": "success", "message": f"Purged {count} posts successfully."}


@router.delete("/posts/{post_id}")
async def delete_post(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a post. Post author or FxZone Admin can delete any post."""
    service = SocialService(db)
    is_admin = (
        current_user.username == 'admin' 
        or current_user.role == 'admin' 
        or (hasattr(current_user.role, 'value') and current_user.role.value == 'admin')
        or current_user.email == 'mthobisimzimela031@gmail.com'
    )
    deleted = await service.delete_post(post_id=post_id, user_id=current_user.id, is_admin=is_admin)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found or unauthorized to delete."
        )
    return {"status": "success", "message": "Post deleted successfully."}


@router.post("/posts/{post_id}/pin", response_model=PostResponse)
async def pin_post(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Toggle pinned status for a post authored by the user."""
    service = SocialService(db)
    post = await service.toggle_pin_post(post_id=post_id, user_id=current_user.id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found or unauthorized to pin."
        )
    return post


@router.post("/posts/{post_id}/bookmark")
async def toggle_bookmark_post(
    post_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Bookmark/save or unsave a post for the authenticated user."""
    service = SocialService(db)
    return await service.toggle_bookmark(user_id=current_user.id, post_id=post_id)


@router.get("/posts/saved", response_model=List[PostResponse])
async def get_saved_posts(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetch user's bookmarked/saved posts."""
    service = SocialService(db)
    posts = await service.get_saved_posts(user_id=current_user.id, limit=limit, offset=offset)
    return [format_post(p, current_user_id=current_user.id) for p in posts]


@router.delete("/users/me")
async def delete_my_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Permanently delete the authenticated user's account and purge all associated data."""
    service = SocialService(db)
    success = await service.delete_user_account(user_id=current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found."
        )
    return {"status": "success", "message": "Account and all associated user data permanently deleted."}

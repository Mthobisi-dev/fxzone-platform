import asyncio
import logging
import random
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from shared.database import AsyncSessionLocal
from shared.models import User, Post
from services.ai_assistant.llm_client import get_llm_client

logger = logging.getLogger(__name__)

SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60  # 604,800 seconds

async def start_bot_poster():
    """Background task that runs on a strict 1-week cadence to post text-only market insights as FxZone Bot."""
    llm = get_llm_client()
    
    while True:
        try:
            async with AsyncSessionLocal() as db:
                # Find FxZone Bot user
                res = await db.execute(select(User).where(User.username == 'fxzone_bot'))
                bot_user = res.scalar_one_or_none()
                
                if bot_user:
                    # Check the timestamp of the last post created by FxZone Bot
                    last_post_res = await db.execute(
                        select(Post).where(Post.user_id == bot_user.id).order_by(Post.created_at.desc())
                    )
                    last_post = last_post_res.scalars().first()
                    
                    should_post = False
                    if not last_post:
                        should_post = True
                    else:
                        time_since_last_post = (datetime.utcnow() - last_post.created_at).total_seconds()
                        if time_since_last_post >= SEVEN_DAYS_SECONDS:
                            should_post = True
                        else:
                            logger.info(
                                f"FxZone Bot weekly post skipped — last post was {int(time_since_last_post / 3600)}h ago. "
                                f"Next post scheduled in {int((SEVEN_DAYS_SECONDS - time_since_last_post) / 3600)}h."
                            )

                    if should_post:
                        prompt = (
                            "Generate a concise, professional, high-impact weekly market update post for forex and crypto traders. "
                            "Include key technical levels, sentiment, and macro outlook for BTCUSD, EURUSD, or Gold (XAUUSD). "
                            "Do not include any images or links. Keep it engaging with bullet points and emojis. Max 250 words."
                        )
                        content = await llm.generate(prompt, system_prompt="You are FxZone Bot, an elite AI financial market analyst.")
                        
                        if content and len(content) > 20:
                            new_post = Post(
                                user_id=bot_user.id,
                                content=content,
                                image_url=None,
                                likes_count=0,
                                comments_count=0,
                                reposts_count=0
                            )
                            db.add(new_post)
                            await db.commit()
                            logger.info(f"FxZone Bot published a new weekly AI market update post (ID: {new_post.id}).")
        except Exception as e:
            logger.error(f"Error in FxZone Bot background poster: {e}")
            
        # Check every 1 hour if a week has elapsed
        await asyncio.sleep(3600)

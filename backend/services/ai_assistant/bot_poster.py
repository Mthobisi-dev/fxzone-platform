import asyncio
import logging
import random
from sqlalchemy import select
from shared.database import AsyncSessionLocal
from shared.models import User, Post
from services.ai_assistant.llm_client import get_llm_client

logger = logging.getLogger(__name__)

MARKET_CHART_PHOTOS = [
    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1535320903710-d993d3d77d29?auto=format&fit=crop&w=1000&q=80"
]

async def start_bot_poster():
    """Background task that runs periodically (once a day) to post text-only market insights as FxZone Bot."""
    llm = get_llm_client()
    
    while True:
        try:
            async with AsyncSessionLocal() as db:
                # Find FxZone Bot user
                res = await db.execute(select(User).where(User.username == 'fxzone_bot'))
                bot_user = res.scalar_one_or_none()
                
                if bot_user:
                    prompt = (
                        "Generate a concise, professional, high-impact market update post for forex and crypto traders. "
                        "Include key technical levels, sentiment, and current macro trends for BTCUSD, EURUSD, or Gold (XAUUSD). "
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
                        logger.info(f"FxZone Bot published a new text-only AI market update post (ID: {new_post.id}).")
        except Exception as e:
            logger.error(f"Error in FxZone Bot background poster: {e}")
            
        # Wait 24 hours (86400 seconds) between automated posts
        await asyncio.sleep(86400)

def json_dumps_tags(tags):
    import json
    return json.dumps(tags)

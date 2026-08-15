"""Production Database Initialization & Verification Script.

Ensures all PostgreSQL tables, indexes, and required system records exist
without modifying or overwriting any existing user data.
"""
import asyncio
import os
import sys
import logging

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.database import init_all_databases, AsyncSessionLocal
from shared.models import Base, User, UserRole
from shared.security import hash_password
from sqlalchemy import select

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("init_prod_db")

async def init_prod_db():
    logger.info("Initializing database connections and running migrations...")
    await init_all_databases()

    async with AsyncSessionLocal() as session:
        # Check for FxZone Admin
        admin_res = await session.execute(
            select(User).where(User.email.in_(["admin@fxzone.io", "mthobisimzimela031@gmail.com"]))
        )
        admin = admin_res.scalars().first()
        if not admin:
            logger.info("Creating default administrator account...")
            new_admin = User(
                email="mthobisimzimela031@gmail.com",
                username="fxzone_admin",
                display_name="FxZone Administrator",
                hashed_password=hash_password("admin"),
                role=UserRole.admin,
                is_active=True,
                bio="Official FxZone Platform System Administrator."
            )
            session.add(new_admin)
            await session.commit()
            logger.info("Admin account created successfully.")
        else:
            logger.info(f"Admin account verified: {admin.email}")

        # Check for FxZone Bot
        bot_res = await session.execute(
            select(User).where(User.username == "fxzone_bot")
        )
        bot = bot_res.scalars().first()
        if not bot:
            logger.info("Creating FxZone AI Bot account...")
            new_bot = User(
                email="bot@fxzone.io",
                username="fxzone_bot",
                display_name="FxZone Bot",
                hashed_password=hash_password("FxZoneBotSecure2026!"),
                role=UserRole.analyst,
                is_active=True,
                bio="Official FxZone AI Market Analyst bot delivering weekly market updates and technical outlooks."
            )
            session.add(new_bot)
            await session.commit()
            logger.info("FxZone Bot account created successfully.")
        else:
            logger.info("FxZone Bot verified.")

    logger.info("Production database initialization complete and verified.")

if __name__ == "__main__":
    asyncio.run(init_prod_db())

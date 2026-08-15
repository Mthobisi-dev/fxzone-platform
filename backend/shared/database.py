"""FxZone shared database connections and session management."""
import asyncio
import logging
import uuid
import os
import time
from typing import Dict, Any, List, Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
try:
    from motor.motor_asyncio import AsyncIOMotorClient
    _HAS_MOTOR = True
except ImportError:
    _HAS_MOTOR = False

try:
    import aioredis
    _HAS_AIOREDIS = True
except (ImportError, ModuleNotFoundError):
    _HAS_AIOREDIS = False

from config import settings

logger = logging.getLogger(__name__)

# ============================================================
# Mock Implementations for Offline Services
# ============================================================

class MockMongoCollection:
    def __init__(self, name: str):
        self.name = name
        self.documents = []

    async def count_documents(self, filter_query=None):
        filter_query = filter_query or {}
        if not filter_query:
            return len(self.documents)
        count = 0
        for doc in self.documents:
            match = True
            for k, v in filter_query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                count += 1
        return count

    async def find_one(self, filter_query):
        for doc in self.documents:
            match = True
            for k, v in filter_query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                return doc
        return None

    def aggregate(self, pipeline):
        match_query = {}
        for stage in pipeline:
            if "$match" in stage:
                match_query = stage["$match"]
                
        matched_docs = []
        for doc in self.documents:
            match = True
            for k, v in match_query.items():
                val = doc.get(k)
                if isinstance(val, list):
                    if v not in val:
                        match = False
                        break
                elif val != v:
                    match = False
                    break
            if match:
                matched_docs.append(doc)
                
        avg_sentiment = 0.0
        if matched_docs:
            scores = [doc.get("sentiment_score", 0.0) for doc in matched_docs]
            avg_sentiment = sum(scores) / len(scores)
            
        class MockAggregateCursor:
            def __init__(self, data):
                self.data = data
            async def to_list(self, length=0):
                return self.data
                
        return MockAggregateCursor([{"_id": None, "avg_sentiment": avg_sentiment}])

    async def insert_one(self, document):
        """Insert a single document into the mock collection."""
        if "_id" not in document:
            document["_id"] = str(uuid.uuid4())
        self.documents.append(document)
        class MockInsertResult:
            def __init__(self, inserted_id):
                self.inserted_id = inserted_id
        return MockInsertResult(document["_id"])

    async def update_one(self, filter_query, update, upsert=False):
        """Update a single document matching the filter."""
        target_doc = None
        for doc in self.documents:
            match = True
            for k, v in filter_query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                target_doc = doc
                break

        if target_doc is not None:
            if "$set" in update:
                target_doc.update(update["$set"])
            if "$push" in update:
                for k, v in update["$push"].items():
                    if k not in target_doc:
                        target_doc[k] = []
                    target_doc[k].append(v)
        elif upsert:
            new_doc = dict(filter_query)
            if "$set" in update:
                new_doc.update(update["$set"])
            if "_id" not in new_doc:
                new_doc["_id"] = str(uuid.uuid4())
            self.documents.append(new_doc)

        class MockUpdateResult:
            def __init__(self, matched, modified):
                self.matched_count = matched
                self.modified_count = modified
        return MockUpdateResult(1 if target_doc else 0, 1 if target_doc else 0)

    async def delete_one(self, filter_query):
        """Delete a single document matching the filter."""
        for i, doc in enumerate(self.documents):
            match = True
            for k, v in filter_query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                self.documents.pop(i)
                return


    def find(self, filter_query=None, projection=None, limit=0, sort=None):
        filter_query = filter_query or {}
        results = []
        for doc in self.documents:
            match = True
            for k, v in filter_query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                results.append(doc)
        
        if sort:
            for key, direction in reversed(sort):
                results.sort(key=lambda x: x.get(key) if x.get(key) is not None else "", reverse=(direction == -1))
        
        if limit:
            results = results[:limit]

        class MockCursor:
            def __init__(self, items):
                self.items = items
                self.index = 0
            
            def sort(self, *args, **kwargs):
                return self
            
            def limit(self, l):
                self.items = self.items[:l]
                return self
                
            def skip(self, s):
                self.items = self.items[s:]
                return self

            def __aiter__(self):
                return self

            async def __anext__(self):
                if self.index < len(self.items):
                    val = self.items[self.index]
                    self.index += 1
                    return val
                raise StopAsyncIteration

            async def to_list(self, length=None):
                if length is not None:
                    return self.items[:length]
                return self.items

        return MockCursor(results)

    async def insert_one(self, document):
        if '_id' not in document:
            document['_id'] = str(uuid.uuid4())
        self.documents.append(document)
        class InsertOneResult:
            inserted_id = document['_id']
        return InsertOneResult()

    async def insert_many(self, documents):
        for doc in documents:
            if '_id' not in doc:
                doc['_id'] = str(uuid.uuid4())
            self.documents.append(doc)
        class InsertManyResult:
            inserted_ids = [doc['_id'] for doc in documents]
        return InsertManyResult()

    async def create_index(self, keys, **kwargs):
        return "index_created"


class MockMongoDatabase:
    def __init__(self):
        self.collections = {}

    def __getattr__(self, name: str) -> MockMongoCollection:
        if name not in self.collections:
            self.collections[name] = MockMongoCollection(name)
        return self.collections[name]

    def __getitem__(self, name: str) -> MockMongoCollection:
        return self.__getattr__(name)


class MockMongoClient:
    def __init__(self, uri: str):
        self.uri = uri
        self.db = MockMongoDatabase()

    def __getattr__(self, name: str) -> MockMongoDatabase:
        return self.db

    def __getitem__(self, name: str) -> MockMongoDatabase:
        return self.db

    def close(self):
        pass


class MockPubSub:
    async def subscribe(self, *args, **kwargs):
        pass
    async def listen(self):
        while True:
            await asyncio.sleep(30)
            yield {"type": "message", "channel": "dummy", "data": "{}"}


class MockPipeline:
    def __init__(self, client):
        self.client = client
        self.commands = []
    
    def incr(self, key, amount=1):
        self.commands.append(('incr', key, amount))
        return self

    def expire(self, key, seconds):
        self.commands.append(('expire', key, seconds))
        return self

    async def execute(self):
        results = []
        for cmd in self.commands:
            method_name, *args = cmd
            if method_name == 'incr':
                key, amount = args
                val = self.client._get_value(key)
                if val is None:
                    val = 0
                try:
                    val = int(val) + amount
                except (ValueError, TypeError):
                    val = amount
                
                # Keep old expiration if key exists
                expires_at = self.client.store[key]["expires_at"] if key in self.client.store else None
                self.client._set_value(key, val, expires_at)
                results.append(val)
            elif method_name == 'expire':
                key, seconds = args
                if key in self.client.store:
                    self.client.store[key]["expires_at"] = time.time() + seconds
                    results.append(True)
                else:
                    results.append(False)
        self.commands = []
        return results


class MockRedis:
    def __init__(self):
        self.store = {}  # key -> {"val": str, "expires_at": float | None}
        self.streams = {}

    def _get_value(self, key):
        if key not in self.store:
            return None
        item = self.store[key]
        if item["expires_at"] is not None and time.time() > item["expires_at"]:
            del self.store[key]
            return None
        return item["val"]

    def _set_value(self, key, val, expires_at=None):
        self.store[key] = {"val": str(val), "expires_at": expires_at}

    async def ping(self):
        return True

    async def get(self, key):
        return self._get_value(key)

    async def set(self, key, value, ex=None, px=None, nx=False, xx=False):
        expires_at = time.time() + ex if ex is not None else None
        self._set_value(key, value, expires_at)
        return True

    async def delete(self, *keys):
        count = 0
        for k in keys:
            if k in self.store:
                del self.store[k]
                count += 1
        return count

    async def incr(self, key, amount=1):
        val = self._get_value(key)
        if val is None:
            val = 0
        try:
            val = int(val) + amount
        except (ValueError, TypeError):
            val = amount
        
        expires_at = self.store[key]["expires_at"] if key in self.store else None
        self._set_value(key, val, expires_at)
        return val

    async def expire(self, key, seconds):
        if key in self.store:
            self.store[key]["expires_at"] = time.time() + seconds
            return True
        return False

    def pipeline(self):
        return MockPipeline(self)

    async def xadd(self, stream, fields, maxlen=None):
        if stream not in self.streams:
            self.streams[stream] = []
        message_id = f"{int(asyncio.get_event_loop().time()) * 1000}-{len(self.streams[stream])}"
        self.streams[stream].append((message_id, fields))
        return message_id

    async def xgroup_create(self, stream, group, id="0", mkstream=False):
        return True

    async def xreadgroup(self, group, consumer, streams, count=None, block=None):
        if not hasattr(self, '_stream_group_offsets'):
            self._stream_group_offsets = {}
        
        await asyncio.sleep(block / 1000.0 if block else 0.1)
        
        messages = []
        for stream_name, target in streams.items():
            if stream_name not in self.streams or not self.streams[stream_name]:
                continue
            
            offset_key = (stream_name, group)
            start_idx = self._stream_group_offsets.get(offset_key, 0)
            
            entries = self.streams[stream_name][start_idx:]
            if entries:
                if count:
                    entries = entries[:count]
                self._stream_group_offsets[offset_key] = start_idx + len(entries)
                messages.append((stream_name, entries))
        
        return messages

    async def xack(self, stream, group, *ids):
        return len(ids)

    def pubsub(self, *args, **kwargs):
        return MockPubSub()

    async def publish(self, channel, message):
        return 1

    async def close(self):
        pass


# ============================================================
# SQLAlchemy Engine (Supabase PostgreSQL / Render PostgreSQL / SQLite fallback)
# ============================================================
_use_sqlite = False
_db_source = "local"

try:
    import asyncpg
    db_url = settings.async_database_url

    # Detect Supabase connection
    if settings.use_supabase and "supabase" in db_url:
        _db_source = "supabase"
        logger.info(f"Database configured for Supabase PostgreSQL: {settings.SUPABASE_URL}")
    elif "render.com" in db_url or "dpg-" in db_url:
        _db_source = "render_postgres"
        logger.info("Database configured for Render Managed PostgreSQL.")
    else:
        logger.info("Database configured for PostgreSQL.")

except (ImportError, ModuleNotFoundError):
    logger.warning("asyncpg driver not available. Forcing SQLite fallback.")
    _use_sqlite = True
    db_url = "sqlite+aiosqlite:///fxzone.db"

if _use_sqlite:
    engine = create_async_engine(
        db_url,
        echo=False,
    )
else:
    connect_args = {}
    is_supabase = "supabase" in db_url.lower() or _db_source == "supabase"

    # Supabase / cloud PostgreSQL requires SSL
    if is_supabase or _db_source in ("supabase", "render_postgres") or "sslmode=require" in settings.DATABASE_URL:
        try:
            import ssl
            ssl_ctx = ssl.create_default_context()
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode = ssl.CERT_NONE
            connect_args["ssl"] = ssl_ctx
        except Exception:
            pass

    # Supabase Transaction Pooler (Port 6543 / Supavisor) requires statement cache disabled in asyncpg
    if is_supabase or ":6543" in db_url or "pooler" in db_url:
        connect_args["statement_cache_size"] = 0
        connect_args["prepared_statement_cache_size"] = 0

    engine = create_async_engine(
        db_url,
        echo=False,
        pool_size=20,
        max_overflow=10,
        pool_pre_ping=True,
        connect_args=connect_args,
    )

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


async def get_db():
    """FastAPI dependency that yields an async database session with auto-commit."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()  # Commit all writes on successful request
        except Exception:
            await session.rollback()  # Roll back on any error
            raise
        finally:
            await session.close()


# MongoDB
_mongo_client = None
_mongo_db = None

# Redis
_redis_client = None


def get_mongodb():
    """Get MongoDB database instance."""
    return _mongo_db


def get_redis():
    """Get Redis client instance."""
    return _redis_client


# Assets-only initialization (only seeds trading pairs if assets table is empty)
async def seed_assets_if_empty():
    """Ensure standard trading assets exist in the database without altering any user data."""
    from shared.models import Asset
    from sqlalchemy import select

    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(select(Asset).limit(1))
            if result.scalars().first() is not None:
                return
        except Exception as e:
            logger.debug(f"Asset check query notice: {e}")
            return

        logger.info("Seeding initial trading asset symbols...")
        initial_assets = [
            # Forex
            ("EURUSD", "Euro / US Dollar", "forex", "The most traded currency pair in the world"),
            ("GBPUSD", "British Pound / US Dollar", "forex", "Cable - major forex pair"),
            ("USDJPY", "US Dollar / Japanese Yen", "forex", "Major pair influenced by BoJ policy"),
            ("AUDUSD", "Australian Dollar / US Dollar", "forex", "Commodity-linked currency pair"),
            ("USDCAD", "US Dollar / Canadian Dollar", "forex", "Loonie - correlated with oil prices"),
            ("NZDUSD", "New Zealand Dollar / US Dollar", "forex", "Kiwi - commodity currency"),
            ("USDCHF", "US Dollar / Swiss Franc", "forex", "Safe haven currency pair"),
            ("EURGBP", "Euro / British Pound", "forex", "European cross pair"),
            # Stocks
            ("AAPL", "Apple Inc.", "stock", "Technology giant - iPhone, Mac, Services"),
            ("GOOGL", "Alphabet Inc.", "stock", "Google parent company - Search, Cloud, AI"),
            ("MSFT", "Microsoft Corp.", "stock", "Software & cloud computing leader"),
            ("AMZN", "Amazon.com Inc.", "stock", "E-commerce and cloud infrastructure"),
            ("TSLA", "Tesla Inc.", "stock", "Electric vehicles and clean energy"),
            ("NVDA", "NVIDIA Corp.", "stock", "GPU and AI chip manufacturer"),
            ("META", "Meta Platforms Inc.", "stock", "Social media and metaverse"),
            # Crypto
            ("BTCUSD", "Bitcoin / US Dollar", "crypto", "The original cryptocurrency"),
            ("ETHUSD", "Ethereum / US Dollar", "crypto", "Smart contract platform"),
            ("SOLUSD", "Solana / US Dollar", "crypto", "High-performance blockchain"),
            ("ADAUSD", "Cardano / US Dollar", "crypto", "Proof-of-stake blockchain platform"),
            ("DOTUSD", "Polkadot / US Dollar", "crypto", "Multi-chain interoperability protocol"),
            ("XRPUSD", "Ripple / US Dollar", "crypto", "Digital payment network"),
        ]

        for symbol, name, atype, desc in initial_assets:
            session.add(Asset(symbol=symbol, name=name, asset_type=atype, description=desc, is_active=True))

        try:
            await session.commit()
            logger.info("Trading assets initialized successfully.")
        except Exception as e:
            await session.rollback()
            logger.warning(f"Failed to seed default assets: {e}")


# ============================================================
# Lifecycle
# ============================================================
async def init_all_databases():
    """Initialize all database connections with fallback logic and auto-migrations."""
    global engine, AsyncSessionLocal, _redis_client, _mongo_client, _mongo_db

    # Determine if we must enforce cloud/PostgreSQL persistence
    is_production = settings.APP_ENV == "production" or bool(os.environ.get("RENDER"))
    has_postgres_configured = (
        bool(os.environ.get("DATABASE_URL")) or
        "supabase" in settings.DATABASE_URL.lower() or
        "render.com" in settings.DATABASE_URL.lower() or
        "dpg-" in settings.DATABASE_URL.lower() or
        is_production
    )

    use_sqlite = _use_sqlite

    if not use_sqlite:
        connected = False
        last_err = None
        # Retry loop for PostgreSQL connection (handles database cold start)
        for attempt in range(1, 4):
            try:
                async with engine.connect() as conn:
                    await conn.execute(text("SELECT 1"))
                connected = True
                logger.info("Connected to PostgreSQL database successfully.")
                break
            except Exception as e:
                last_err = e
                logger.warning(f"PostgreSQL connection attempt {attempt}/3 failed: {e}")
                if attempt < 3:
                    await asyncio.sleep(2.0)

        if connected:
            # Ensure PostgreSQL tables and columns exist idempotently
            async with engine.begin() as conn:
                from shared.models import Base as ModelsBase
                await conn.run_sync(ModelsBase.metadata.create_all)

                # Safe PostgreSQL column additions
                pg_migrations = [
                    "ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT TRUE;",
                    "ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS viewer_count INTEGER DEFAULT 0;",
                    "ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;",
                    "ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;",
                    "ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;",
                    "ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_story BOOLEAN DEFAULT FALSE;",
                    "ALTER TABLE posts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;",
                    "ALTER TABLE posts ADD COLUMN IF NOT EXISTS reposts_count INTEGER DEFAULT 0;",
                    "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS description TEXT;",
                    "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES users(id) ON DELETE CASCADE;",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;",
                ]
                for stmt_sql in pg_migrations:
                    try:
                        await conn.execute(text(stmt_sql))
                    except Exception as e:
                        logger.debug(f"PostgreSQL column migration notice: {e}")

            logger.info("PostgreSQL database tables and schema verified successfully.")
            await seed_assets_if_empty()
        else:
            if has_postgres_configured:
                logger.error(
                    f"CRITICAL: PostgreSQL connection failed in production: {last_err}. "
                    "Refusing to fall back to ephemeral SQLite to protect data permanence."
                )
                raise RuntimeError(f"Cannot connect to production PostgreSQL database: {last_err}") from last_err
            else:
                logger.warning(f"PostgreSQL not reachable ({last_err}). Falling back to SQLite for local development...")
                use_sqlite = True

    if use_sqlite:
        sqlite_url = "sqlite+aiosqlite:///../fxzone.db"
        engine = create_async_engine(
            sqlite_url,
            echo=False,
            connect_args={"timeout": 30.0}
        )
        AsyncSessionLocal = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        async with engine.begin() as conn:
            await conn.execute(text("PRAGMA journal_mode=WAL;"))
            await conn.execute(text("PRAGMA busy_timeout=30000;"))
            await conn.execute(text("PRAGMA synchronous=NORMAL;"))
            await conn.execute(text("PRAGMA cache_size=-64000;"))
            await conn.execute(text("PRAGMA temp_store=MEMORY;"))
            from shared.models import Base as ModelsBase
            await conn.run_sync(ModelsBase.metadata.create_all)

            for col_sql in [
                "ALTER TABLE live_sessions ADD COLUMN requires_approval BOOLEAN DEFAULT 1",
                "ALTER TABLE live_sessions ADD COLUMN viewer_count INTEGER DEFAULT 0",
                "ALTER TABLE live_sessions ADD COLUMN started_at DATETIME",
                "ALTER TABLE live_sessions ADD COLUMN ended_at DATETIME",
                "ALTER TABLE posts ADD COLUMN is_pinned BOOLEAN DEFAULT 0",
                "ALTER TABLE posts ADD COLUMN is_story BOOLEAN DEFAULT 0",
                "ALTER TABLE posts ADD COLUMN expires_at DATETIME",
                "ALTER TABLE posts ADD COLUMN reposts_count INTEGER DEFAULT 0",
                "ALTER TABLE conversations ADD COLUMN description TEXT",
                "ALTER TABLE conversations ADD COLUMN creator_id TEXT REFERENCES users(id)",
                "ALTER TABLE users ADD COLUMN followers_count INTEGER DEFAULT 0",
                "ALTER TABLE users ADD COLUMN following_count INTEGER DEFAULT 0",
            ]:
                try:
                    await conn.execute(text(col_sql))
                except Exception:
                    pass

        logger.info("SQLite database initialized.")
        await seed_assets_if_empty()

    # 2. Initialize Redis / Mock Redis fallback
    if _HAS_AIOREDIS:
        try:
            client = aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
            )
            await asyncio.wait_for(client.ping(), timeout=1.0)
            _redis_client = client
            logger.info("Connected to Redis successfully.")
        except Exception as e:
            logger.warning(f"Redis is offline or failed to connect ({e}). Initializing Mock Redis...")
            _redis_client = MockRedis()
    else:
        logger.warning("aioredis package not available. Initializing Mock Redis...")
        _redis_client = MockRedis()

    # 3. Initialize MongoDB / Mock MongoDB fallback
    if _HAS_MOTOR:
        try:
            client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=1000)
            await asyncio.wait_for(client.admin.command('ping'), timeout=1.0)
            _mongo_client = client
            _mongo_db = client.fxzone
            logger.info("Connected to MongoDB successfully.")
        except Exception as e:
            logger.warning(f"MongoDB is offline or failed to connect ({e}). Initializing Mock MongoDB...")
            _mongo_client = MockMongoClient(settings.MONGODB_URL)
            _mongo_db = _mongo_client.fxzone
    else:
        logger.warning("motor package not available. Initializing Mock MongoDB...")
        _mongo_client = MockMongoClient(settings.MONGODB_URL)
        _mongo_db = _mongo_client.fxzone


async def close_all_databases():
    """Close all database connections."""
    global engine, _redis_client, _mongo_client
    if _redis_client:
        if hasattr(_redis_client, "close") and asyncio.iscoroutinefunction(_redis_client.close):
            await _redis_client.close()
    if _mongo_client:
        _mongo_client.close()
    await engine.dispose()

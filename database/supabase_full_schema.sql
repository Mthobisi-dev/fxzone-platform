-- FxZone Full Schema for Supabase
-- Execute this in Supabase SQL Editor

-- === PART 1: TABLES ===

-- FxZone Database Schema
-- PostgreSQL 16

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE user_role AS ENUM ('trader', 'analyst', 'admin', 'verified_educator');
CREATE TYPE asset_type AS ENUM ('forex', 'stock', 'crypto');
CREATE TYPE session_type_enum AS ENUM ('public', 'private', 'invite_only');
CREATE TYPE session_status_enum AS ENUM ('scheduled', 'live', 'ended');
CREATE TYPE experience_level AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');
CREATE TYPE participant_role AS ENUM ('host', 'viewer', 'co_host');

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar_url TEXT,
    bio TEXT,
    role user_role DEFAULT 'trader',
    is_active BOOLEAN DEFAULT true,
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================
-- ASSETS
-- ============================================================
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    asset_type asset_type NOT NULL,
    description TEXT,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assets_symbol ON assets(symbol);
CREATE INDEX idx_assets_type ON assets(asset_type);

-- ============================================================
-- WATCHLISTS
-- ============================================================
CREATE TABLE watchlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL DEFAULT 'My Watchlist',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_watchlists_user ON watchlists(user_id);

CREATE TABLE watchlist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(watchlist_id, asset_id)
);

CREATE INDEX idx_watchlist_items_watchlist ON watchlist_items(watchlist_id);

-- ============================================================
-- PRICE HISTORY
-- ============================================================
CREATE TABLE price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    open_price DECIMAL(20,8) NOT NULL,
    high_price DECIMAL(20,8) NOT NULL,
    low_price DECIMAL(20,8) NOT NULL,
    close_price DECIMAL(20,8) NOT NULL,
    volume DECIMAL(20,4) DEFAULT 0,
    timeframe VARCHAR(10) DEFAULT '1h',
    timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_price_history_asset_time ON price_history(asset_id, timestamp DESC);

-- ============================================================
-- POSTS (Social)
-- ============================================================
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    image_url TEXT,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    reposts_count INTEGER DEFAULT 0,
    is_story BOOLEAN DEFAULT false,
    is_pinned BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- POST ASSET TAGS (4NF Normalization)
-- ============================================================
CREATE TABLE post_asset_tags (
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, asset_id)
);

CREATE INDEX idx_posts_user ON posts(user_id);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_posts_story ON posts(is_story, expires_at) WHERE is_story = true;

-- ============================================================
-- COMMENTS
-- ============================================================
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);

-- ============================================================
-- REACTIONS
-- ============================================================
CREATE TABLE reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) DEFAULT 'like',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);

CREATE INDEX idx_reactions_post ON reactions(post_id);

-- ============================================================
-- FOLLOWS
-- ============================================================
CREATE TABLE follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);

CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);

-- ============================================================
-- CONVERSATIONS (Chat)
-- ============================================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100),
    is_group BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE conversation_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_conv_members_user ON conversation_members(user_id);
CREATE INDEX idx_conv_members_conv ON conversation_members(conversation_id);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at DESC);

-- ============================================================
-- LIVE SESSIONS
-- ============================================================
CREATE TABLE live_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    session_type session_type_enum DEFAULT 'public',
    status session_status_enum DEFAULT 'scheduled',
    max_participants INTEGER DEFAULT 100,
    viewer_count INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_status ON live_sessions(status);
CREATE INDEX idx_sessions_host ON live_sessions(host_id);

CREATE TABLE session_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role participant_role DEFAULT 'viewer',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    UNIQUE(session_id, user_id)
);

CREATE INDEX idx_session_parts_session ON session_participants(session_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    in_app BOOLEAN DEFAULT true,
    email BOOLEAN DEFAULT false,
    push BOOLEAN DEFAULT true,
    news_alerts BOOLEAN DEFAULT true,
    price_alerts BOOLEAN DEFAULT true,
    social_alerts BOOLEAN DEFAULT true,
    session_alerts BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ML / PERSONALIZATION
-- ============================================================
CREATE TABLE user_behavior_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_behavior_user ON user_behavior_events(user_id, created_at DESC);
CREATE INDEX idx_behavior_type ON user_behavior_events(event_type);

CREATE TABLE user_preference_vectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    risk_preference FLOAT DEFAULT 0.5,
    experience_level experience_level DEFAULT 'beginner',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USER CATEGORY PREFERENCES (4NF Normalization)
-- ============================================================
CREATE TABLE user_category_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_name VARCHAR(50) NOT NULL,
    preference_value FLOAT NOT NULL DEFAULT 0.0,
    UNIQUE(user_id, category_name)
);


-- === PART 2: SEED DATA ===

-- FxZone Seed Data
-- Demo users, assets, watchlists, and sample content with explicit UUIDs

-- ============================================================
-- DEMO USERS (password: demo123)
-- bcrypt hash of 'demo123'
-- ============================================================
INSERT INTO users (id, email, username, password_hash, display_name, avatar_url, bio, role, is_active, followers_count, following_count) VALUES
    ('a0000000000000000000000000000001', 'admin@fxzone.io', 'fxadmin', '$2b$12$YN6uy/YWbPgFJK2XWzhGnuHyDvp4UPqPrbqh6ndgC8sRV0dKY1zXm', 'FxZone Admin', 'https://api.dicebear.com/8.x/initials/svg?seed=FA', 'Platform administrator and market analyst', 'admin', TRUE, 0, 0),
    ('a0000000000000000000000000000002', 'analyst@fxzone.io', 'jackbot_analyst', '$2b$12$YN6uy/YWbPgFJK2XWzhGnuHyDvp4UPqPrbqh6ndgC8sRV0dKY1zXm', 'Jack Bot', 'https://api.dicebear.com/8.x/initials/svg?seed=JB', 'AI-powered market analyst | Forex & Crypto signals | @jackbot_analyst', 'analyst', TRUE, 0, 0),
    ('a0000000000000000000000000000003', 'trader@fxzone.io', 'marcus_trades', '$2b$12$YN6uy/YWbPgFJK2XWzhGnuHyDvp4UPqPrbqh6ndgC8sRV0dKY1zXm', 'Marcus Webb', 'https://api.dicebear.com/8.x/initials/svg?seed=MW', 'Swing trader | BTC & SOL focused | Risk management first', 'trader', TRUE, 0, 0);

-- ============================================================
-- ASSETS
-- ============================================================
-- Forex
INSERT INTO assets (id, symbol, name, asset_type, description, is_active) VALUES
    ('c0000000000000000000000000000001', 'EURUSD', 'Euro / US Dollar', 'forex', 'The most traded currency pair in the world', TRUE),
    ('c0000000000000000000000000000002', 'GBPUSD', 'British Pound / US Dollar', 'forex', 'Cable - major forex pair', TRUE),
    ('c0000000000000000000000000000003', 'USDJPY', 'US Dollar / Japanese Yen', 'forex', 'Major pair influenced by BoJ policy', TRUE),
    ('c0000000000000000000000000000004', 'AUDUSD', 'Australian Dollar / US Dollar', 'forex', 'Commodity-linked currency pair', TRUE),
    ('c0000000000000000000000000000005', 'USDCAD', 'US Dollar / Canadian Dollar', 'forex', 'Loonie - correlated with oil prices', TRUE),
    ('c0000000000000000000000000000006', 'NZDUSD', 'New Zealand Dollar / US Dollar', 'forex', 'Kiwi - commodity currency', TRUE),
    ('c0000000000000000000000000000007', 'USDCHF', 'US Dollar / Swiss Franc', 'forex', 'Safe haven currency pair', TRUE),
    ('c0000000000000000000000000000008', 'EURGBP', 'Euro / British Pound', 'forex', 'European cross pair', TRUE);

-- Stocks
INSERT INTO assets (id, symbol, name, asset_type, description, is_active) VALUES
    ('c0000000000000000000000000000009', 'AAPL', 'Apple Inc.', 'stock', 'Technology giant - iPhone, Mac, Services', TRUE),
    ('c0000000000000000000000000000010', 'GOOGL', 'Alphabet Inc.', 'stock', 'Google parent company - Search, Cloud, AI', TRUE),
    ('c0000000000000000000000000000011', 'MSFT', 'Microsoft Corp.', 'stock', 'Software & cloud computing leader', TRUE),
    ('c0000000000000000000000000000012', 'AMZN', 'Amazon.com Inc.', 'stock', 'E-commerce and cloud infrastructure', TRUE),
    ('c0000000000000000000000000000013', 'TSLA', 'Tesla Inc.', 'stock', 'Electric vehicles and clean energy', TRUE),
    ('c0000000000000000000000000000014', 'NVDA', 'NVIDIA Corp.', 'stock', 'GPU and AI chip manufacturer', TRUE),
    ('c0000000000000000000000000000015', 'META', 'Meta Platforms Inc.', 'stock', 'Social media and metaverse', TRUE);

-- Crypto
INSERT INTO assets (id, symbol, name, asset_type, description, is_active) VALUES
    ('c0000000000000000000000000000016', 'BTCUSD', 'Bitcoin / US Dollar', 'crypto', 'The original cryptocurrency', TRUE),
    ('c0000000000000000000000000000017', 'ETHUSD', 'Ethereum / US Dollar', 'crypto', 'Smart contract platform', TRUE),
    ('c0000000000000000000000000000018', 'SOLUSD', 'Solana / US Dollar', 'crypto', 'High-performance blockchain', TRUE),
    ('c0000000000000000000000000000019', 'ADAUSD', 'Cardano / US Dollar', 'crypto', 'Proof-of-stake blockchain platform', TRUE),
    ('c0000000000000000000000000000020', 'DOTUSD', 'Polkadot / US Dollar', 'crypto', 'Multi-chain interoperability protocol', TRUE),
    ('c0000000000000000000000000000021', 'XRPUSD', 'Ripple / US Dollar', 'crypto', 'Digital payment network', TRUE);

-- ============================================================
-- WATCHLISTS
-- ============================================================
INSERT INTO watchlists (id, user_id, name) VALUES
    ('b0000000000000000000000000000001', 'a0000000000000000000000000000002', 'Forex Majors'),
    ('b0000000000000000000000000000002', 'a0000000000000000000000000000003', 'Crypto Portfolio');

-- Watchlist Items
INSERT INTO watchlist_items (id, watchlist_id, asset_id) VALUES
    ('d0000000000000000000000000000001', 'b0000000000000000000000000000001', 'c0000000000000000000000000000001'),
    ('d0000000000000000000000000000002', 'b0000000000000000000000000000001', 'c0000000000000000000000000000002'),
    ('d0000000000000000000000000000003', 'b0000000000000000000000000000001', 'c0000000000000000000000000000003'),
    ('d0000000000000000000000000000004', 'b0000000000000000000000000000001', 'c0000000000000000000000000000004'),
    ('d0000000000000000000000000000005', 'b0000000000000000000000000000002', 'c0000000000000000000000000000016'),
    ('d0000000000000000000000000000006', 'b0000000000000000000000000000002', 'c0000000000000000000000000000017'),
    ('d0000000000000000000000000000007', 'b0000000000000000000000000000002', 'c0000000000000000000000000000018');

-- ============================================================
-- SAMPLE POSTS
-- ============================================================
INSERT INTO posts (id, user_id, content, likes_count, comments_count, reposts_count, is_story, created_at) VALUES
    ('e0000000000000000000000000000001', 'a0000000000000000000000000000002', 'EUR/USD breaking above the 1.0850 resistance level. The ECB''s hawkish stance is providing strong support. Watch for a retest of 1.0900 this week. Key levels to monitor: Support at 1.0820, resistance at 1.0900. 📊', 24, 8, 0, FALSE, '2026-07-02 12:00:00'),
    ('e0000000000000000000000000000002', 'a0000000000000000000000000000003', 'BTC looking incredibly bullish right now! The halving effect is kicking in and institutional adoption keeps growing. My target remains $80K by Q3. Not financial advice, always DYOR. 🚀🔥', 89, 34, 0, FALSE, '2026-07-02 12:05:00'),
    ('e0000000000000000000000000000003', 'a0000000000000000000000000000002', 'NVIDIA earnings beat expectations again. AI demand driving GPU sales through the roof. This stock is becoming the backbone of the AI revolution. Added to my position today. 💚', 45, 12, 0, FALSE, '2026-07-02 12:10:00'),
    ('e0000000000000000000000000000004', 'a0000000000000000000000000000003', 'Solana ecosystem is exploding! DeFi TVL up 300% this quarter. The speed and low fees make it a serious ETH competitor. Loading up on SOL dips. 🟢', 67, 21, 0, FALSE, '2026-07-02 12:15:00'),
    ('e0000000000000000000000000000005', 'a0000000000000000000000000000001', 'Market Update: Fed minutes released today suggest potential rate pause. This could be bullish for both equities and crypto. Stay alert for volatility around the announcement. ⚡', 112, 43, 0, FALSE, '2026-07-02 12:20:00');

INSERT INTO post_asset_tags (post_id, asset_id) VALUES
    ('e0000000000000000000000000000001', 'c0000000000000000000000000000001'),
    ('e0000000000000000000000000000002', 'c0000000000000000000000000000016'),
    ('e0000000000000000000000000000003', 'c0000000000000000000000000000014'),
    ('e0000000000000000000000000000004', 'c0000000000000000000000000000018'),
    ('e0000000000000000000000000000004', 'c0000000000000000000000000000017'),
    ('e0000000000000000000000000000005', 'c0000000000000000000000000000016'),
    ('e0000000000000000000000000000005', 'c0000000000000000000000000000009'),
    ('e0000000000000000000000000000005', 'c0000000000000000000000000000001');

-- ============================================================
-- FOLLOWS
-- ============================================================
INSERT INTO follows (id, follower_id, following_id) VALUES
    ('f0000000000000000000000000000001', 'a0000000000000000000000000000003', 'a0000000000000000000000000000002'),
    ('f0000000000000000000000000000002', 'a0000000000000000000000000000001', 'a0000000000000000000000000000002');

UPDATE users SET followers_count = 2 WHERE id = 'a0000000000000000000000000000002';
UPDATE users SET following_count = 1 WHERE id = 'a0000000000000000000000000000003';
UPDATE users SET following_count = 1 WHERE id = 'a0000000000000000000000000000001';

-- ============================================================
-- NOTIFICATION PREFERENCES (defaults for demo users)
-- ============================================================
INSERT INTO notification_preferences (id, user_id) VALUES
    ('80000000-0000-0000-0000-000000000001', 'a0000000000000000000000000000001'),
    ('80000000-0000-0000-0000-000000000002', 'a0000000000000000000000000000002'),
    ('80000000-0000-0000-0000-000000000003', 'a0000000000000000000000000000003');

-- ============================================================
-- USER PREFERENCE VECTORS
-- ============================================================
INSERT INTO user_preference_vectors (id, user_id, risk_preference, experience_level) VALUES
    ('90000000-0000-0000-0000-000000000001', 'a0000000000000000000000000000001', 0.5, 'expert'),
    ('90000000-0000-0000-0000-000000000002', 'a0000000000000000000000000000002', 0.4, 'advanced'),
    ('90000000-0000-0000-0000-000000000003', 'a0000000000000000000000000000003', 0.8, 'intermediate');

INSERT INTO user_category_preferences (id, user_id, category_name, preference_value) VALUES
    ('f0000000-0000-0000-0000-000000000001', 'a0000000000000000000000000000001', 'forex', 0.33),
    ('f0000000-0000-0000-0000-000000000002', 'a0000000000000000000000000000001', 'stocks', 0.33),
    ('f0000000-0000-0000-0000-000000000003', 'a0000000000000000000000000000001', 'crypto', 0.33),
    ('f0000000-0000-0000-0000-000000000004', 'a0000000000000000000000000000002', 'forex', 0.8),
    ('f0000000-0000-0000-0000-000000000005', 'a0000000000000000000000000000002', 'stocks', 0.1),
    ('f0000000-0000-0000-0000-000000000006', 'a0000000000000000000000000000002', 'crypto', 0.1),
    ('f0000000-0000-0000-0000-000000000007', 'a0000000000000000000000000000003', 'forex', 0.2),
    ('f0000000-0000-0000-0000-000000000008', 'a0000000000000000000000000000003', 'stocks', 0.1),
    ('f0000000-0000-0000-0000-000000000009', 'a0000000000000000000000000000003', 'crypto', 0.7);

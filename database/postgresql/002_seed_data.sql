-- FxZone Seed Data
-- Demo users, assets, watchlists, and sample content with explicit UUIDs

-- ============================================================
-- DEMO USERS (password: demo123)
-- bcrypt hash of 'demo123'
-- ============================================================
INSERT INTO users (id, email, username, password_hash, display_name, avatar_url, bio, role, is_active, followers_count, following_count) VALUES
    ('a0000000000000000000000000000001', 'admin@fxzone.io', 'fxadmin', '$2b$12$YN6uy/YWbPgFJK2XWzhGnuHyDvp4UPqPrbqh6ndgC8sRV0dKY1zXm', 'FxZone Admin', 'https://api.dicebear.com/8.x/initials/svg?seed=FA', 'Platform administrator and market analyst', 'admin', true, 0, 0),
    ('a0000000000000000000000000000002', 'bot@fxzone.io', 'fxzone_bot', '$2b$12$YN6uy/YWbPgFJK2XWzhGnuHyDvp4UPqPrbqh6ndgC8sRV0dKY1zXm', 'FxZone Bot', 'https://api.dicebear.com/8.x/bottts/svg?seed=FxZoneBot', 'Official FxZone AI Market Analyst powered by Google Gemini. Posting live news updates and market charts.', 'analyst', true, 0, 0);

-- ============================================================
-- ASSETS
-- ============================================================
-- Forex
INSERT INTO assets (id, symbol, name, asset_type, description, is_active) VALUES
    ('c0000000000000000000000000000001', 'EURUSD', 'Euro / US Dollar', 'forex', 'The most traded currency pair in the world', true),
    ('c0000000000000000000000000000002', 'GBPUSD', 'British Pound / US Dollar', 'forex', 'Cable - major forex pair', true),
    ('c0000000000000000000000000000003', 'USDJPY', 'US Dollar / Japanese Yen', 'forex', 'Major pair influenced by BoJ policy', true),
    ('c0000000000000000000000000000004', 'AUDUSD', 'Australian Dollar / US Dollar', 'forex', 'Commodity-linked currency pair', true),
    ('c0000000000000000000000000000005', 'USDCAD', 'US Dollar / Canadian Dollar', 'forex', 'Loonie - correlated with oil prices', true),
    ('c0000000000000000000000000000006', 'NZDUSD', 'New Zealand Dollar / US Dollar', 'forex', 'Kiwi - commodity currency', true),
    ('c0000000000000000000000000000007', 'USDCHF', 'US Dollar / Swiss Franc', 'forex', 'Safe haven currency pair', true),
    ('c0000000000000000000000000000008', 'EURGBP', 'Euro / British Pound', 'forex', 'European cross pair', true);

-- Stocks
INSERT INTO assets (id, symbol, name, asset_type, description, is_active) VALUES
    ('c0000000000000000000000000000009', 'AAPL', 'Apple Inc.', 'stock', 'Technology giant - iPhone, Mac, Services', true),
    ('c0000000000000000000000000000010', 'GOOGL', 'Alphabet Inc.', 'stock', 'Google parent company - Search, Cloud, AI', true),
    ('c0000000000000000000000000000011', 'MSFT', 'Microsoft Corp.', 'stock', 'Software & cloud computing leader', true),
    ('c0000000000000000000000000000012', 'AMZN', 'Amazon.com Inc.', 'stock', 'E-commerce and cloud infrastructure', true),
    ('c0000000000000000000000000000013', 'TSLA', 'Tesla Inc.', 'stock', 'Electric vehicles and clean energy', true),
    ('c0000000000000000000000000000014', 'NVDA', 'NVIDIA Corp.', 'stock', 'GPU and AI chip manufacturer', true),
    ('c0000000000000000000000000000015', 'META', 'Meta Platforms Inc.', 'stock', 'Social media and metaverse', true);

-- Crypto
INSERT INTO assets (id, symbol, name, asset_type, description, is_active) VALUES
    ('c0000000000000000000000000000016', 'BTCUSD', 'Bitcoin / US Dollar', 'crypto', 'The original cryptocurrency', true),
    ('c0000000000000000000000000000017', 'ETHUSD', 'Ethereum / US Dollar', 'crypto', 'Smart contract platform', true),
    ('c0000000000000000000000000000018', 'SOLUSD', 'Solana / US Dollar', 'crypto', 'High-performance blockchain', true),
    ('c0000000000000000000000000000019', 'ADAUSD', 'Cardano / US Dollar', 'crypto', 'Proof-of-stake blockchain platform', true),
    ('c0000000000000000000000000000020', 'DOTUSD', 'Polkadot / US Dollar', 'crypto', 'Multi-chain interoperability protocol', true),
    ('c0000000000000000000000000000021', 'XRPUSD', 'Ripple / US Dollar', 'crypto', 'Digital payment network', true);

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
    ('e0000000000000000000000000000001', 'a0000000000000000000000000000002', 'EUR/USD breaking above the 1.0850 resistance level. The ECB''s hawkish stance is providing strong support. Watch for a retest of 1.0900 this week. Key levels to monitor: Support at 1.0820, resistance at 1.0900. 📊', 24, 8, 0, false, '2026-07-02 12:00:00'),
    ('e0000000000000000000000000000002', 'a0000000000000000000000000000003', 'BTC looking incredibly bullish right now! The halving effect is kicking in and institutional adoption keeps growing. My target remains $80K by Q3. Not financial advice, always DYOR. 🚀🔥', 89, 34, 0, false, '2026-07-02 12:05:00'),
    ('e0000000000000000000000000000003', 'a0000000000000000000000000000002', 'NVIDIA earnings beat expectations again. AI demand driving GPU sales through the roof. This stock is becoming the backbone of the AI revolution. Added to my position today. 💚', 45, 12, 0, false, '2026-07-02 12:10:00'),
    ('e0000000000000000000000000000004', 'a0000000000000000000000000000003', 'Solana ecosystem is exploding! DeFi TVL up 300% this quarter. The speed and low fees make it a serious ETH competitor. Loading up on SOL dips. 🟢', 67, 21, 0, false, '2026-07-02 12:15:00'),
    ('e0000000000000000000000000000005', 'a0000000000000000000000000000001', 'Market Update: Fed minutes released today suggest potential rate pause. This could be bullish for both equities and crypto. Stay alert for volatility around the announcement. ⚡', 112, 43, 0, false, '2026-07-02 12:20:00');

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

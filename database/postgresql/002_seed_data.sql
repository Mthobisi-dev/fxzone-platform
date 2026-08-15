-- FxZone Seed Data
-- Demo users, assets, watchlists, and sample content with explicit UUIDs

-- DEMO USERS removed - users are dynamically registered by real traders

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

-- Assets only


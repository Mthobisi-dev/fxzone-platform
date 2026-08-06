-- ============================================================
-- FxZone Platform — Complete Supabase Database Schema (Idempotent & Safe)
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- fuzzy text search
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- password hashing helpers

-- ============================================================
-- ENUMS (Safe Idempotent Creation & Alteration)
-- ============================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('trader', 'analyst', 'verified_educator', 'admin');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_type') THEN
    CREATE TYPE asset_type AS ENUM ('forex', 'crypto', 'stock', 'commodity', 'index');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_side') THEN
    CREATE TYPE order_side AS ENUM ('buy', 'sell');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_type') THEN
    CREATE TYPE order_type AS ENUM ('market', 'limit', 'stop', 'stop_limit');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM ('pending', 'open', 'filled', 'partially_filled', 'cancelled', 'rejected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sentiment_label') THEN
    CREATE TYPE sentiment_label AS ENUM ('Bullish', 'Bearish', 'Neutral');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_type') THEN
    CREATE TYPE session_type AS ENUM ('webinar', 'analysis', 'live_trade', 'qa');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE notification_type AS ENUM ('follow', 'like', 'comment', 'signal', 'price_alert', 'system');
  END IF;
END $$;

-- Safely add missing enum values to asset_type if it already existed without them
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'commodity';
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'index';
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'crypto';
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'stock';
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'forex';

COMMIT;

-- ============================================================
-- TABLES
-- ============================================================

-- ------------------------------------------------------------
-- 1. USERS & PROFILES (extends Supabase auth.users)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT UNIQUE NOT NULL,
  username        TEXT UNIQUE NOT NULL CHECK (length(username) BETWEEN 3 AND 50),
  display_name    TEXT,
  avatar_url      TEXT DEFAULT 'https://api.dicebear.com/8.x/initials/svg?seed=trader',
  bio             TEXT,
  role            user_role NOT NULL DEFAULT 'trader',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  followers_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  total_pnl       NUMERIC(18, 4) DEFAULT 0,
  win_rate        NUMERIC(5, 2) DEFAULT 0,
  trade_count     INTEGER DEFAULT 0,
  signal_accuracy NUMERIC(5, 2) DEFAULT 0,
  signal_count    INTEGER DEFAULT 0,
  is_verified     BOOLEAN DEFAULT FALSE,
  google_id       TEXT UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2. ASSETS (Tradeable instruments)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol      TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  asset_type  asset_type NOT NULL,
  description TEXT,
  pip_size    NUMERIC(12, 8) DEFAULT 0.0001,
  lot_size    NUMERIC(14, 2) DEFAULT 100000,
  margin_pct  NUMERIC(5, 2) DEFAULT 1.0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure pip_size and lot_size exist on pre-existing assets table
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS pip_size NUMERIC(12, 8) DEFAULT 0.0001;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS lot_size NUMERIC(14, 2) DEFAULT 100000;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS margin_pct NUMERIC(5, 2) DEFAULT 1.0;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Seed assets
INSERT INTO public.assets (symbol, name, asset_type, pip_size, lot_size) VALUES
  ('EURUSD', 'Euro / US Dollar',          'forex'::asset_type,     0.00001, 100000),
  ('GBPUSD', 'British Pound / US Dollar', 'forex'::asset_type,     0.00001, 100000),
  ('USDJPY', 'US Dollar / Japanese Yen',  'forex'::asset_type,     0.001,   100000),
  ('AUDUSD', 'Australian Dollar / USD',   'forex'::asset_type,     0.00001, 100000),
  ('USDCAD', 'US Dollar / Canadian Dollar','forex'::asset_type,    0.00001, 100000),
  ('USDCHF', 'US Dollar / Swiss Franc',   'forex'::asset_type,     0.00001, 100000),
  ('NZDUSD', 'New Zealand Dollar / USD',  'forex'::asset_type,     0.00001, 100000),
  ('EURGBP', 'Euro / British Pound',      'forex'::asset_type,     0.00001, 100000),
  ('XAUUSD', 'Gold / US Dollar',          'commodity'::asset_type, 0.01,    100),
  ('XAGUSD', 'Silver / US Dollar',        'commodity'::asset_type, 0.001,   5000),
  ('BTCUSD', 'Bitcoin / US Dollar',       'crypto'::asset_type,    0.01,    1),
  ('ETHUSD', 'Ethereum / US Dollar',      'crypto'::asset_type,    0.01,    1),
  ('SOLUSD', 'Solana / US Dollar',        'crypto'::asset_type,    0.001,   1),
  ('XRPUSD', 'XRP / US Dollar',           'crypto'::asset_type,    0.00001, 1),
  ('AAPL',   'Apple Inc.',                'stock'::asset_type,     0.01,    1),
  ('GOOGL',  'Alphabet Inc.',             'stock'::asset_type,     0.01,    1),
  ('MSFT',   'Microsoft Corporation',     'stock'::asset_type,     0.01,    1),
  ('NVDA',   'NVIDIA Corporation',        'stock'::asset_type,     0.01,    1),
  ('TSLA',   'Tesla, Inc.',               'stock'::asset_type,     0.01,    1),
  ('META',   'Meta Platforms, Inc.',      'stock'::asset_type,     0.01,    1),
  ('AMZN',   'Amazon.com, Inc.',          'stock'::asset_type,     0.01,    1)
ON CONFLICT (symbol) DO NOTHING;

-- ------------------------------------------------------------
-- 3. WATCHLISTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.watchlists (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT 'My Watchlist',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.watchlist_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  watchlist_id UUID NOT NULL REFERENCES public.watchlists(id) ON DELETE CASCADE,
  asset_id     UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (watchlist_id, asset_id)
);

-- ------------------------------------------------------------
-- 4. ORDERS & POSITIONS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset_id        UUID NOT NULL REFERENCES public.assets(id),
  side            order_side NOT NULL,
  order_type      order_type NOT NULL DEFAULT 'market',
  status          order_status NOT NULL DEFAULT 'pending',
  quantity        NUMERIC(18, 6) NOT NULL CHECK (quantity > 0),
  price           NUMERIC(18, 6),
  stop_loss       NUMERIC(18, 6),
  take_profit     NUMERIC(18, 6),
  filled_at       NUMERIC(18, 6),
  filled_qty      NUMERIC(18, 6) DEFAULT 0,
  commission      NUMERIC(12, 4) DEFAULT 0,
  pnl             NUMERIC(14, 4),
  broker          TEXT DEFAULT 'exness',
  broker_order_id TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.positions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset_id        UUID NOT NULL REFERENCES public.assets(id),
  side            order_side NOT NULL,
  quantity        NUMERIC(18, 6) NOT NULL,
  avg_entry_price NUMERIC(18, 6) NOT NULL,
  unrealized_pnl  NUMERIC(14, 4) DEFAULT 0,
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, asset_id, side)
);

-- ------------------------------------------------------------
-- 5. PRICE ALERTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.price_alerts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset_id     UUID NOT NULL REFERENCES public.assets(id),
  target_price NUMERIC(18, 6) NOT NULL,
  condition    TEXT NOT NULL CHECK (condition IN ('above', 'below')),
  is_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 6. AI INSIGHTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id    UUID REFERENCES public.assets(id),
  symbol      TEXT NOT NULL,
  sentiment   sentiment_label NOT NULL DEFAULT 'Neutral',
  confidence  NUMERIC(4, 3) NOT NULL DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  summary     TEXT,
  analysis    TEXT,
  model_used  TEXT DEFAULT 'gemini-flash',
  user_id     UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 7. NEWS ARTICLES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.news_articles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT NOT NULL,
  summary         TEXT,
  url             TEXT UNIQUE,
  source          TEXT,
  published_at    TIMESTAMPTZ,
  sentiment_score NUMERIC(4, 3),
  sentiment_label sentiment_label DEFAULT 'Neutral',
  asset_tags      TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 8. SOCIAL POSTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.posts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset_id      UUID REFERENCES public.assets(id),
  content       TEXT NOT NULL,
  image_url     TEXT,
  chart_url     TEXT,
  likes_count   INTEGER NOT NULL DEFAULT 0,
  replies_count INTEGER NOT NULL DEFAULT 0,
  is_signal     BOOLEAN DEFAULT FALSE,
  signal_side   order_side,
  signal_entry  NUMERIC(18, 6),
  signal_tp     NUMERIC(18, 6),
  signal_sl     NUMERIC(18, 6),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.post_likes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.post_comments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 9. SOCIAL FOLLOWS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.follows (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follower_id, following_id)
);

-- ------------------------------------------------------------
-- 10. WEBINARS & LIVE SESSIONS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sessions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  session_type session_type NOT NULL DEFAULT 'webinar',
  is_live      BOOLEAN DEFAULT FALSE,
  scheduled_at TIMESTAMPTZ,
  viewer_count INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 11. NOTIFICATIONS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type         notification_type NOT NULL DEFAULT 'system',
  title        TEXT NOT NULL,
  body         TEXT,
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure both recipient_id and user_id columns exist on pre-existing notifications table
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ============================================================
-- AUTOMATED TRIGGERS
-- ============================================================

-- Trigger: auto create profile when a new user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-z0-9_]', '_', 'g')),
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/8.x/initials/svg?seed=' || SPLIT_PART(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: sync follower / following counts
CREATE OR REPLACE FUNCTION public.handle_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    UPDATE public.profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id;
    UPDATE public.profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_follow_counts ON public.follows;
CREATE TRIGGER trg_follow_counts
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.handle_follow();

-- Trigger: sync post like counts
CREATE OR REPLACE FUNCTION public.handle_post_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_likes ON public.post_likes;
CREATE TRIGGER trg_post_likes
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_post_like();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications   ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Profiles readable by public') THEN
    CREATE POLICY "Profiles readable by public" ON public.profiles FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users update own profile') THEN
    CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Watchlists private to owner') THEN
    CREATE POLICY "Watchlists private to owner" ON public.watchlists FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Orders private to owner') THEN
    CREATE POLICY "Orders private to owner" ON public.orders FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Positions private to owner') THEN
    CREATE POLICY "Positions private to owner" ON public.positions FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Posts readable by public') THEN
    CREATE POLICY "Posts readable by public" ON public.posts FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authors manage own posts') THEN
    CREATE POLICY "Authors manage own posts" ON public.posts FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Follows readable by public') THEN
    CREATE POLICY "Follows readable by public" ON public.follows FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own follows') THEN
    CREATE POLICY "Users manage own follows" ON public.follows FOR ALL USING (auth.uid() = follower_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Notifications private') THEN
    CREATE POLICY "Notifications private" ON public.notifications FOR ALL USING (auth.uid() = recipient_id OR auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_orders_user       ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user        ON public.posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_follower  ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_news_asset_tags  ON public.news_articles USING GIN(asset_tags);

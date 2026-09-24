# ⚡ FxZone Platform — AI-Powered Financial Trading & Social Network

[![Next.js](https://img.shields.io/badge/Next.js-16.3.0-black?logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript)](https://www.typescript.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-Vanilla_CSS-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Analyze markets. Understand signals. Trade with AI intelligence.**  
> FxZone is a state-of-the-art fintech web application combining real-time market streams (Forex, Crypto, Commodities), Google Gemini AI technical analysis, direct/group messaging, live trading rooms, and a community social feed built natively on **Next.js** and **Supabase PostgreSQL**.

---

## 🌐 Live Production Deployment

- **Frontend Web Application:** [https://fxzone-platform-4dqe.vercel.app/](https://fxzone-platform-4dqe.vercel.app/)
- **GitHub Repository:** [https://github.com/Mthobisi-dev/fxzone-platform](https://github.com/Mthobisi-dev/fxzone-platform)

---

## ✨ Key Features

### 📈 1. Market Intelligence & Technical Analysis
- **Live Price Feeds & Ticker Streams:** Real-time market data for Forex pairs (`EURUSD`, `GBPUSD`), Cryptocurrencies (`BTCUSD`, `ETHUSD`), and Commodities (`XAUUSD`/Gold).
- **Interactive TradingView Charts:** Full candlestick charting with technical indicators (EMA, RSI, MACD, Volume).
- **Watchlists & Custom Assets:** Personal trader watchlists backed by Supabase persistence.

### 🤖 2. Google Gemini AI Analysis Engine
- **Automated AI Signal Strength:** AI-calculated confidence scores (e.g. Bullish signal strength: `84/100`).
- **Technical & Sentiment Breakdown:** Structured breakdown of trend alignment, RSI state, sentiment analysis, and risk factors.

### 🌐 3. Social Trading Feed & Community
- **Interactive Posts:** Publish market setups, attach chart screenshots, and tag assets (`$BTCUSD`, `$EURUSD`).
- **Real User Engagement:** Like/react to posts, comment on threads, save setups, and manage follows.
- **Admin Moderation & Hard Deletion:** Post owners and platform administrators can delete posts or manage social data.

### 💬 4. Real-Time Chat & Group Profiles
- **Direct & Group Messaging:** Real-time messaging between traders using Supabase Realtime channels.
- **Group Profiles & Management:** Custom group settings, member management, and leave group functionality.

### 🎙️ 5. Live Trading Rooms & Session Management
- **Live Trading Streams:** Real-time participant management, host controls, and WebRTC streaming support.
- **Session History & Controls:** View active and completed live trading streams.

---

## 🛠️ Technology Stack

### Frontend & API Routes
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript
- **UI & Styling:** Tailwind CSS, Lucide React Icons, Framer Motion
- **State Management:** Zustand (Synchronous hydration & session state)

### Backend & Database
- **Backend Architecture:** Next.js App Router API Routes (`/api/*`)
- **Database:** Supabase PostgreSQL with Row Level Security (RLS)
- **Authentication:** Supabase Auth (JWT & OAuth)
- **Real-Time:** Supabase Realtime (WebSockets)
- **AI Integration:** Google Gemini AI API (`google-genai` SDK)

---

## 📁 Repository Structure

```text
fxzone-platform/
├── frontend/                 # Next.js App Router Application & API Routes
│   ├── app/                  # Next.js App Router (Dashboard, Feed, Market, Chat, Sessions)
│   ├── app/api/              # Backend API Route Handlers (Auth, Social, Market, Sessions, Chat, AI)
│   ├── components/           # UI Components (PostCard, ChatWindow, StoryBar, Modals)
│   ├── lib/                  # Server & Client helpers (supabase.ts, server/supabaseServer.ts)
│   ├── stores/               # Zustand stores (authStore, marketStore, socialStore, chatStore)
│   └── public/               # Static assets & media
├── database/                 # Supabase PostgreSQL Schemas & Migrations
└── scripts/                  # Maintenance & helper scripts
```

---

## 🚀 Getting Started Locally

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **yarn**
- **Git**

---

### 1. Clone the Repository
```bash
git clone https://github.com/Mthobisi-dev/fxzone-platform.git
cd fxzone-platform
```

---

### 2. Frontend & API Setup
```bash
cd frontend

# Install dependencies
npm install

# Copy environment example file
cp .env.example .env.local

# Fill in your Supabase credentials in .env.local
# Keep BACKEND_URL=http://localhost:8000 to use the FastAPI backend. Leave it
# blank only when you intentionally want to use the legacy Next.js API routes.
```

### 3. Start Development Server
```bash
npm run dev
```
*The web app will be available at `http://localhost:3000`.*

---

## 📡 API Reference Overview

| Endpoint | Method | Description | Access |
| :--- | :--- | :--- | :--- |
| `/api/auth/me` | `GET`/`PUT`/`DELETE` | User profile & account management | Authenticated |
| `/api/social/feed` | `GET` | Retrieve community social feed posts | Authenticated |
| `/api/social/posts` | `POST` | Create a new market post | Authenticated |
| `/api/social/posts/[id]` | `DELETE` | Delete a post permanently | Owner / Admin |
| `/api/market/watchlist` | `GET`/`POST` | Manage user market watchlists | Authenticated |
| `/api/sessions` | `GET`/`POST`/`DELETE` | List, create, or clear live trading sessions | Authenticated |
| `/api/sessions/[id]/join` | `POST` | Join a live trading session | Authenticated |
| `/api/chat/conversations` | `GET`/`POST` | List and initiate direct or group chats | Authenticated |

---

## ⚠️ Financial Disclaimer

> **Disclaimer:** All market signals, technical charts, AI confidence ratings, and social content presented on FxZone are for **informational and educational purposes only**. They do not constitute financial, investment, or trading advice. Forex, cryptocurrency, and CFD trading carry high risk to your capital.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more details.

---

<p align="center">
  Crafted with ❤️ for traders worldwide by <a href="https://github.com/Mthobisi-dev">Mthobisi</a>.
</p>

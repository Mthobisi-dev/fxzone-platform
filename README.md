# ⚡ FxZone Platform — AI-Powered Financial Trading & Social Network

[![Next.js](https://img.shields.io/badge/Next.js-16.3.0-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109.0-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript)](https://www.typescript.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-Vanilla_CSS-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Analyze markets. Understand signals. Trade with AI intelligence.**  
> FxZone is a state-of-the-art fintech web application combining real-time market streams (Forex, Crypto, Commodities), Google Gemini AI technical analysis, encrypted direct/group messaging, live trading rooms, and a community social feed.

---

## 🌐 Live Production Deployments

- **Frontend Web Application:** [https://fxzone-platform-4dqe.vercel.app/](https://fxzone-platform-4dqe.vercel.app/)
- **Backend API Service:** [https://fxzone-backend.onrender.com](https://fxzone-backend.onrender.com)
- **Interactive API Documentation (Swagger UI):** [https://fxzone-backend.onrender.com/docs](https://fxzone-backend.onrender.com/docs)
- **GitHub Repository:** [https://github.com/Mthobisi-dev/fxzone-platform](https://github.com/Mthobisi-dev/fxzone-platform)

---

## ✨ Key Features

### 📈 1. Market Intelligence & Technical Analysis
- **Live Price Feeds & Ticker Streams:** Real-time low-latency market data for Forex pairs (`EURUSD`, `GBPUSD`), Cryptocurrencies (`BTCUSD`, `ETHUSD`), and Commodities (`XAUUSD`/Gold).
- **Interactive TradingView Charts:** Full candlestick charting with technical indicators (EMA, RSI, MACD, Volume).
- **Order Book Depth:** Visual depth of market order flow analysis.

### 🤖 2. Google Gemini AI Analysis Engine
- **Automated AI Signal Strength:** AI-calculated confidence scores (e.g. Bullish signal strength: `84/100`).
- **Technical & Sentiment Breakdown:** Structured breakdown of EMA trend alignment, RSI oversold/overbought state, sentiment analysis, and risk factors.
- **FxZone Bot Weekly Insights:** Background service generating text-only market setup summaries without decorative image fluff.

### 🌐 3. Social Trading Feed & Community
- **Interactive Posts:** Publish market setups, attach chart screenshots, and tag assets (`$BTCUSD`, `$EURUSD`).
- **Real User Engagement:** Like/react to posts, comment on threads, save/bookmark setups locally, and reshare posts directly to other traders via chat or to your public social feed.
- **FxZone Bot Feed Cleanup:** Clean market signals with restricted actions (Like only, no clutter).
- **Hard Deletion & Purging:** Post owners and platform administrators can permanently delete posts from the PostgreSQL database or purge feeds.

### 💬 4. Real-Time Encrypted Chat & Group Profiles
- **Direct Messaging (1-on-1):** End-to-end encrypted direct messaging between traders.
- **Group Profiles & Management:** Custom group settings, editable group descriptions, member picker, and leave group functionality.

### 🎙️ 5. Live Trading Rooms & Session History
- **Educator Live Streams:** WebSockets-enabled live trading presentation rooms.
- **Session History Controls:** View past live trading streams with complete history clear and single session deletion capabilities.

---

## 🛠️ Technology Stack

### Frontend Architecture
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript
- **UI & Styling:** Tailwind CSS, Lucide React Icons, Framer Motion
- **State Management:** Zustand (Synchronous `localStorage` session hydration & auth initialization)
- **API Client:** Axios / Fetch with automatic 401 token handling & environment rewrites

### Backend Architecture
- **Framework:** FastAPI (Python 3.11+)
- **Database:** PostgreSQL (Production) / SQLite (Development) with Async SQLAlchemy 2.0 & Alembic
- **Real-Time:** Python WebSockets & AsyncIO
- **Security:** OAuth2 JWT Bearer Tokens, Passlib / Bcrypt Password Hashing
- **AI Integration:** Google Gemini AI API (`google-genai` SDK)

---

## 📁 Repository Structure

```text
fxzone-platform/
├── backend/                  # FastAPI Backend Application
│   ├── main.py               # Application entry point & router mounting
│   ├── Procfile              # Production deployment config for Render
│   ├── requirements.txt      # Python dependencies
│   ├── services/             # Domain service modules
│   │   ├── ai_assistant/     # Gemini AI LLM client & bot poster background worker
│   │   ├── auth/             # User registration, login, JWT token auth
│   │   ├── chat/             # 1-on-1 & Group messaging service & WebSockets
│   │   ├── live_sessions/    # Live trading rooms & session history service
│   │   ├── market_data/      # Ticker price streams & order depth provider
│   │   └── social/           # Social feed, posts, reactions, comments, follow service
│   └── shared/               # Database config, models, security dependencies
├── frontend/                 # Next.js Frontend Application
│   ├── app/                  # Next.js App Router (Dashboard, Feed, Market, Chat, Sessions)
│   ├── components/           # UI Components (PostCard, ChatWindow, StoryBar, Modals)
│   ├── hooks/                # Custom React hooks (useAuth)
│   ├── stores/               # Zustand stores (authStore)
│   ├── lib/                  # Utility functions & API client (api.ts)
│   └── next.config.mjs       # Next.js configuration & API proxy rewrites
└── docker-compose.yml        # Multi-container Docker orchestration config
```

---

## 🚀 Getting Started Locally

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Python**: v3.11 or higher
- **Git**

---

### 1. Clone the Repository
```bash
git clone https://github.com/Mthobisi-dev/fxzone-platform.git
cd fxzone-platform
```

---

### 2. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Create .env file in backend directory
cat <<EOT > .env
SECRET_KEY=your_super_secret_jwt_key_here
DATABASE_URL=sqlite+aiosqlite:///../fxzone.db
GEMINI_API_KEY=your_google_gemini_api_key
EOT

# Start FastAPI development server
uvicorn main:app --reload --port 8000
```
*The API will be available at `http://localhost:8000` and docs at `http://localhost:8000/docs`.*

---

### 3. Frontend Setup
Open a new terminal window:
```bash
# Navigate to frontend directory
cd frontend

# Install packages
npm install

# Create .env.local file in frontend directory
cat <<EOT > .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
EOT

# Start Next.js development server
npm run dev
```
*The web app will be available at `http://localhost:3000`.*

---

## 📡 API Reference Overview

| Endpoint | Method | Description | Access |
| :--- | :--- | :--- | :--- |
| `/api/auth/register` | `POST` | Register a new trader account | Public |
| `/api/auth/login` | `POST` | Authenticate trader & retrieve JWT token | Public |
| `/api/auth/me` | `GET` | Get current authenticated user profile | Private |
| `/api/social/feed` | `GET` | Retrieve community social feed posts | Private |
| `/api/social/posts` | `POST` | Create a new market post | Private |
| `/api/social/posts/{id}` | `DELETE` | Delete a post permanently from DB | Owner / Admin |
| `/api/social/posts/purge-all`| `DELETE` | Purge all posts from feed | Admin Only |
| `/api/social/users` | `GET` | Search and discover traders | Private |
| `/api/chat/conversations` | `GET`/`POST` | List and initiate direct or group chats | Private |
| `/api/sessions` | `GET`/`POST` | Get active trading rooms or host a live stream | Private |
| `/api/sessions/history` | `DELETE` | Clear ended live trading session history | Private |

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

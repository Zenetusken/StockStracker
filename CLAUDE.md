# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StockTracker is a stock tracking and portfolio management application with real-time market data. It uses a React frontend with Express backend, SQLite database, and integrates with Finnhub/Alpha Vantage APIs for market data.

## Development Commands

### Quick Start
```bash
./init.sh              # One-time setup (installs dependencies)
./start-dev.sh         # Start both frontend and backend
```

### Backend (Express + SQLite)
```bash
cd backend
npm run dev            # Start with nodemon (port 3001)
npm start              # Start without auto-reload
```

### Frontend (React + Vite)
```bash
cd frontend
npm run dev            # Start dev server (port 5173)
npm run build          # Production build
npm run lint           # Run ESLint
npm run preview        # Preview production build
```

## Architecture

### Backend Structure (`backend/src/`)
- `index.js` - Express server entry point with middleware setup
- `database.js` - SQLite database initialization and schema (WAL mode)
- `routes/` - API route handlers:
  - `auth.js` - User registration, login, session management
  - `quotes.js` - Stock quote endpoints
  - `stream.js` - SSE endpoint for real-time updates
  - `watchlists.js` - Watchlist CRUD operations
  - `search.js` - Symbol search
- `services/` - External API integrations:
  - `finnhub.js` - Primary market data (quotes, profiles, news)
  - `alphavantage.js` - Technical indicators (SMA, RSI, MACD)
- `middleware/` - Auth middleware, validation
- `utils/` - Utility functions

### Frontend Structure (`frontend/src/`)
- `App.jsx` - Main app with React Router
- `store/` - Zustand stores for global state (quotes, portfolio, alerts)
- `components/` - Reusable UI components:
  - `StockChart.jsx` - TradingView Lightweight Charts integration
  - `SearchBar.jsx` - Symbol search with autocomplete
  - `Sidebar.jsx` - Navigation with watchlist links
  - `Layout.jsx` - Page layout wrapper
- `pages/` - Route components:
  - `Dashboard.jsx` - Main dashboard view
  - `StockDetail.jsx` - Individual stock page with chart
  - `WatchlistDetail.jsx` - Watchlist management
  - `LoginPage.jsx`, `RegisterPage.jsx` - Auth pages
- `hooks/` - Custom React hooks
- `utils/` - Utility functions

### Key Technologies
- **Charts**: Lightweight Charts (TradingView) for candlestick/line charts
- **Tables**: TanStack Table + TanStack Virtual for large lists
- **State**: Zustand for global state management
- **Styling**: Tailwind CSS
- **Auth**: bcrypt + express-session
- **Real-time**: Server-Sent Events (SSE) at `/api/stream/quotes`
- **Database**: SQLite with better-sqlite3 (WAL mode)

## Environment Setup

### Configuration File
All environment variables are configured in `.env` in the project root. Copy from template:
```bash
cp .env.example .env
```

### Required API Keys

| Variable | Service | Purpose | Get Key |
|----------|---------|---------|---------|
| `FINNHUB_API_KEY` | Finnhub | Real-time quotes, profiles, news | [finnhub.io/register](https://finnhub.io/register) |
| `ALPHAVANTAGE_API_KEY` | Alpha Vantage | Historical OHLCV data (charts) | [alphavantage.co](https://www.alphavantage.co/support/#api-key) |

### Environment Variables

```bash
# API Keys (required for full functionality)
FINNHUB_API_KEY=your_key_here      # Primary - quotes, search, news
ALPHAVANTAGE_API_KEY=your_key_here # Secondary - historical chart data

# Server Configuration
PORT=3001                          # Backend API port
NODE_ENV=development               # Environment mode

# Session
SESSION_SECRET=your_secret_here    # Change in production!
```

### API Rate Limits
- **Finnhub**: 60 calls/minute (free tier) - uses in-memory caching
- **Alpha Vantage**: 25 calls/day, 5 calls/minute (free tier)

### Key Loading Priority
1. Environment variable (from `.env` via dotenv)
2. File-based key (`/tmp/api-key/` - legacy support)
3. Demo mode (limited functionality)

## Testing

The project includes `feature_list.json` with 200+ test cases. Many test scripts exist in the root directory (e.g., `test-*.js`, `test-*.mjs`) for automated testing via Puppeteer.

## Code Style

- **Frontend**: React function components with hooks, JSX
- **Backend**: ES modules (`type: "module"`), async/await, Express patterns
- **Database**: Always use parameterized queries to prevent SQL injection

# StockTracker

![React](https://img.shields.io/badge/React-18.2-61DAFB?style=flat&logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat&logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat&logo=sqlite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=flat&logo=vite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg)

A real-time stock tracking and portfolio management application with interactive charts, watchlists, and multi-theme support.

<p align="center">
  <img src="docs/UI_SCREENSHOT.png" alt="StockTracker Dashboard" width="800">
  <br>
  <em>Dashboard with recently viewed stocks, instant preview panel, and the Jade Requiem theme</em>
</p>

## Why StockTracker?

### Zero API Costs with Smart Key Rotation

Most stock apps hit API rate limits within minutes. **StockTracker solves this** with an enterprise-grade API management system designed for free-tier sustainability:

| Challenge | StockTracker Solution |
|-----------|----------------------|
| Rate limits kill free tiers | **Intelligent key rotation** - automatically cycles through multiple API keys |
| API calls are wasted | **Smart caching** - reduces redundant calls by 90%+ |
| One provider goes down | **Multi-provider fallback** - Finnhub → Alpha Vantage → Yahoo Finance |
| No visibility into usage | **Real-time rate limit tracking** - SSE notifications before you hit limits |

### Built for Developers

- **Bring Your Own Keys** - Users can add their own API keys, spreading load across the community
- **Graceful Degradation** - App remains functional even when rate-limited (cached data, reduced refresh)
- **Usage Dashboard** - See exactly how many API calls remain per provider
- **Production Patterns** - Learn real-world API management, caching, and rate limiting strategies

### Modern Full-Stack Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React 18 + Zustand + TailwindCSS + Lightweight Charts      │
├─────────────────────────────────────────────────────────────┤
│  Express API + SQLite (WAL) + SSE Real-time Streaming       │
├─────────────────────────────────────────────────────────────┤
│  API Key Rotation │ Multi-Provider │ Smart Cache │ Fallback │
└─────────────────────────────────────────────────────────────┘
```

## Features

### Core Trading Tools
- **Real-time Quotes** - Live price updates via Server-Sent Events (SSE)
- **Interactive Charts** - Candlestick/line/area charts with technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands)
- **Watchlist Management** - Custom icons, colors, drag-and-drop ordering, CSV export
- **Search Preview** - Live quote preview on hover with keyboard navigation

### Portfolio Management
- **Full Transaction Tracking** - Buy, sell, dividend, and stock split support
- **Tax Lot Accounting** - FIFO-based cost basis with short-term/long-term capital gains
- **Realized Gains Report** - Track and export your tax-relevant transactions
- **Performance Analytics** - Portfolio value charts, allocation pie charts, benchmark comparison vs S&P 500
- **Top/Bottom Performers** - Quickly identify your best and worst holdings

### Market Intelligence
- **Market Overview Dashboard** - Major indices, top gainers/losers, most active stocks
- **Sector Heatmap** - Visual sector performance at a glance
- **Economic Calendar** - Upcoming market events with related stock links
- **Stock Screener** - Filter stocks by market cap, P/E ratio, sector, and more

### User Experience
- **Beautiful Themes** - Multiple professionally designed themes including Jade Requiem
- **Offline Detection** - Graceful handling when network is unavailable
- **Accessibility** - Skip-to-main, keyboard navigation, ARIA labels
- **API Key Management** - User-managed API keys with real-time rate limit tracking

## Tech Stack

| Frontend | Backend | Data |
|----------|---------|------|
| React 18 | Node.js + Express | Finnhub API |
| Zustand | SQLite (WAL mode) | Alpha Vantage |
| TailwindCSS | express-session | Yahoo Finance |
| Lightweight Charts | bcrypt | SSE streaming |

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd StockTracker
./init.sh
```

### 2. Configure API Keys

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

| Variable | Required | Get Key |
|----------|----------|---------|
| `FINNHUB_API_KEY` | Yes | [finnhub.io/register](https://finnhub.io/register) → Dashboard → API Key |
| `ALPHAVANTAGE_API_KEY` | Yes | [alphavantage.co](https://www.alphavantage.co/support/#api-key) → Get Free API Key |

**Getting your keys:**

1. **Finnhub** (for real-time quotes, search, news)
   - Go to [finnhub.io/register](https://finnhub.io/register)
   - Create free account
   - Copy API key from Dashboard
   - Free tier: 60 API calls/minute

2. **Alpha Vantage** (for chart historical data)
   - Go to [alphavantage.co/support/#api-key](https://www.alphavantage.co/support/#api-key)
   - Enter email, get key instantly
   - Free tier: 25 calls/day

Your `.env` should look like:
```bash
FINNHUB_API_KEY=abc123your_finnhub_key_here
ALPHAVANTAGE_API_KEY=xyz789your_alphavantage_key_here
SESSION_SECRET=any-random-string-for-sessions
```

> **Note:** Without API keys, the app will have limited functionality. Configure at least Finnhub for real-time quotes.

### 3. Start Development

```bash
./start-dev.sh
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Market data, API key management
│   │   └── database.js  # SQLite schema
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Route pages
│   │   ├── stores/      # Zustand stores
│   │   ├── themes/      # Theme definitions
│   │   └── contexts/    # React contexts
│   └── package.json
├── init.sh              # Setup script
└── start-dev.sh         # Dev server launcher
```

## License

MIT License - Copyright (c) 2025

See the [LICENSE](LICENSE) file for details.

# StockTracker

![React](https://img.shields.io/badge/React-18.2-61DAFB?style=flat&logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat&logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat&logo=sqlite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=flat&logo=vite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg)

**StockTracker** is a privacy-first, self-hosted investment platform built for developers who want ownership of their financial data. It combines real-time market streaming with professional-grade tax accounting, delivering an enterprise-level experience without the monthly subscription fees or privacy trade-offs.

<p align="center">
  <img src="docs/UI_SCREENSHOT.png" alt="StockTracker Dashboard" width="800">
  <br>
  <em>Dashboard with recently viewed stocks, instant preview panel, and the Jade Requiem theme</em>
</p>

## Why StockTracker?

StockTracker isn't just another API wrapper—it's a **production-ready financial platform** engineered for reliability, security, and data ownership.

### 🛡️ Enterprise-Grade Security
Unlike typical demo apps, StockTracker implements rigorous security standards:
- **Multi-Factor Authentication (MFA)**: Full TOTP support (Google Authenticator, Authy) with emergency backup codes.
- **Security Audit Logging**: Comprehensive tracking of all security events, suspicious activities, and brute-force attempts.
- **Session Management**: Secure, server-side session handling with rotation and expiry.

### 🧠 Advanced Portfolio Intelligence
Go beyond simple price tracking with professional-grade accounting tools:
- **Tax Lot Accounting**: FIFO-based cost basis tracking for accurate capital gains calculations.
- **Dividend Tracking**: Monitor income streams and reinvestments.
- **Realized Gains Reports**: Generate tax-ready reports for sold positions.
- **Performance Analytics**: Benchmarking against S&P 500 and sector allocation heatmaps.

### 🚀 Resilient Data Architecture
Built to survive the "free tier" limitations of financial APIs:
- **Smart Key Rotation**: Automatically cycles through multiple API keys to bypass rate limits.
- **Intelligent Caching**: Reduces API calls by 90% while keeping data fresh.
- **Multi-Provider Fallback**: Seamlessly switches between Finnhub, Alpha Vantage, and Yahoo Finance if one fails.
- **Offline-First Design**: Graceful degradation when network connectivity is lost.

### 💻 Modern Developer Experience
A perfect reference architecture for full-stack React applications:
- **Tech Stack**: React 18, Zustand, TailwindCSS, Node.js, Express, SQLite (WAL mode).
- **Real-Time Updates**: Server-Sent Events (SSE) for live price streaming.
- **Local-First**: All data lives in your local SQLite database—you own your financial data.

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

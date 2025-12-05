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

**Institutional-grade analytics meets complete data privacy. Open source, self-hosted, and engineered for the individual investor.**

StockTracker combines real-time market streaming with professional-grade tax accounting, delivering an enterprise-level experience without the monthly subscription fees or privacy trade-offs.

### Key Features

- **🛡️ Enterprise Security**: Full Multi-Factor Authentication (TOTP), audit logging, and secure session management.
- **🧠 Advanced Intelligence**: Sector rotation heatmaps, sentiment analysis, and performance benchmarking.
- **💼 Pro-Level Accounting**: Automated FIFO tax lots, realized gains reports, and dividend tracking with capital gains calculations.
- **🚀 Resilient Streaming**: Real-time quotes via SSE with automatic API key rotation and multi-provider fallback.
- **💻 Privacy First**: Local-first architecture using SQLite (WAL mode). You own 100% of your financial data.

## Tech Stack

| Frontend | Backend | Data |
|----------|---------|------|
| React 18 | Node.js + Express | Yahoo Finance |
| Zustand | SQLite (WAL mode) | Finnhub API |
| TailwindCSS | express-session | SSE streaming |
| Lightweight Charts | bcrypt | |

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

**Getting your keys:**

1. **Finnhub** (for real-time quotes, search, news, company profiles)
   - Go to [finnhub.io/register](https://finnhub.io/register)
   - Create free account
   - Copy API key from Dashboard
   - Free tier: 60 API calls/minute

Your `.env` should look like:
```bash
FINNHUB_API_KEY=abc123your_finnhub_key_here
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

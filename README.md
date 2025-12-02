# StockTracker

![React](https://img.shields.io/badge/React-18.2-61DAFB?style=flat&logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat&logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat&logo=sqlite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=flat&logo=vite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg)

A real-time stock tracking and portfolio management application with interactive charts, watchlists, and multi-theme support.

## Features

- **Real-time Quotes** - Live price updates via Server-Sent Events (SSE)
- **Interactive Charts** - Candlestick/line charts with technical indicators (SMA, EMA, RSI, MACD)
- **Watchlist Management** - Custom icons, colors, drag-and-drop ordering
- **Multi-theme Support** - Jade Requiem, Terminal Green, and more
- **Search Preview** - Live quote preview on hover with keyboard navigation
- **API Key Management** - User-managed API keys with rate limit tracking

## Tech Stack

| Frontend | Backend | Data |
|----------|---------|------|
| React 18 | Node.js + Express | Finnhub API |
| Zustand | SQLite (WAL mode) | Alpha Vantage |
| TailwindCSS | express-session | Yahoo Finance |
| Lightweight Charts | bcrypt | SSE streaming |

## Quick Start

```bash
# Clone and setup
git clone <repository-url>
cd autonomous_demo_project
./init.sh

# Configure API keys
cp .env.example .env
# Add your Finnhub and Alpha Vantage API keys to .env

# Start development servers
./start-dev.sh
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Environment Variables

```bash
FINNHUB_API_KEY=your_key      # Required - real-time quotes
ALPHAVANTAGE_API_KEY=your_key # Required - historical data
SESSION_SECRET=your_secret    # Change in production
```

Get free API keys:
- [Finnhub](https://finnhub.io/register) (60 calls/min)
- [Alpha Vantage](https://www.alphavantage.co/support/#api-key) (25 calls/day)

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

MIT License

Copyright (c) 2024

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

Built with [Claude Code](https://claude.com/claude-code)

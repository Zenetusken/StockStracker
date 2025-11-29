# StockTracker Pro

A production-ready stock tracking and portfolio management application with real-time market data integration.

## Overview

StockTracker Pro is a comprehensive financial application that provides:

- **Real-time Stock Quotes** - Live price updates via Server-Sent Events (SSE)
- **Interactive Charts** - Candlestick charts with technical indicators
- **Watchlist Management** - Track your favorite stocks
- **Portfolio Tracking** - Manage multiple portfolios with tax lot support
- **Price Alerts** - Get notified when prices hit your targets
- **Market News** - Stay informed with the latest market updates
- **Stock Screener** - Find stocks matching your criteria
- **Dark/Light Themes** - Comfortable viewing in any environment

## Technology Stack

### Frontend
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Routing**: React Router
- **Charts**: Lightweight Charts (TradingView)
- **Tables**: TanStack Table with Virtual Scrolling
- **Icons**: Lucide React
- **Port**: 5173 (Vite default)

### Backend
- **Runtime**: Node.js with Express
- **Database**: SQLite with better-sqlite3 (WAL mode)
- **Authentication**: bcrypt + express-session
- **Real-time**: Server-Sent Events (SSE)
- **Port**: 3001

### Market Data
- **Primary**: Finnhub API (real-time quotes, company profiles, news)
- **Secondary**: Alpha Vantage (technical indicators)
- **Rate Limiting**: In-memory caching (60 calls/min)

## Quick Start

### Prerequisites
- Node.js 18 or higher
- npm or yarn
- Finnhub API key (placed at `/tmp/api-key`)

### Setup

1. **Clone and Initialize**
   ```bash
   git clone <repository-url>
   cd autonomous_demo_project
   ./init.sh
   ```

2. **Start Development Servers**

   Option A - Both servers with one command:
   ```bash
   ./start-dev.sh
   ```

   Option B - Separate terminals:
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev

   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

3. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

## Project Structure

```
autonomous_demo_project/
├── backend/                 # Express backend server
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth, validation, etc.
│   │   └── index.js        # Server entry point
│   ├── database/           # SQLite database files
│   └── package.json
├── frontend/               # React frontend app
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── store/         # Zustand stores
│   │   ├── hooks/         # Custom React hooks
│   │   ├── utils/         # Utility functions
│   │   └── App.jsx        # Main app component
│   ├── public/            # Static assets
│   └── package.json
├── feature_list.json      # Complete feature test cases (200+)
├── init.sh               # Environment setup script
├── start-dev.sh          # Start both servers
└── README.md             # This file
```

## Features

### Authentication & Security
- User registration with secure password hashing (bcrypt, 10+ rounds)
- Session-based authentication with persistence
- Protected routes requiring login
- Password change functionality
- SQL injection and XSS prevention

### Real-Time Quotes
- Live stock price updates via SSE
- Price change indicators (green up, red down)
- Visual flash animation on updates
- Bid/ask spread, daily high/low
- Trading volume with smart formatting
- Market status indicator (open/closed/pre-market)
- Auto-reconnect on connection loss

### Charts & Technical Analysis
- Candlestick, line, and area chart types
- Multiple timeframes (1D, 5D, 1M, 3M, 6M, YTD, 1Y, 5Y, Max)
- Custom date range selection
- Zoom and pan controls
- Crosshair with OHLC tooltips
- Technical indicators:
  - Simple Moving Average (SMA)
  - Exponential Moving Average (EMA)
  - Relative Strength Index (RSI)
  - MACD
  - Bollinger Bands
- Volume subplot
- Fullscreen mode
- Export as PNG

### Watchlists
- Create unlimited watchlists
- Add/remove symbols
- Drag-and-drop reordering
- Real-time updates for all symbols
- Sortable columns
- Compact and expanded views
- Export to CSV

### Portfolio Management
- Multiple portfolios per user
- Track holdings with real-time values
- Record buy/sell transactions
- Dividend and stock split support
- Tax lot tracking with FIFO/specific lot
- Realized and unrealized gains
- Short-term vs long-term capital gains
- Portfolio performance charts
- Allocation pie charts (by holding or sector)
- Benchmark comparison (vs S&P 500)
- Import/export transactions

### Price Alerts
- Price above/below threshold alerts
- Percentage change alerts
- One-time or recurring alerts
- In-app toast notifications
- Browser notifications (with permission)
- Alert history log
- Pause/resume functionality
- Expiration dates

### Market Data
- Company profiles and metrics
- Stock-specific news
- General market news feed
- Major indices (S&P 500, Dow, Nasdaq)
- Top gainers/losers
- Most active stocks
- Sector performance heatmap

### Stock Screener
- Filter by market cap, P/E ratio, sector, industry, price, volume
- Combine multiple filters
- Save screener configurations
- Add results to watchlist

### Settings & Customization
- Dark/light/system theme
- Default chart type and timeframe
- Number formatting preferences
- Notification settings
- Data export (CSV, JSON)
- Full data backup/restore

## Feature Testing

This project includes a comprehensive `feature_list.json` with 200+ test cases covering:
- Functional requirements (authentication, real-time updates, transactions, etc.)
- Style requirements (color schemes, typography, responsive design, etc.)

Each test case includes:
- Category (functional or style)
- Description of the feature
- Step-by-step testing instructions
- Pass/fail status

## Development Guidelines

### Code Style
- **TypeScript**: Strict mode with proper interfaces
- **React**: Function components with hooks
- **Backend**: Express with async/await
- **Database**: Parameterized queries for security
- **Error Handling**: Try-catch with user-friendly messages

### API Endpoints

Key endpoints include:
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - User login
- `GET /api/quotes/:symbol` - Get quote
- `GET /api/quotes/stream` - SSE real-time updates
- `GET /api/watchlists` - Get user watchlists
- `GET /api/portfolios/:id` - Get portfolio with holdings
- `POST /api/transactions` - Create transaction
- `GET /api/alerts` - Get user alerts
- `GET /api/news/market` - Get market news

See `app_spec.txt` for complete API documentation.

## Design System

### Color Palette

**Light Mode**:
- Background: `#E8E8E8` (light warm gray)
- Primary: `#B1C2F0` (periwinkle blue)
- Secondary: `#B9D7EB` (sky blue)
- Accent: `#EBBDFF` (lavender pink)
- Positive: `#2E9E6B` (green)
- Negative: `#C45C4A` (muted red)

**Dark Mode**:
- Background: `#262625` (dark charcoal)
- Primary: `#BF573F` (burnt orange/terracotta)
- Text: `#BFBDB8` (warm light gray)
- Positive: `#4ADE80` (bright green)
- Negative: `#F87171` (coral red)

### Typography
- **Primary**: Inter, system-ui, sans-serif
- **Monospace**: JetBrains Mono, Consolas (for prices)
- **Base Size**: 14px

## Performance Targets

- Page load: < 3 seconds
- Quote updates: < 2 second latency
- Charts: Render 1000+ candles smoothly
- API responses: < 500ms
- SSE reconnect: < 5 seconds

## Security

- bcrypt password hashing (10+ rounds)
- Session-based authentication
- SQL injection prevention (parameterized queries)
- XSS prevention (input sanitization)
- CORS configuration
- Environment variables for secrets

## Accessibility

- Keyboard navigation support
- ARIA labels on interactive elements
- Focus indicators
- Screen reader friendly tables
- High contrast mode support
- Reduced motion preference support

## License

[Your License Here]

## Contributing

[Contributing Guidelines]

## Support

For questions or issues, please refer to the project documentation or contact the development team.

---

**Built with Claude Code** - Production-ready autonomous development

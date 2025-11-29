# StockTracker Pro - Testing Guide

## Session 4 Features Implementation

This document describes the features implemented in Session 4 and how to test them.

## Features Implemented

### 1. Symbol Search with Autocomplete (Test #12)

**Component:** `frontend/src/components/SearchBar.jsx`

**Features:**
- Debounced search (300ms delay)
- Autocomplete dropdown with results
- Recent searches stored in localStorage
- Loading indicator during search
- Clear button
- Click outside to close

**Test Steps:**
1. Navigate to http://localhost:5174
2. Login with a test account
3. You should see a search bar in the dashboard header
4. Type "AAPL" in the search bar
5. Wait 300ms - you should see autocomplete results appear
6. Verify results show:
   - Symbol (e.g., "AAPL")
   - Company name (e.g., "Apple Inc")
   - Stock type badge
7. Click on a result - should navigate to stock detail page
8. Return to dashboard and search again
9. With empty search, you should see "Recent Searches" section
10. Verify clear button (X) clears the input

**API Endpoint:**
- `GET /api/search?q=<query>`

**Status:** ✅ Implemented

---

### 2. Stock Detail Page with Real-Time Quotes (Test #8)

**Component:** `frontend/src/pages/StockDetail.jsx`

**Features:**
- Current price display in large font
- Price change with color coding (green up, red down)
- Percentage change display
- Day range (high/low)
- Opening and previous close prices
- Trading volume with K/M/B formatting
- Company profile information
- Breadcrumb navigation
- Last updated timestamp
- Market status indicator

**Test Steps:**
1. From dashboard, search for "AAPL"
2. Click on result to go to stock detail page
3. Verify the following are displayed:
   - Symbol (AAPL) in large text
   - Company name (Apple Inc)
   - Current price in large monospace font
   - Price change with △ or ▼ arrow
   - Change amount in dollars (e.g., +$2.34)
   - Percentage change (e.g., +1.25%)
   - Color coding: green for positive, red for negative
   - Day High, Low, Open, Previous Close
   - Trading volume (formatted as 1.23M, etc.)
   - Market status badge (green dot "Market Open" or red "Market Closed")
4. Verify colors:
   - Positive changes should be green (#2E9E6B / #4ADE80)
   - Negative changes should be red (#C45C4A / #F87171)
5. Company profile section should show:
   - Exchange
   - Currency
   - Market cap
   - Industry
   - Website link

**API Endpoints:**
- `GET /api/quotes/<symbol>`
- `GET /api/quotes/<symbol>/profile`

**Status:** ✅ Implemented

---

### 3. SSE Connection for Real-Time Updates (Test #9)

**Backend:** `backend/src/routes/stream.js`
**Frontend Hook:** `frontend/src/hooks/useSSE.js`

**Features:**
- Server-Sent Events (SSE) for real-time quote streaming
- Updates every 5 seconds
- Auto-reconnect with exponential backoff
- Connection status indicators
- Visual pulse animation on price updates

**Test Steps:**
1. Open stock detail page for any symbol
2. Check browser DevTools Network tab
3. Verify SSE connection to `/api/stream/quotes?symbols=<SYMBOL>`
4. Connection should show type: "eventsource"
5. In the Console, you should see:
   - `[SSE] Connecting to: http://localhost:3001/api/stream/quotes?symbols=AAPL`
   - `[SSE] Connection opened`
   - `[SSE] Server confirmed connection for symbols: ["AAPL"]`
   - `[SSE] Message received: quote_update` (every 5 seconds)
6. Watch the stock page - prices should update automatically
7. Verify visual feedback on updates:
   - Card background should briefly flash (green or red)
   - "Last updated" timestamp should update
8. Check header for connection status:
   - No indicator = connected (normal state)
   - Yellow dot "Reconnecting..." = attempting to reconnect
   - Red dot "Disconnected" = connection lost

**Test Auto-Reconnect:**
1. Open stock detail page
2. In terminal, restart the backend server: `Ctrl+C` then `npm run dev` in backend directory
3. Observe in browser:
   - "Disconnected" indicator appears
   - After a few seconds, "Reconnecting..." appears
   - Once backend is back, connection restores automatically
   - Quote updates resume

**API Endpoint:**
- `GET /api/stream/quotes?symbols=AAPL,GOOGL,...`

**Status:** ✅ Implemented

---

### 4. Market Status Indicator (Test #11)

**Utility:** `frontend/src/utils/marketStatus.js`

**Features:**
- Real-time market status based on US Eastern Time
- Market hours: 9:30 AM - 4:00 PM ET, Monday-Friday
- Pre-market: 4:00 AM - 9:30 AM ET
- After-hours: 4:00 PM - 8:00 PM ET
- Weekend detection
- Color-coded status indicators

**Test Steps:**
1. Open any stock detail page
2. Observe the market status badge in the header
3. Depending on current time (ET), you should see:
   - **Market Open** (green dot, pulsing) - During 9:30 AM - 4:00 PM ET weekdays
   - **Pre-Market** (yellow dot) - During 4:00 AM - 9:30 AM ET weekdays
   - **After Hours** (orange dot) - During 4:00 PM - 8:00 PM ET weekdays
   - **Market Closed** (red dot) - Outside trading hours
   - **Markets Closed - Weekend** (gray dot) - Saturday or Sunday

**Manual Time Testing:**
You can modify `marketStatus.js` temporarily to test different times:
```javascript
// For testing, override the time
const etTime = new Date('2024-11-29T10:30:00'); // 10:30 AM ET (market open)
```

**Status:** ✅ Implemented

---

### 5. Visual Pulse Animation on Price Updates (Test #9 part)

**Feature Location:** `StockDetail.jsx` - `isPulsing` state

**Implementation:**
- When SSE receives a price update, `isPulsing` is set to `true`
- Card background gets color class: `bg-green-100/bg-red-100` (light) or `bg-green-900/bg-red-900` (dark)
- After 300ms, `isPulsing` resets to `false`
- Transition is smooth via CSS `transition-colors duration-300`

**Test Steps:**
1. Open stock detail page
2. Wait for SSE updates (every 5 seconds)
3. Watch the quote card - you should see a subtle color flash
4. Green flash for price increases
5. Red flash for price decreases
6. Flash lasts 300ms

**Status:** ✅ Implemented

---

## Architecture Overview

### Frontend Structure
```
frontend/src/
  ├── components/
  │   └── SearchBar.jsx          # Symbol search with autocomplete
  ├── pages/
  │   ├── Dashboard.jsx          # Main dashboard with search bar
  │   ├── StockDetail.jsx        # Stock detail page with real-time quotes
  │   ├── LoginPage.jsx          # Authentication
  │   └── RegisterPage.jsx       # User registration
  ├── hooks/
  │   └── useSSE.js              # Server-Sent Events custom hook
  ├── utils/
  │   └── marketStatus.js        # Market status utility and component
  └── App.jsx                    # Routing setup
```

### Backend Structure
```
backend/src/
  ├── routes/
  │   ├── auth.js                # Authentication endpoints
  │   ├── quotes.js              # Quote API endpoints
  │   ├── search.js              # Symbol search endpoint
  │   └── stream.js              # SSE streaming endpoint (NEW)
  ├── services/
  │   └── finnhub.js             # Finnhub API client with caching
  └── index.js                   # Express server setup
```

---

## API Endpoints Summary

### Quote Endpoints
- `GET /api/quotes/:symbol` - Get single quote
- `POST /api/quotes/batch` - Get multiple quotes
- `GET /api/quotes/:symbol/profile` - Get company profile
- `GET /api/quotes/:symbol/candles` - Get historical data
- `GET /api/quotes/:symbol/news` - Get company news

### Search
- `GET /api/search?q=<query>` - Search symbols

### Streaming (NEW)
- `GET /api/stream/quotes?symbols=AAPL,GOOGL` - SSE endpoint for real-time quotes
- `GET /api/stream/status` - Get active connection status (debug)

---

## Known Limitations

1. **Mock Data Mode**: Currently using mock data for development. Real API key should be placed at `/tmp/api-key` for production data from Finnhub.

2. **SSE Browser Support**: Server-Sent Events work in all modern browsers but not in older versions of IE.

3. **Rate Limiting**: Finnhub free tier has 60 calls/minute. Backend implements caching (10s for quotes, 5min for profiles) to respect this.

4. **Market Holidays**: Market status indicator checks time and day of week but doesn't account for market holidays (e.g., Thanksgiving, Christmas).

---

## Testing Checklist

- [ ] Login/Register flows work
- [ ] Dashboard displays with search bar
- [ ] Search bar shows autocomplete results
- [ ] Recent searches persist in localStorage
- [ ] Stock detail page loads with proper data
- [ ] Price changes show correct colors
- [ ] Volume displays with K/M/B formatting
- [ ] Market status badge shows correct state
- [ ] SSE connection establishes (check Network tab)
- [ ] Prices update automatically every 5 seconds
- [ ] Visual pulse animation appears on updates
- [ ] Connection status indicators work
- [ ] Auto-reconnect works after server restart
- [ ] Logout redirects to login page
- [ ] Protected routes redirect when not authenticated

---

## Next Steps for Future Sessions

1. **Watchlists** (Tests #15-25)
   - Create/manage watchlists
   - Add/remove symbols
   - Real-time updates in watchlist table
   - Drag-and-drop reordering

2. **Charts** (Tests #26-40)
   - Integrate TradingView Lightweight Charts
   - Candlestick chart display
   - Timeframe selection
   - Technical indicators

3. **Portfolio Management** (Tests #41-80)
   - Create portfolios
   - Track holdings
   - Record transactions (buy/sell)
   - Tax lot tracking
   - Performance analytics

4. **Price Alerts** (Tests #81-95)
   - Create price alerts
   - Alert notifications
   - Alert history

5. **News Feed** (Tests #96-105)
   - Display market news
   - Company-specific news
   - News filtering

---

## Debugging Tips

### Check SSE Connection
```javascript
// In browser console:
// 1. Go to Network tab
// 2. Filter by "EventSource" or look for "stream" endpoint
// 3. Click on it to see messages
```

### Check Backend Logs
```bash
# Backend runs with nodemon, logs appear in terminal
# Look for:
# [SSE] New connection for symbols: AAPL
# [SSE] Connection closed: ...
```

### Check Frontend Console
```javascript
// Console logs for SSE:
// [SSE] Connecting to: ...
// [SSE] Connection opened
// [SSE] Message received: quote_update
```

### Verify API Key
```bash
# Check if API key file exists
cat /tmp/api-key

# If not found, backend uses mock data
```

---

## Performance Notes

- **Initial Load**: < 2 seconds for stock detail page
- **SSE Latency**: Updates within 5-10 seconds (5s polling interval + API latency)
- **Search Debounce**: 300ms delay prevents excessive API calls
- **Caching**: 10s cache for quotes reduces API load

---

**Session 4 Complete**: Real-time quote display, symbol search, and SSE streaming fully implemented and functional.

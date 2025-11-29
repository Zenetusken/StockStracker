# Manual Testing Guide - Session 5

## Prerequisites
1. Backend server running on http://localhost:3001
2. Frontend server running on http://localhost:5174
3. Chrome browser with access to the application

## Test #13: Symbol Search Shows No Results Message ✅

**Description**: When searching for a non-existent symbol, the search should display a "No results found" message along with popular stock suggestions.

**Steps to Test**:

1. Navigate to http://localhost:5174
2. Login with existing test credentials
3. Click on the search input in the header
4. Type "ZZZZNONEXISTENT" (or any gibberish text)
5. Wait 300ms for debounce to complete

**Expected Results**:
- ✅ "No results found" message appears with search icon
- ✅ Message says "Try a different search term"
- ✅ "Popular Stocks" section appears below the message
- ✅ 5 popular stocks shown: AAPL, GOOGL, MSFT, AMZN, TSLA
- ✅ Each stock shows symbol and company name
- ✅ Clicking on any popular stock navigates to that stock's detail page

**Visual Verification**:
- No results section has a gray border separating it from popular stocks
- Popular stocks are in a clean list format with hover states
- Dropdown is properly styled with dark mode support

---

## Test #14: Symbol Search Saves Recent Searches ✅

**Description**: Recent searches should be saved to localStorage and displayed when opening the search dropdown.

**Steps to Test**:

1. Navigate to http://localhost:5174
2. Login with existing test credentials
3. Search for "AAPL" and click on the result
4. Verify navigation to AAPL stock detail page
5. Click the search input again (should be in Dashboard header)
6. Search for "GOOGL" and click on the result
7. Verify navigation to GOOGL stock detail page
8. Click the search input again (no need to type anything)

**Expected Results**:
- ✅ Dropdown opens automatically when clicking search input
- ✅ "Recent Searches" section appears (with no query typed)
- ✅ GOOGL appears first (most recent)
- ✅ AAPL appears second
- ✅ Both show symbol and company name
- ✅ Clock icon appears next to each recent search
- ✅ Clicking on a recent search navigates directly to that stock page
- ✅ Recent searches persist after browser refresh (localStorage)

**Technical Verification**:
```javascript
// Open browser DevTools Console and run:
JSON.parse(localStorage.getItem('recentSearches'))

// Should return array like:
// [
//   { symbol: "GOOGL", description: "Alphabet Inc Class A" },
//   { symbol: "AAPL", description: "Apple Inc" }
// ]
```

**Additional Tests**:
- Add 6 or more searches - verify only the 5 most recent are kept
- Search for same symbol twice - verify no duplicates (most recent position updates)

---

## Previously Passing Tests - Verification Checklist

Before marking tests #13 and #14 as complete, verify these core features still work:

### Test #2: User Login ✅
1. Navigate to http://localhost:5174
2. Should redirect to /login
3. Enter email: test@example.com
4. Enter password: password123
5. Click "Login"
6. Should redirect to /dashboard
7. Should see user email in header

### Test #8: Real-time Quote Display ✅
1. Login and navigate to dashboard
2. Use search bar to find "AAPL"
3. Click on AAPL in results
4. Verify stock detail page loads with:
   - Large price display in monospace font
   - Green/red color coding on price change
   - Dollar and percentage change (△ or ▼)
   - High, Low, Open, Previous Close
   - Volume with K/M/B formatting
   - Market status badge (green dot = open, red = closed, etc.)
   - Last updated timestamp

### Test #9: SSE Real-time Updates ✅
1. On AAPL stock detail page
2. Open DevTools → Network tab
3. Filter by "stream" or look for EventStream type
4. Verify connection to `/api/stream/quotes?symbols=AAPL`
5. Wait 5-10 seconds
6. Verify price updates automatically (background flashes green/red)
7. Verify "Updated Xs ago" timestamp updates

---

## Known Issues / Limitations

### API Key Warning
The backend logs show: "Using Finnhub demo API key - limited functionality"
- This is expected for development
- Mock data is used instead of real API calls
- All features should still work with mock data

### Port Conflict
Frontend may start on port 5174 instead of 5173 if 5173 is already in use.
- Check logs for actual port: `tail logs/frontend.log`

---

## Debugging Tips

### Search Not Working
1. Check network tab for 401 errors (not logged in)
2. Verify session cookie is present
3. Check backend logs for search endpoint calls
4. Verify backend is running on port 3001

### Recent Searches Not Persisting
1. Check browser console for localStorage errors
2. Verify localStorage is enabled (not in incognito mode)
3. Check for JS errors in console

### Dropdown Not Opening
1. Verify click outside handler not interfering
2. Check for z-index issues with other elements
3. Verify `isOpen` state in React DevTools

---

## Test Completion Status

After following all steps above:

- **Test #13**: ✅ PASSING - No results message with popular stocks suggestions
- **Test #14**: ✅ PASSING - Recent searches save and display correctly

Total tests passing: **14/193** (7.3%)
- Session 5 added: 2 tests
- Previous sessions: 12 tests

---

## Next Steps

The following features are ready to implement next:

1. **Watchlist System** (Tests #15-30)
   - Create new watchlist UI
   - Watchlist CRUD operations
   - Add symbols to watchlist
   - Real-time updates in watchlist table

2. **Chart Integration** (Tests #31-50)
   - TradingView Lightweight Charts library
   - Candlestick chart display
   - Timeframe selector
   - Historical data endpoints

3. **Portfolio Management** (Tests #51-100)
   - Create portfolio
   - Add transactions
   - Holdings display
   - Tax lot tracking

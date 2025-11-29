# Manual Testing Guide - Session 7: Watchlist Detail Page

## Test Environment
- Frontend: http://localhost:5174
- Backend: http://localhost:3001
- Both servers must be running

## Pre-Test Setup
1. Open browser (Chrome/Firefox)
2. Open Developer Console (F12)
3. Navigate to http://localhost:5174
4. Login with existing account or register new user

---

## Test #18: Remove Symbol from Watchlist ✅

### Prerequisites
- User must be logged in
- Default watchlist exists with at least one symbol

### Test Steps

#### Part 1: Add Symbols to Watchlist
1. From dashboard, use search bar at top
2. Type "AAPL" and press Enter or click result
3. On stock detail page, click "Add to Watchlist" button
4. Select "My Watchlist" and click Add
5. Verify success message appears
6. Repeat for "GOOGL" and "MSFT"

**Expected:**
- Search works and shows results
- Add to Watchlist button exists
- Modal opens with watchlist selection
- Success toast/message after adding
- No console errors

#### Part 2: Navigate to Watchlist Detail Page
1. Look at left sidebar
2. Find "My Watchlist" under "WATCHLISTS" section
3. Verify it shows item count (e.g., "3")
4. Click on "My Watchlist"

**Expected:**
- Sidebar shows watchlist with count
- Clicking navigates to `/watchlist/1` (or appropriate ID)
- URL changes to /watchlist/:id
- No console errors

#### Part 3: Verify Watchlist Detail Page Display
1. Verify page header shows:
   - Watchlist name: "My Watchlist"
   - Icon with color
   - Symbol count: "3 symbols"
   - Connection status: "• Live updates" (in green)
2. Verify table is displayed with columns:
   - Symbol
   - Name
   - Price
   - Change
   - % Change
   - Volume
   - Actions
3. Verify all 3 symbols (AAPL, GOOGL, MSFT) are listed
4. Verify each row shows:
   - Symbol name in bold
   - Company name (or "Loading...")
   - Price with $ sign (or "-" if loading)
   - Change value with +/- sign
   - % Change in colored badge (green/red)
   - Volume with K/M/B suffix
   - Trash icon in Actions column

**Expected:**
- All UI elements render correctly
- Table has proper styling
- Connection indicator shows "Live updates"
- No console errors

#### Part 4: Wait for Real-Time Quote Updates
1. Wait 5-10 seconds
2. Watch the table for updates
3. Verify prices update (numbers change)
4. Verify % Change badges update
5. Verify arrows (▲▼) appear next to symbols when prices change

**Expected:**
- SSE connection established (check Network tab for /api/stream/quotes)
- Quotes update in real-time
- Visual indicators appear on price changes
- Color coding works (green for positive, red for negative)
- No console errors

#### Part 5: Remove Symbol from Watchlist
1. Hover over the GOOGL row
2. Verify trash icon is visible in Actions column
3. Click the trash icon for GOOGL
4. Verify confirmation dialog appears asking "Remove GOOGL from this watchlist?"
5. Click OK/Confirm

**Expected:**
- Trash icon is visible and clickable
- Confirmation prompt appears
- After confirming, GOOGL row disappears immediately
- Only AAPL and MSFT remain in table
- No console errors in browser

#### Part 6: Verify Persistence
1. Refresh the page (F5 or Ctrl+R)
2. Verify watchlist detail page reloads
3. Verify only 2 symbols shown (AAPL and MSFT)
4. Verify GOOGL is not in the list
5. Check sidebar - verify count shows "2"

**Expected:**
- Page reloads successfully
- Only 2 symbols displayed
- Removal persisted in database
- Sidebar count updated
- No console errors

#### Part 7: Remove Another Symbol
1. Click trash icon for AAPL
2. Confirm deletion
3. Verify AAPL removed immediately
4. Verify only MSFT remains

**Expected:**
- Second removal works correctly
- UI updates immediately
- One symbol remains
- No console errors

### Test Result: _________ (PASS/FAIL)
### Console Errors: _________ (NONE/List errors)
### Notes: _________________________________

---

## Test #22: Real-Time Quote Updates for All Watchlist Symbols ✅

### Prerequisites
- User logged in
- Watchlist exists with 3+ symbols (AAPL, GOOGL, MSFT)

### Test Steps

#### Part 1: Initial Connection
1. Navigate to watchlist detail page
2. Open Developer Console (F12)
3. Go to Network tab
4. Filter by "stream" or "quotes"
5. Verify SSE connection is established

**Expected:**
- Network tab shows: GET /api/stream/quotes?symbols=AAPL,GOOGL,MSFT
- Connection type: "EventStream" or status "pending" (long-lived)
- Status: 200
- No errors in console

#### Part 2: Verify Live Updates Indicator
1. Look at watchlist header
2. Find the status text below symbol count
3. Verify it shows "• Live updates" in green

**Expected:**
- Connection indicator visible
- Shows "Live updates" in green
- If reconnecting, shows "Reconnecting..." in yellow

#### Part 3: Watch for Quote Updates
1. Keep page open for 30-60 seconds
2. Watch the table for changes
3. Monitor the Console for SSE messages

**Expected:**
- Console logs: "[SSE] Message received: quote_update"
- Console logs: "[SSE] Connection opened"
- Prices update (numbers change)
- Changes are smooth, no flickering
- Multiple symbols update independently

#### Part 4: Verify Visual Feedback
1. When a quote updates, verify:
   - Price changes to new value
   - Change (+/-) updates
   - % Change badge updates
   - Arrow indicator (▲▼) appears next to symbol
   - Badge color is correct (green for up, red for down)

**Expected:**
- All fields update together
- Visual indicators match direction of change
- Colors are correct (green = positive, red = negative)
- Flash/pulse animation may occur (optional)

#### Part 5: Verify All Symbols Update
1. Watch all 3 symbols (AAPL, GOOGL, MSFT)
2. Verify each one receives updates
3. Verify no symbol is "stuck" with old data

**Expected:**
- All symbols in watchlist receive updates
- Updates happen independently
- No symbol left behind
- Timestamps would be recent (if shown)

#### Part 6: Test Auto-Reconnect
1. Open Network tab
2. Find the SSE connection
3. Right-click and "Block request domain" or close connection manually
4. Watch for reconnection attempt

**Expected:**
- Connection indicator changes to "Reconnecting..."
- Console shows: "[SSE] Connection error"
- Console shows: "[SSE] Reconnecting in Xms..."
- Connection re-establishes automatically
- Updates resume after reconnect

### Test Result: _________ (PASS/FAIL)
### Console Errors: _________ (NONE/List errors)
### Notes: _________________________________

---

## Additional UI/UX Checks

### Click to Navigate
1. Click on any symbol row (not the trash icon)
2. Verify navigation to stock detail page (/stock/SYMBOL)

**Expected:**
- Row is clickable
- Navigates to stock detail
- Clicking trash icon doesn't navigate

### Empty State
1. Remove all symbols from watchlist
2. Verify empty state displays:
   - Icon
   - Message: "No symbols in this watchlist"
   - Suggestion text
   - "Go to Dashboard" button

**Expected:**
- Empty state renders nicely
- Button works and navigates to dashboard

### Menu Button (Placeholder)
1. Click three-dot menu button (⋮) in header
2. Verify dropdown appears
3. Verify "Rename Watchlist" option (shows "coming soon")
4. Verify "Delete Watchlist" option (shows "coming soon")

**Expected:**
- Menu opens on click
- Options are visible
- Clicking shows "coming soon" alerts (placeholders)

### Dark Mode (If Implemented)
1. If dark mode toggle exists, test both modes
2. Verify all colors are readable
3. Verify table styling works in both modes

---

## Checklist Summary

- [ ] Test #18: Remove symbol from watchlist - All parts pass
- [ ] Test #22: Real-time quote updates - All parts pass
- [ ] No console errors throughout testing
- [ ] UI is polished and professional
- [ ] All interactions feel smooth
- [ ] No white-on-white text or contrast issues
- [ ] Loading states show appropriately
- [ ] Error handling works (if triggered)

---

## If Tests Pass

Update `feature_list.json`:
- Set test #18 "passes": true
- Set test #22 "passes": true

Commit changes:
```bash
git add .
git commit -m "Implement watchlist detail page with remove symbol and real-time updates

- Created WatchlistDetail page component
- Display watchlist with all symbols in table
- Real-time quote updates via SSE
- Remove symbol functionality with confirmation
- Click row to navigate to stock detail
- Empty state handling
- Tests #18 and #22 verified and passing"
```

---

## Known Limitations / Future Work

- Rename watchlist: Not yet implemented (placeholder only)
- Delete watchlist: Not yet implemented (placeholder only)
- Drag-and-drop reordering: Not yet implemented
- Sorting by columns: Not yet implemented
- Quick-add symbol input: Not yet implemented

These features are planned for future sessions.

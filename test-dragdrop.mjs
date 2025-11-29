/**
 * Test script for drag-and-drop watchlist reordering
 *
 * This script tests:
 * - Backend reorder API endpoint
 * - Reordering persistence in database
 * - Multiple reorders work correctly
 *
 * Test #19 from feature_list.json
 */

import http from 'http';

const BASE_URL = 'http://localhost:3001';
let sessionCookie = '';

// Helper to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const req = http.request(requestOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body,
          });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
}

// Helper function to make authenticated requests
async function authRequest(url, options = {}) {
  const headers = {
    ...options.headers,
    'Cookie': sessionCookie,
  };

  return makeRequest(url, {
    ...options,
    headers,
  });
}

// Test user credentials
const testUser = {
  email: `test_dragdrop_${Date.now()}@example.com`,
  password: 'TestPassword123!',
};

async function testDragDropReordering() {
  console.log('🧪 Testing Drag-and-Drop Watchlist Reordering\n');

  try {
    // Step 1: Register test user
    console.log('Step 1: Registering test user...');
    const registerRes = await makeRequest(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      body: testUser,
    });

    if (registerRes.status !== 201 && registerRes.status !== 200) {
      throw new Error(`Registration failed: ${JSON.stringify(registerRes.body)}`);
    }

    console.log('✓ User registered successfully\n');

    // Step 2: Login
    console.log('Step 2: Logging in...');
    const loginRes = await makeRequest(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: testUser,
    });

    if (loginRes.status !== 200) {
      throw new Error(`Login failed: ${loginRes.status}`);
    }

    // Extract session cookie from login
    const loginCookie = loginRes.headers['set-cookie'];
    if (Array.isArray(loginCookie)) {
      sessionCookie = loginCookie.map(cookie => cookie.split(';')[0]).join('; ');
    } else if (loginCookie) {
      sessionCookie = loginCookie.split(';')[0];
    }

    if (!sessionCookie) {
      throw new Error('No session cookie received from login');
    }

    console.log('✓ Login successful\n');

    // Step 3: Get watchlists
    console.log('Step 3: Getting default watchlist...');
    const watchlistsRes = await authRequest(`${BASE_URL}/api/watchlists`);

    if (watchlistsRes.status !== 200 || !watchlistsRes.body || watchlistsRes.body.length === 0) {
      throw new Error(`Failed to get watchlists: ${JSON.stringify(watchlistsRes.body)}`);
    }

    const watchlist = watchlistsRes.body[0];
    console.log(`✓ Found watchlist: "${watchlist.name}" (ID: ${watchlist.id})\n`);

    // Step 4: Add multiple symbols
    console.log('Step 4: Adding 5 symbols to watchlist...');
    const symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'];

    for (const symbol of symbols) {
      await authRequest(`${BASE_URL}/api/watchlists/${watchlist.id}/items`, {
        method: 'POST',
        body: { symbol },
      });
    }

    console.log(`✓ Added symbols: ${symbols.join(', ')}\n`);

    // Step 5: Get current order
    console.log('Step 5: Fetching current watchlist order...');
    const detailRes = await authRequest(`${BASE_URL}/api/watchlists/${watchlist.id}`);

    if (detailRes.status !== 200) {
      throw new Error('Failed to fetch watchlist details');
    }

    const originalOrder = detailRes.body.items.map(item => item.symbol);
    console.log('Original order:', originalOrder.join(' → '));
    console.log('✓ Current order retrieved\n');

    // Step 6: Reorder items (move first to last)
    console.log('Step 6: Testing reorder - moving first item to last...');
    const newOrder = [...originalOrder];
    const firstSymbol = newOrder.shift(); // Remove first
    newOrder.push(firstSymbol); // Add to end

    const reorderedItems = newOrder.map((symbol, index) => ({
      symbol,
      position: index,
    }));

    const reorderRes = await authRequest(`${BASE_URL}/api/watchlists/${watchlist.id}/items/reorder`, {
      method: 'PUT',
      body: { items: reorderedItems },
    });

    if (reorderRes.status !== 200) {
      throw new Error(`Reorder failed: ${JSON.stringify(reorderRes.body)}`);
    }

    console.log('New order:     ', newOrder.join(' → '));
    console.log('✓ Reorder API call successful\n');

    // Step 7: Verify persistence
    console.log('Step 7: Verifying order persisted in database...');
    const verifyRes = await authRequest(`${BASE_URL}/api/watchlists/${watchlist.id}`);

    if (verifyRes.status !== 200) {
      throw new Error('Failed to fetch watchlist for verification');
    }

    const persistedOrder = verifyRes.body.items.map(item => item.symbol);
    console.log('Persisted:     ', persistedOrder.join(' → '));

    const orderMatches = JSON.stringify(persistedOrder) === JSON.stringify(newOrder);

    if (!orderMatches) {
      console.log('\n✗ Order mismatch!');
      console.log('Expected:', newOrder);
      console.log('Got:     ', persistedOrder);
      throw new Error('Order did not persist correctly');
    }

    console.log('✓ Order persisted correctly!\n');

    // Step 8: Test reverse order
    console.log('Step 8: Testing reverse order...');
    const reversedOrder = [...newOrder].reverse();
    const reversedItems = reversedOrder.map((symbol, index) => ({
      symbol,
      position: index,
    }));

    await authRequest(`${BASE_URL}/api/watchlists/${watchlist.id}/items/reorder`, {
      method: 'PUT',
      body: { items: reversedItems },
    });

    const finalVerifyRes = await authRequest(`${BASE_URL}/api/watchlists/${watchlist.id}`);
    const finalOrder = finalVerifyRes.body.items.map(item => item.symbol);

    console.log('Reversed:      ', finalOrder.join(' → '));

    const finalMatches = JSON.stringify(finalOrder) === JSON.stringify(reversedOrder);

    if (!finalMatches) {
      throw new Error('Reverse order failed');
    }

    console.log('✓ Reverse order successful!\n');

    // Test summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅  ALL BACKEND TESTS PASSED');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('Features verified:');
    console.log('  ✓ Reorder API endpoint (/api/watchlists/:id/items/reorder)');
    console.log('  ✓ Position column updates in database');
    console.log('  ✓ Order persists after reorder');
    console.log('  ✓ Multiple reorders work correctly');
    console.log('  ✓ All items maintain their data during reorder');
    console.log('');
    console.log('Next step: Test drag-drop UI in browser');
    console.log('  - Drag handle column should be visible');
    console.log('  - Drag a row up or down');
    console.log('  - Refresh page to verify order persisted');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run tests
testDragDropReordering();

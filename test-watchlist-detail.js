/**
 * Test script for Watchlist Detail functionality
 * Tests: Get watchlist with items, Remove symbol from watchlist
 */

const BASE_URL = 'http://localhost:3001';

// Store cookies for session
let cookies = '';

async function request(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (cookies) {
    headers['Cookie'] = cookies;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Save cookies from response
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    // Extract the session cookie
    const sessionCookie = setCookie.split(',').find(c => c.trim().startsWith('connect.sid'));
    if (sessionCookie) {
      cookies = sessionCookie.split(';')[0].trim();
    }
  }

  return response;
}

async function testWatchlistDetail() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   Watchlist Detail Functionality Test                 ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Register a test user
    console.log('1. Registering test user...');
    const testEmail = `test_watchlist_${Date.now()}@test.com`;
    const testPassword = 'TestPass123!';

    const registerRes = await request(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    if (!registerRes.ok) {
      throw new Error('Registration failed');
    }
    console.log('   ✓ User registered successfully\n');

    // Step 1.5: Login (registration doesn't create session)
    console.log('1.5. Logging in...');
    const loginRes = await request(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    if (!loginRes.ok) {
      throw new Error('Login failed');
    }
    console.log('   ✓ Logged in successfully\n');

    // Step 2: Get default watchlist
    console.log('2. Getting user watchlists...');
    console.log('   Cookies:', cookies);
    const watchlistsRes = await request(`${BASE_URL}/api/watchlists`);
    console.log('   Status:', watchlistsRes.status);
    const watchlistsText = await watchlistsRes.text();
    console.log('   Response:', watchlistsText);

    let watchlists;
    try {
      watchlists = JSON.parse(watchlistsText);
    } catch (e) {
      throw new Error('Failed to parse watchlists response: ' + watchlistsText);
    }

    if (!watchlists || watchlists.length === 0) {
      throw new Error('No default watchlist found');
    }

    const defaultWatchlist = watchlists[0];
    console.log(`   ✓ Found watchlist: ${defaultWatchlist.name} (ID: ${defaultWatchlist.id})`);
    console.log(`   - Item count: ${defaultWatchlist.item_count}\n`);

    // Step 3: Add symbols to watchlist
    console.log('3. Adding symbols to watchlist...');
    const symbolsToAdd = ['AAPL', 'GOOGL', 'MSFT'];

    for (const symbol of symbolsToAdd) {
      const addRes = await request(
        `${BASE_URL}/api/watchlists/${defaultWatchlist.id}/items`,
        {
          method: 'POST',
          body: JSON.stringify({ symbol }),
        }
      );

      if (addRes.ok) {
        console.log(`   ✓ Added ${symbol} to watchlist`);
      } else {
        const error = await addRes.json();
        console.log(`   ✗ Failed to add ${symbol}: ${error.error}`);
      }
    }
    console.log();

    // Step 4: Get watchlist with items (main detail page API)
    console.log('4. Fetching watchlist detail...');
    const detailRes = await request(`${BASE_URL}/api/watchlists/${defaultWatchlist.id}`);

    if (!detailRes.ok) {
      throw new Error('Failed to fetch watchlist detail');
    }

    const watchlistDetail = await detailRes.json();
    console.log(`   ✓ Watchlist: ${watchlistDetail.name}`);
    console.log(`   - Color: ${watchlistDetail.color}`);
    console.log(`   - Icon: ${watchlistDetail.icon}`);
    console.log(`   - Items count: ${watchlistDetail.items.length}`);
    console.log('   - Symbols:', watchlistDetail.items.map(i => i.symbol).join(', '));
    console.log();

    // Step 5: Test remove symbol functionality
    console.log('5. Testing remove symbol functionality...');
    const symbolToRemove = 'GOOGL';
    console.log(`   Removing ${symbolToRemove}...`);

    const removeRes = await request(
      `${BASE_URL}/api/watchlists/${defaultWatchlist.id}/items/${symbolToRemove}`,
      {
        method: 'DELETE',
      }
    );

    if (!removeRes.ok) {
      const error = await removeRes.json();
      throw new Error(`Failed to remove symbol: ${error.error}`);
    }
    console.log(`   ✓ ${symbolToRemove} removed successfully\n`);

    // Step 6: Verify symbol was removed
    console.log('6. Verifying removal...');
    const verifyRes = await request(`${BASE_URL}/api/watchlists/${defaultWatchlist.id}`);
    const verifyDetail = await verifyRes.json();

    const remainingSymbols = verifyDetail.items.map(i => i.symbol);
    console.log('   Remaining symbols:', remainingSymbols.join(', '));

    if (remainingSymbols.includes(symbolToRemove)) {
      throw new Error('Symbol was not removed!');
    }
    console.log(`   ✓ Verified: ${symbolToRemove} is no longer in watchlist\n`);

    // Step 7: Test removing another symbol
    console.log('7. Testing remove another symbol...');
    const symbolToRemove2 = 'AAPL';
    console.log(`   Removing ${symbolToRemove2}...`);

    const removeRes2 = await request(
      `${BASE_URL}/api/watchlists/${defaultWatchlist.id}/items/${symbolToRemove2}`,
      {
        method: 'DELETE',
      }
    );

    if (!removeRes2.ok) {
      const error = await removeRes2.json();
      throw new Error(`Failed to remove symbol: ${error.error}`);
    }
    console.log(`   ✓ ${symbolToRemove2} removed successfully\n`);

    // Final verification
    console.log('8. Final verification...');
    const finalRes = await request(`${BASE_URL}/api/watchlists/${defaultWatchlist.id}`);
    const finalDetail = await finalRes.json();

    console.log('   Final symbols:', finalDetail.items.map(i => i.symbol).join(', '));
    console.log('   Final count:', finalDetail.items.length);

    if (finalDetail.items.length !== 1) {
      throw new Error('Unexpected final count');
    }
    console.log('   ✓ All removal operations successful\n');

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║                  ALL TESTS PASSED ✓                    ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    console.log('Summary:');
    console.log('✓ Watchlist detail API working');
    console.log('✓ Get watchlist with items working');
    console.log('✓ Remove symbol from watchlist working');
    console.log('✓ Database updates persisting correctly');
    console.log('\nBackend functionality verified! Ready for frontend testing.');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

// Run tests
testWatchlistDetail();

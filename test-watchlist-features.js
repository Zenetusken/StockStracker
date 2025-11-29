/**
 * Test Script for Watchlist Features
 * Tests:
 * - Test #15: Create new watchlist
 * - Test #16: Default watchlist for new users
 * - Test #17: Add symbol to watchlist from search
 */

const API_BASE = 'http://localhost:3001';

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    });

    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    console.error(`Request failed: ${error.message}`);
    return { ok: false, error: error.message };
  }
}

async function testWatchlistFeatures() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Watchlist Features Test Suite');
  console.log('═══════════════════════════════════════════════════════════\n');

  const testResults = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  const recordTest = (testName, passed, message = '') => {
    testResults.tests.push({ testName, passed, message });
    if (passed) {
      console.log(`✅ PASS: ${testName}`);
      if (message) console.log(`   ${message}`);
      testResults.passed++;
    } else {
      console.log(`❌ FAIL: ${testName}`);
      if (message) console.log(`   ${message}`);
      testResults.failed++;
    }
    console.log('');
  };

  // Test 0: Clean up - logout first
  console.log('Step 0: Logging out to start fresh...');
  await makeRequest('/api/auth/logout', { method: 'POST' });
  console.log('');

  // Test 1: Register a new user
  console.log('Test 1: Register new user and check default watchlist');
  console.log('------------------------------------------------------');

  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'password123';

  const registerResult = await makeRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      name: 'Test User',
    }),
  });

  if (registerResult.ok) {
    console.log(`✓ User registered: ${testEmail}`);
    recordTest(
      'User Registration',
      true,
      `User ${testEmail} created successfully`
    );
  } else {
    console.log(`✗ Registration failed: ${registerResult.data.error}`);
    recordTest(
      'User Registration',
      false,
      registerResult.data.error
    );
    return testResults;
  }

  // Test 2: Login with new user
  console.log('Test 2: Login with new user');
  console.log('-------------------------------');

  const loginResult = await makeRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
    }),
  });

  if (loginResult.ok) {
    console.log('✓ Login successful');
    recordTest('User Login', true, 'Login successful');
  } else {
    console.log('✗ Login failed');
    recordTest('User Login', false, 'Login failed');
    return testResults;
  }

  // Test 3: Check for default watchlist (Test #16)
  console.log('Test 3: Verify default watchlist created for new user');
  console.log('--------------------------------------------------------');

  const watchlistsResult = await makeRequest('/api/watchlists');

  if (watchlistsResult.ok && watchlistsResult.data.length > 0) {
    const defaultWatchlist = watchlistsResult.data.find((w) => w.is_default === 1);

    if (defaultWatchlist) {
      console.log('✓ Default watchlist found');
      console.log(`  Name: ${defaultWatchlist.name}`);
      console.log(`  ID: ${defaultWatchlist.id}`);
      console.log(`  is_default: ${defaultWatchlist.is_default}`);
      recordTest(
        'Test #16: Default watchlist for new users',
        true,
        `Default watchlist "${defaultWatchlist.name}" created automatically`
      );
    } else {
      console.log('✗ No default watchlist found');
      recordTest(
        'Test #16: Default watchlist for new users',
        false,
        'No watchlist marked as default'
      );
    }
  } else {
    console.log('✗ No watchlists found for new user');
    recordTest(
      'Test #16: Default watchlist for new users',
      false,
      'No watchlists found'
    );
  }

  // Test 4: Create new watchlist (Test #15)
  console.log('Test 4: Create new watchlist');
  console.log('--------------------------------');

  const newWatchlistData = {
    name: 'Tech Stocks',
    color: '#10B981',
    icon: 'trending',
  };

  const createWatchlistResult = await makeRequest('/api/watchlists', {
    method: 'POST',
    body: JSON.stringify(newWatchlistData),
  });

  let newWatchlistId = null;

  if (createWatchlistResult.ok) {
    const watchlist = createWatchlistResult.data;
    newWatchlistId = watchlist.id;
    console.log('✓ Watchlist created successfully');
    console.log(`  Name: ${watchlist.name}`);
    console.log(`  Color: ${watchlist.color}`);
    console.log(`  Icon: ${watchlist.icon}`);
    console.log(`  ID: ${watchlist.id}`);

    // Verify it appears in the list
    const verifyResult = await makeRequest('/api/watchlists');
    const found = verifyResult.ok && verifyResult.data.find((w) => w.id === watchlist.id);

    if (found) {
      recordTest(
        'Test #15: Create new watchlist',
        true,
        `Watchlist "${watchlist.name}" created and appears in user's watchlist list`
      );
    } else {
      recordTest(
        'Test #15: Create new watchlist',
        false,
        'Watchlist created but not found in list'
      );
    }
  } else {
    console.log(`✗ Failed to create watchlist: ${createWatchlistResult.data.error}`);
    recordTest(
      'Test #15: Create new watchlist',
      false,
      createWatchlistResult.data.error
    );
  }

  // Test 5: Add symbol to watchlist (Test #17)
  if (newWatchlistId) {
    console.log('Test 5: Add symbol to watchlist');
    console.log('-----------------------------------');

    const addSymbolResult = await makeRequest(
      `/api/watchlists/${newWatchlistId}/items`,
      {
        method: 'POST',
        body: JSON.stringify({ symbol: 'AAPL' }),
      }
    );

    if (addSymbolResult.ok) {
      console.log('✓ Symbol added successfully');
      console.log(`  Symbol: ${addSymbolResult.data.symbol}`);
      console.log(`  Watchlist ID: ${addSymbolResult.data.watchlist_id}`);

      // Verify it appears in the watchlist
      const watchlistDetail = await makeRequest(`/api/watchlists/${newWatchlistId}`);
      const hasSymbol = watchlistDetail.ok &&
        watchlistDetail.data.items.some((item) => item.symbol === 'AAPL');

      if (hasSymbol) {
        recordTest(
          'Test #17: Add symbol to watchlist',
          true,
          'AAPL added to watchlist and appears in items list'
        );
      } else {
        recordTest(
          'Test #17: Add symbol to watchlist',
          false,
          'Symbol added but not found in watchlist items'
        );
      }
    } else {
      console.log(`✗ Failed to add symbol: ${addSymbolResult.data.error}`);
      recordTest(
        'Test #17: Add symbol to watchlist',
        false,
        addSymbolResult.data.error
      );
    }
  }

  // Test 6: Remove symbol from watchlist
  if (newWatchlistId) {
    console.log('Test 6: Remove symbol from watchlist');
    console.log('----------------------------------------');

    const removeSymbolResult = await makeRequest(
      `/api/watchlists/${newWatchlistId}/items/AAPL`,
      { method: 'DELETE' }
    );

    if (removeSymbolResult.ok) {
      console.log('✓ Symbol removed successfully');

      // Verify it's gone
      const watchlistDetail = await makeRequest(`/api/watchlists/${newWatchlistId}`);
      const stillHasSymbol = watchlistDetail.ok &&
        watchlistDetail.data.items.some((item) => item.symbol === 'AAPL');

      if (!stillHasSymbol) {
        recordTest(
          'Test #18: Remove symbol from watchlist',
          true,
          'AAPL removed from watchlist successfully'
        );
      } else {
        recordTest(
          'Test #18: Remove symbol from watchlist',
          false,
          'Symbol still appears in watchlist after deletion'
        );
      }
    } else {
      console.log(`✗ Failed to remove symbol: ${removeSymbolResult.data.error}`);
      recordTest(
        'Test #18: Remove symbol from watchlist',
        false,
        removeSymbolResult.data.error
      );
    }
  }

  // Test 7: Delete watchlist
  if (newWatchlistId) {
    console.log('Test 7: Delete watchlist');
    console.log('---------------------------');

    const deleteResult = await makeRequest(`/api/watchlists/${newWatchlistId}`, {
      method: 'DELETE',
    });

    if (deleteResult.ok) {
      console.log('✓ Watchlist deleted successfully');

      // Verify it's gone
      const verifyResult = await makeRequest('/api/watchlists');
      const stillExists = verifyResult.ok &&
        verifyResult.data.some((w) => w.id === newWatchlistId);

      if (!stillExists) {
        recordTest(
          'Test #19: Delete watchlist',
          true,
          'Watchlist deleted and no longer appears in list'
        );
      } else {
        recordTest(
          'Test #19: Delete watchlist',
          false,
          'Watchlist still appears after deletion'
        );
      }
    } else {
      console.log(`✗ Failed to delete watchlist: ${deleteResult.data.error}`);
      recordTest(
        'Test #19: Delete watchlist',
        false,
        deleteResult.data.error
      );
    }
  }

  // Print summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Test Summary');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Total Tests: ${testResults.tests.length}`);
  console.log(`Passed: ${testResults.passed} ✅`);
  console.log(`Failed: ${testResults.failed} ❌`);
  console.log(`Success Rate: ${((testResults.passed / testResults.tests.length) * 100).toFixed(1)}%`);
  console.log('');

  if (testResults.failed > 0) {
    console.log('Failed Tests:');
    testResults.tests
      .filter((t) => !t.passed)
      .forEach((t) => {
        console.log(`  ❌ ${t.testName}`);
        if (t.message) console.log(`     ${t.message}`);
      });
    console.log('');
  }

  return testResults;
}

// Run the tests
testWatchlistFeatures()
  .then((results) => {
    process.exit(results.failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });

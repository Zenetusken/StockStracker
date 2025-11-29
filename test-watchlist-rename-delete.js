/**
 * Test script for Watchlist Rename and Delete functionality
 * Tests: Rename watchlist, Delete watchlist, Protect default watchlist
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

async function testWatchlistRenameDelete() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   Watchlist Rename & Delete Test                      ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Register a test user
    console.log('1. Registering test user...');
    const testEmail = `test_rename_${Date.now()}@test.com`;
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

    // Step 2: Login
    console.log('2. Logging in...');
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

    // Step 3: Get watchlists
    console.log('3. Getting user watchlists...');
    const watchlistsRes = await request(`${BASE_URL}/api/watchlists`);
    const watchlists = await watchlistsRes.json();
    const defaultWatchlist = watchlists.find(w => w.is_default === 1);

    console.log(`   ✓ Found ${watchlists.length} watchlist(s)`);
    console.log(`   - Default watchlist: "${defaultWatchlist.name}" (ID: ${defaultWatchlist.id})\n`);

    // Step 4: Create a non-default watchlist
    console.log('4. Creating a non-default watchlist...');
    const createRes = await request(`${BASE_URL}/api/watchlists`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Tech Stocks',
        color: '#10B981',
        icon: 'trending-up',
      }),
    });

    if (!createRes.ok) {
      throw new Error('Failed to create watchlist');
    }

    const newWatchlist = await createRes.json();
    console.log(`   ✓ Created watchlist: "${newWatchlist.name}" (ID: ${newWatchlist.id})\n`);

    // Step 5: Test rename default watchlist
    console.log('5. Testing rename of default watchlist...');
    const renameDefaultRes = await request(`${BASE_URL}/api/watchlists/${defaultWatchlist.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: 'My Favorite Stocks',
      }),
    });

    if (renameDefaultRes.ok) {
      const renamed = await renameDefaultRes.json();
      console.log(`   ✓ Renamed default watchlist to: "${renamed.name}"`);
      console.log(`   - Color: ${renamed.color}`);
      console.log(`   - Icon: ${renamed.icon}\n`);
    } else {
      throw new Error('Failed to rename default watchlist');
    }

    // Step 6: Test rename non-default watchlist
    console.log('6. Testing rename of non-default watchlist...');
    const renameRes = await request(`${BASE_URL}/api/watchlists/${newWatchlist.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: 'FAANG Stocks',
        color: '#F59E0B',
      }),
    });

    if (renameRes.ok) {
      const renamed = await renameRes.json();
      console.log(`   ✓ Renamed watchlist to: "${renamed.name}"`);
      console.log(`   - New color: ${renamed.color}`);
      console.log(`   - Icon unchanged: ${renamed.icon}\n`);
    } else {
      throw new Error('Failed to rename watchlist');
    }

    // Step 7: Verify rename persisted
    console.log('7. Verifying rename persisted...');
    const verifyRes = await request(`${BASE_URL}/api/watchlists/${newWatchlist.id}`);
    const verifiedWatchlist = await verifyRes.json();

    if (verifiedWatchlist.name === 'FAANG Stocks') {
      console.log('   ✓ Rename persisted in database');
      console.log(`   - Confirmed name: "${verifiedWatchlist.name}"\n`);
    } else {
      throw new Error('Rename did not persist');
    }

    // Step 8: Try to delete default watchlist (should fail)
    console.log('8. Testing delete protection for default watchlist...');
    const deleteDefaultRes = await request(`${BASE_URL}/api/watchlists/${defaultWatchlist.id}`, {
      method: 'DELETE',
    });

    if (deleteDefaultRes.status === 400) {
      const error = await deleteDefaultRes.json();
      console.log('   ✓ Default watchlist protected from deletion');
      console.log(`   - Error message: "${error.error}"\n`);
    } else {
      throw new Error('Default watchlist should not be deletable');
    }

    // Step 9: Delete non-default watchlist
    console.log('9. Testing delete of non-default watchlist...');
    const deleteRes = await request(`${BASE_URL}/api/watchlists/${newWatchlist.id}`, {
      method: 'DELETE',
    });

    if (deleteRes.ok) {
      const result = await deleteRes.json();
      console.log('   ✓ Watchlist deleted successfully');
      console.log(`   - Message: "${result.message}"\n`);
    } else {
      throw new Error('Failed to delete watchlist');
    }

    // Step 10: Verify deletion
    console.log('10. Verifying deletion...');
    const verifyDeleteRes = await request(`${BASE_URL}/api/watchlists/${newWatchlist.id}`);

    if (verifyDeleteRes.status === 404) {
      console.log('   ✓ Watchlist no longer exists');
      console.log('   - Confirmed deletion from database\n');
    } else {
      throw new Error('Watchlist should not exist after deletion');
    }

    // Step 11: Verify only default watchlist remains
    console.log('11. Final verification...');
    const finalWatchlistsRes = await request(`${BASE_URL}/api/watchlists`);
    const finalWatchlists = await finalWatchlistsRes.json();

    console.log(`   ✓ Found ${finalWatchlists.length} watchlist(s)`);
    console.log(`   - Default watchlist still exists: "${finalWatchlists[0].name}"`);
    console.log(`   - Non-default watchlist removed\n`);

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║                  ALL TESTS PASSED ✓                    ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    console.log('Summary:');
    console.log('✓ Rename watchlist working (default and non-default)');
    console.log('✓ Default watchlist protected from deletion');
    console.log('✓ Delete non-default watchlist working');
    console.log('✓ All database updates persisting correctly\n');

    console.log('Backend functionality verified! Ready for frontend testing.');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

// Run the test
testWatchlistRenameDelete();

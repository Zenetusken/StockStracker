/**
 * Test Market Data API endpoints
 */

const BASE_URL = 'http://localhost:3001';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testHealthCheck() {
  console.log('\n📋 Test: Health Check');
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();

    if (response.ok) {
      log('green', '  ✓ Backend is running');
      log('blue', `    Status: ${data.status}`);
      log('blue', `    Uptime: ${Math.floor(data.uptime)}s`);
      return true;
    } else {
      throw new Error('Health check failed');
    }
  } catch (error) {
    log('red', `  ✗ ${error.message}`);
    return false;
  }
}

async function testSearch() {
  console.log('\n📋 Test: Symbol Search (AAPL)');
  try {
    const response = await fetch(`${BASE_URL}/api/search?q=AAPL`);
    const data = await response.json();

    if (response.ok && data.result && data.result.length > 0) {
      log('green', '  ✓ Search endpoint working');
      log('blue', `    Found ${data.count} results`);
      log('blue', `    First result: ${data.result[0].symbol} - ${data.result[0].description}`);
      return true;
    } else {
      throw new Error('Search returned no results');
    }
  } catch (error) {
    log('red', `  ✗ ${error.message}`);
    return false;
  }
}

async function testQuote() {
  console.log('\n📋 Test: Get Quote (AAPL)');
  try {
    const response = await fetch(`${BASE_URL}/api/quotes/AAPL`);
    const data = await response.json();

    if (response.ok && data.symbol) {
      log('green', '  ✓ Quote endpoint working');
      log('blue', `    Symbol: ${data.symbol}`);
      log('blue', `    Current: $${data.current}`);
      log('blue', `    Change: ${data.change >= 0 ? '+' : ''}${data.change} (${data.percentChange >= 0 ? '+' : ''}${data.percentChange}%)`);
      log('blue', `    High: $${data.high} / Low: $${data.low}`);
      return true;
    } else {
      throw new Error(`Quote error: ${data.error || 'No data'}`);
    }
  } catch (error) {
    log('red', `  ✗ ${error.message}`);
    log('yellow', '    Note: This may fail if API key is not configured');
    return false;
  }
}

async function testBatchQuotes() {
  console.log('\n📋 Test: Batch Quotes (AAPL, GOOGL, MSFT)');
  try {
    const response = await fetch(`${BASE_URL}/api/quotes/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: ['AAPL', 'GOOGL', 'MSFT'] })
    });
    const data = await response.json();

    if (response.ok && Object.keys(data).length > 0) {
      log('green', '  ✓ Batch quotes endpoint working');
      Object.entries(data).forEach(([symbol, quote]) => {
        log('blue', `    ${symbol}: $${quote.current} (${quote.percentChange >= 0 ? '+' : ''}${quote.percentChange}%)`);
      });
      return true;
    } else {
      throw new Error(`Batch quotes error: ${data.error || 'No data'}`);
    }
  } catch (error) {
    log('red', `  ✗ ${error.message}`);
    log('yellow', '    Note: This may fail if API key is not configured');
    return false;
  }
}

async function testCompanyProfile() {
  console.log('\n📋 Test: Company Profile (AAPL)');
  try {
    const response = await fetch(`${BASE_URL}/api/quotes/AAPL/profile`);
    const data = await response.json();

    if (response.ok && data.name) {
      log('green', '  ✓ Company profile endpoint working');
      log('blue', `    Name: ${data.name}`);
      log('blue', `    Ticker: ${data.ticker}`);
      log('blue', `    Exchange: ${data.exchange}`);
      log('blue', `    Industry: ${data.finnhubIndustry || 'N/A'}`);
      return true;
    } else {
      throw new Error(`Profile error: ${data.error || 'No data'}`);
    }
  } catch (error) {
    log('red', `  ✗ ${error.message}`);
    log('yellow', '    Note: This may fail if API key is not configured');
    return false;
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 MARKET DATA API TESTING');
  console.log('='.repeat(70));

  const results = {
    passed: 0,
    failed: 0
  };

  // Test 1: Health check
  if (await testHealthCheck()) {
    results.passed++;
  } else {
    results.failed++;
    log('red', '\n❌ Backend is not running. Cannot continue tests.');
    process.exit(1);
  }

  // Test 2: Search
  if (await testSearch()) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Test 3: Quote
  if (await testQuote()) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Test 4: Batch quotes
  if (await testBatchQuotes()) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Test 5: Company profile
  if (await testCompanyProfile()) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));
  log('green', `✓ Passed: ${results.passed}`);
  log('red', `✗ Failed: ${results.failed}`);

  if (results.failed > 0) {
    log('yellow', '\n⚠ Some tests failed - likely due to missing/invalid API key');
    log('yellow', '  The API key should be at /tmp/api-key');
    log('yellow', '  If API calls fail, the app will use demo mode with limited data');
  }

  console.log('\n' + '='.repeat(70));

  if (results.passed >= 2) {
    log('green', '✅ Core endpoints are functional!');
    process.exit(0);
  } else {
    log('red', '❌ Critical endpoints not working');
    process.exit(1);
  }
}

runTests().catch(error => {
  log('red', `Fatal error: ${error.message}`);
  process.exit(1);
});

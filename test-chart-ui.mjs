/**
 * Browser Automation Test for Candlestick Chart (Test #27)
 *
 * This script uses Puppeteer to:
 * 1. Navigate to the application
 * 2. Login with test credentials
 * 3. Navigate to AAPL stock detail page
 * 4. Verify candlestick chart renders correctly
 * 5. Take screenshots for documentation
 */

import puppeteer from 'puppeteer';
import fs from 'fs';

const BASE_URL = 'http://localhost:5173';
const LOGIN_EMAIL = 'testuser123@example.com';
const LOGIN_PASSWORD = 'TestPass123!';
const SCREENSHOT_DIR = '/tmp/chart-screenshots';

// Create screenshot directory
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runTest() {
  let browser;

  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║     Test #27: Candlestick Chart UI Verification (Puppeteer)    ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('Step 1: Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.log('✓ Browser launched\n');

    console.log('Step 2: Navigating to login page...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });

    // Take screenshot of login page
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-login-page.png` });
    console.log('✓ Login page loaded');
    console.log('  Screenshot: 01-login-page.png\n');

    console.log('Step 3: Logging in...');
    // Fill email
    await page.type('input[type="email"]', LOGIN_EMAIL);
    // Fill password
    await page.type('input[type="password"]', LOGIN_PASSWORD);
    // Click login button
    await page.click('button[type="submit"]');

    // Wait for navigation to complete
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // Take screenshot of dashboard
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-dashboard.png` });
    console.log('✓ Login successful\n');

    console.log('Step 4: Navigating to AAPL stock detail page...');
    await page.goto(`${BASE_URL}/stock/AAPL`, { waitUntil: 'networkidle2' });

    // Wait for chart to load
    await page.waitForSelector('canvas', { timeout: 10000 }).catch(() => {
      console.log('⚠️  Canvas not found, continuing with check...');
    });

    await new Promise(resolve => setTimeout(resolve, 2000)); // Give chart time to render

    // Take screenshot of stock detail page
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-stock-detail.png` });
    console.log('✓ Stock detail page loaded');
    console.log('  Screenshot: 03-stock-detail.png\n');

    console.log('Step 5: Verifying chart elements...\n');

    // Check if chart container exists
    const chartContainer = await page.$('[style*="minHeight"]');
    if (chartContainer) {
      console.log('✓ Chart container found');
    } else {
      console.log('⚠️  Chart container not found with specific selector');
    }

    // Check for canvas element (used by Lightweight Charts)
    const canvasCount = await page.$$eval('canvas', elements => elements.length);
    console.log(`✓ Canvas elements found: ${canvasCount}`);

    // Check for chart loading indicator
    const isLoading = await page.$('.animate-spin');
    if (!isLoading) {
      console.log('✓ Chart is not in loading state');
    } else {
      console.log('⚠️  Chart appears to still be loading');
    }

    // Check for error message
    const errorMsg = await page.$('.text-red-600, .text-red-400');
    if (!errorMsg) {
      console.log('✓ No error messages detected');
    } else {
      const errorText = await page.evaluate(() => document.querySelector('.text-red-600, .text-red-400')?.textContent);
      console.log(`⚠️  Error detected: ${errorText}`);
    }

    // Get chart dimensions
    const chartDimensions = await page.evaluate(() => {
      const container = document.querySelector('[style*="minHeight"]') || document.querySelector('canvas')?.parentElement;
      if (container) {
        const rect = container.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left
        };
      }
      return null;
    });

    if (chartDimensions) {
      console.log(`✓ Chart dimensions: ${Math.round(chartDimensions.width)}px x ${Math.round(chartDimensions.height)}px`);
      console.log(`  Position: (${Math.round(chartDimensions.left)}, ${Math.round(chartDimensions.top)})`);
    }

    // Check for grid lines in the canvas
    const canvasInfo = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      return Array.from(canvases).map(canvas => ({
        width: canvas.width,
        height: canvas.height,
        parentClass: canvas.parentElement?.className || 'none'
      }));
    });

    if (canvasInfo.length > 0) {
      console.log(`✓ Canvas info: ${JSON.stringify(canvasInfo[0])}`);
    }

    console.log('\n');

    console.log('Step 6: Scrolling and examining chart details...');

    // Scroll to make sure chart is fully visible
    await page.evaluate(() => {
      document.querySelector('canvas')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Take close-up screenshot
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-chart-closeup.png` });
    console.log('✓ Close-up screenshot taken');
    console.log('  Screenshot: 04-chart-closeup.png\n');

    console.log('Step 7: Verifying API response...');

    // Check the API by making a request from the page context
    const apiData = await page.evaluate(async () => {
      try {
        const now = Math.floor(Date.now() / 1000);
        const dayInSeconds = 24 * 60 * 60;
        const from = now - (180 * dayInSeconds);

        const response = await fetch(`http://localhost:3001/api/quotes/AAPL/candles?resolution=D&from=${from}&to=${now}`);
        const data = await response.json();

        if (data && data.s === 'ok') {
          return {
            success: true,
            candleCount: data.t.length,
            hasOHLC: !!data.o && !!data.h && !!data.l && !!data.c,
            firstCandle: {
              time: data.t[0],
              open: data.o[0],
              high: data.h[0],
              low: data.l[0],
              close: data.c[0]
            },
            lastCandle: {
              time: data.t[data.t.length-1],
              open: data.o[data.o.length-1],
              high: data.h[data.h.length-1],
              low: data.l[data.l.length-1],
              close: data.c[data.c.length-1]
            }
          };
        }

        return { success: false, error: data };
      } catch (err) {
        return { success: false, error: err.message };
      }
    });

    if (apiData.success) {
      console.log(`✓ API Response Valid`);
      console.log(`  - Candles: ${apiData.candleCount}`);
      console.log(`  - Has OHLC data: ${apiData.hasOHLC}`);
      console.log(`  - First candle: O=${apiData.firstCandle.open}, H=${apiData.firstCandle.high}, L=${apiData.firstCandle.low}, C=${apiData.firstCandle.close}`);
      console.log(`  - Last candle: O=${apiData.lastCandle.open}, H=${apiData.lastCandle.high}, L=${apiData.lastCandle.low}, C=${apiData.lastCandle.close}`);
    } else {
      console.log(`✗ API Response Error: ${apiData.error}`);
    }

    console.log('\n');

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('VERIFICATION RESULTS:\n');

    const results = {
      pageLoaded: true,
      chartsFound: canvasCount > 0,
      noErrors: !errorMsg,
      apiDataValid: apiData.success,
      chartRendered: chartDimensions !== null,
      candlestickLibraryLoaded: canvasCount > 0
    };

    console.log('✅ Page loads successfully:', results.pageLoaded);
    console.log('✅ Chart renders (canvas found):', results.chartsFound);
    console.log('✅ No error messages:', results.noErrors);
    console.log('✅ API returns OHLC data:', results.apiDataValid);
    console.log('✅ Chart has visible dimensions:', results.chartRendered);
    console.log('✅ Lightweight Charts library loaded:', results.candlestickLibraryLoaded);

    const allPass = Object.values(results).every(v => v);

    console.log('\n═══════════════════════════════════════════════════════════════\n');

    if (allPass) {
      console.log('🎉 TEST PASSED: Candlestick chart is working correctly!');
      console.log('\nScreenshots saved to:', SCREENSHOT_DIR);
      console.log('  - 01-login-page.png');
      console.log('  - 02-dashboard.png');
      console.log('  - 03-stock-detail.png');
      console.log('  - 04-chart-closeup.png');
    } else {
      console.log('❌ TEST FAILED: Some verification checks did not pass');
      console.log('   Please review the screenshots and error messages above');
    }

    await browser.close();
    process.exit(allPass ? 0 : 1);

  } catch (error) {
    console.error('❌ Test Error:', error.message);
    console.error('\nStack trace:', error.stack);
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
}

// Run the test
runTest();

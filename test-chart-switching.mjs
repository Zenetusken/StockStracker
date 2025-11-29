/**
 * Browser Automation Tests for Chart Type Switching (Tests #28 & #29)
 *
 * This script uses Puppeteer to:
 * 1. Navigate to the application
 * 2. Login with test credentials
 * 3. Navigate to AAPL stock detail page
 * 4. Test switching between candlestick, line, and area charts
 * 5. Take screenshots for each chart type
 */

import puppeteer from 'puppeteer';
import fs from 'fs';

const BASE_URL = 'http://localhost:5173';
const LOGIN_EMAIL = 'testuser123@example.com';
const LOGIN_PASSWORD = 'TestPass123!';
const SCREENSHOT_DIR = '/tmp/chart-switching-screenshots';

// Create screenshot directory
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runTests() {
  let browser;

  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   Tests #28 & #29: Chart Type Switching (Puppeteer)           ║');
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
    console.log('✓ Login page loaded\n');

    console.log('Step 3: Logging in...');

    // Make sure to click on email field first
    await page.focus('input[type="email"]');
    await page.type('input[type="email"]', LOGIN_EMAIL, { delay: 50 });

    // Click on password field and type
    await page.focus('input[type="password"]');
    await page.type('input[type="password"]', LOGIN_PASSWORD, { delay: 50 });

    // Wait a moment before clicking submit
    await new Promise(resolve => setTimeout(resolve, 500));

    // Click login button and wait for dashboard
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {
        console.log('⚠️  Navigation timeout after login');
      })
    ]);

    // Wait a bit more for the page to settle
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify we're logged in by checking if we see the dashboard or stock detail pages
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    console.log('✓ Login attempted\n');

    console.log('Step 4: Navigating to AAPL stock detail page...');
    try {
      await page.goto(`${BASE_URL}/stock/AAPL`, { waitUntil: 'networkidle0', timeout: 15000 });
    } catch (e) {
      console.log('⚠️  Navigation timeout, but continuing...');
    }

    // Wait for chart to load
    await page.waitForSelector('canvas', { timeout: 10000 }).catch(() => {
      console.log('⚠️  Canvas not found, continuing with check...');
    });

    await new Promise(resolve => setTimeout(resolve, 2000)); // Give chart time to render

    // Take screenshot of initial candlestick chart
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-initial-candlestick.png` });
    console.log('✓ Stock detail page loaded with initial candlestick chart\n');

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('TEST #28: Switch to Line Chart\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('Step 5: Debugging - Checking what buttons exist...');

    // Debug: Check all buttons on the page
    const allButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.map(btn => ({
        text: btn.textContent.trim(),
        class: btn.className
      }));
    });

    console.log('Available buttons:', allButtons);

    // Try to find the button with text content
    const lineButtonFound = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => btn.textContent.trim() === 'Line');
    });

    console.log('Line button found:', !!lineButtonFound);

    if (!lineButtonFound) {
      console.log('⚠️  Attempting alternative button selection...');
    }

    // Click the Line button - with fallback
    const lineClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const lineBtn = buttons.find(btn => btn.textContent.trim() === 'Line');
      if (lineBtn) {
        lineBtn.click();
        return true;
      }
      return false;
    });

    if (!lineClicked) {
      console.log('⚠️  Could not find/click Line button by text, attempting alternative...');
      // Try by position - usually the second button
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        if (buttons.length > 1) buttons[1].click();
      });
    }

    console.log('✓ Line button clicked');

    // Wait for chart to re-render
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Take screenshot of line chart
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-line-chart.png` });
    console.log('✓ Screenshot taken: line chart\n');

    // Verify line chart specifics
    console.log('Step 6: Verifying line chart properties...');

    const lineChartInfo = await page.evaluate(() => {
      // Check if the active button is Line
      const buttons = Array.from(document.querySelectorAll('button'));
      const lineBtn = buttons.find(btn => btn.textContent.trim() === 'Line');

      if (!lineBtn) return { lineButtonActive: false };

      const isActive = lineBtn.className.includes('bg-white') || lineBtn.className.includes('bg-gray-600');

      // Get canvas elements
      const canvases = Array.from(document.querySelectorAll('canvas'));

      return {
        lineButtonActive: isActive,
        canvasCount: canvases.length,
        hasCanvas: canvases.length > 0
      };
    });

    console.log(`✓ Line button is active: ${lineChartInfo.lineButtonActive}`);
    console.log(`✓ Canvas elements found: ${lineChartInfo.canvasCount}`);

    const test28Pass = lineChartInfo.lineButtonActive && lineChartInfo.hasCanvas;

    if (test28Pass) {
      console.log('\n✅ TEST #28 PASSED: Line chart switches successfully\n');
    } else {
      console.log('\n❌ TEST #28 FAILED: Line chart did not switch properly\n');
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('TEST #29: Switch to Area Chart\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('Step 7: Finding and clicking Area chart button...');

    // Click the Area button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const areaBtn = buttons.find(btn => btn.textContent.trim() === 'Area');
      if (areaBtn) areaBtn.click();
    });

    console.log('✓ Area button clicked');

    // Wait for chart to re-render
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Take screenshot of area chart
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-area-chart.png` });
    console.log('✓ Screenshot taken: area chart\n');

    // Verify area chart specifics
    console.log('Step 8: Verifying area chart properties...');

    const areaChartInfo = await page.evaluate(() => {
      // Check if the active button is Area
      const buttons = Array.from(document.querySelectorAll('button'));
      const areaBtn = buttons.find(btn => btn.textContent.trim() === 'Area');

      if (!areaBtn) return { areaButtonActive: false };

      const isActive = areaBtn.className.includes('bg-white') || areaBtn.className.includes('bg-gray-600');

      // Get canvas elements
      const canvases = Array.from(document.querySelectorAll('canvas'));

      return {
        areaButtonActive: isActive,
        canvasCount: canvases.length,
        hasCanvas: canvases.length > 0
      };
    });

    console.log(`✓ Area button is active: ${areaChartInfo.areaButtonActive}`);
    console.log(`✓ Canvas elements found: ${areaChartInfo.canvasCount}`);

    const test29Pass = areaChartInfo.areaButtonActive && areaChartInfo.hasCanvas;

    if (test29Pass) {
      console.log('\n✅ TEST #29 PASSED: Area chart switches successfully\n');
    } else {
      console.log('\n❌ TEST #29 FAILED: Area chart did not switch properly\n');
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('Step 9: Switching back to Candlestick chart...');

    // Click the Candlestick button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const candleBtn = buttons.find(btn => btn.textContent.trim() === 'Candlestick');
      if (candleBtn) candleBtn.click();
    });

    console.log('✓ Candlestick button clicked');

    // Wait for chart to re-render
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Take screenshot of final candlestick chart
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-final-candlestick.png` });
    console.log('✓ Screenshot taken: final candlestick chart\n');

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('FINAL RESULTS\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log(`Test #28 (Line Chart): ${test28Pass ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Test #29 (Area Chart): ${test29Pass ? '✅ PASSED' : '❌ FAILED'}`);

    const allTestsPass = test28Pass && test29Pass;

    console.log('\n═══════════════════════════════════════════════════════════════\n');

    if (allTestsPass) {
      console.log('🎉 ALL TESTS PASSED: Chart type switching is working correctly!');
      console.log('\nScreenshots saved to:', SCREENSHOT_DIR);
      console.log('  - 01-login-page.png');
      console.log('  - 02-initial-candlestick.png');
      console.log('  - 03-line-chart.png');
      console.log('  - 04-area-chart.png');
      console.log('  - 05-final-candlestick.png');
    } else {
      console.log('❌ SOME TESTS FAILED: Please review the screenshots and error messages above');
    }

    await browser.close();
    process.exit(allTestsPass ? 0 : 1);

  } catch (error) {
    console.error('❌ Test Error:', error.message);
    console.error('\nStack trace:', error.stack);
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
}

// Run the tests
runTests();

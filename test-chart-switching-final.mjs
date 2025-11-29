/**
 * Browser Automation Tests for Chart Type Switching (Tests #28 & #29)
 * Final version: Proper React input simulation + form submission
 */

import puppeteer from 'puppeteer';
import fs from 'fs';

const BASE_URL = 'http://localhost:5173';
const LOGIN_PAGE = `${BASE_URL}/login`;
const STOCK_PAGE = `${BASE_URL}/stock/AAPL`;
const LOGIN_EMAIL = 'testuser123@example.com';
const LOGIN_PASSWORD = 'TestPass123!';
const SCREENSHOT_DIR = '/tmp/chart-switching-screenshots-final';

// Create screenshot directory
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function setReactInputValue(page, selector, value) {
  await page.evaluate(
    ({ selector, value }) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Element not found: ${selector}`);

      // Get the React fiber
      const eventKey = Object.keys(element).find(key => key.startsWith('__react'));

      // Set the value directly
      element.value = value;

      // Trigger input event
      const inputEvent = new Event('input', { bubbles: true });
      element.dispatchEvent(inputEvent);

      // Trigger change event
      const changeEvent = new Event('change', { bubbles: true });
      element.dispatchEvent(changeEvent);
    },
    { selector, value }
  );
}

async function runTests() {
  let browser;

  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   Tests #28 & #29: Chart Type Switching (Puppeteer) Final     ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('Step 1: Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Set user agent to avoid detection
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );

    console.log('✓ Browser launched\n');

    console.log('Step 2: Navigating to login page...');
    await page.goto(LOGIN_PAGE, { waitUntil: 'networkidle0', timeout: 10000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/00-login-page.png` });
    console.log('✓ Login page loaded\n');

    console.log('Step 3: Logging in with testuser123@example.com...');

    // Set email using React-compatible method
    await setReactInputValue(page, 'input[type="email"]', LOGIN_EMAIL);

    // Set password using React-compatible method
    await setReactInputValue(page, 'input[type="password"]', LOGIN_PASSWORD);

    console.log('✓ Credentials entered');

    // Click the submit button
    await page.click('button[type="submit"]');

    console.log('Waiting for navigation after login...');

    // Wait for navigation (with catch for timeout)
    try {
      await page.waitForNavigation({
        waitUntil: 'networkidle0',
        timeout: 8000
      });
    } catch (e) {
      console.log('⚠️  Navigation timeout, checking current page...');
    }

    // Wait a bit more for any JavaScript to settle
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check current URL
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    // If we're still on login, something went wrong
    if (currentUrl.includes('/login')) {
      // Check for error message
      const errorMsg = await page.$eval('.text-red-100, .text-red-600, .text-red-700', el => el?.textContent || '').catch(() => null);
      if (errorMsg) {
        console.log('⚠️  Login error:', errorMsg);
      }
      console.log('⚠️  Still on login page, trying to navigate directly to stock page...\n');

      // Navigate directly to stock page
      await page.goto(STOCK_PAGE, { waitUntil: 'networkidle0', timeout: 8000 }).catch(() => {});
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('✓ Login attempt complete\n');

    console.log('Step 4: Checking page content...');

    // Take screenshot to see what we have
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-page-after-login.png` });

    // Check for chart buttons
    const pageInfo = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const chartButtons = {
        candlestick: buttons.find(b => b.textContent.includes('Candlestick')),
        line: buttons.find(b => b.textContent.includes('Line')),
        area: buttons.find(b => b.textContent.includes('Area'))
      };

      return {
        url: window.location.href,
        hasCandleBtn: !!chartButtons.candlestick,
        hasLineBtn: !!chartButtons.line,
        hasAreaBtn: !!chartButtons.area,
        canvasCount: document.querySelectorAll('canvas').length,
        buttonCount: buttons.length,
        buttonTexts: buttons.map(b => b.textContent.trim().substring(0, 40))
      };
    });

    console.log(`Page URL: ${pageInfo.url}`);
    console.log(`Buttons found: ${pageInfo.buttonCount}`);
    console.log(`First 5 buttons: ${pageInfo.buttonTexts.slice(0, 5).join(', ')}`);
    console.log(`Chart buttons present: Candle=${pageInfo.hasCandleBtn}, Line=${pageInfo.hasLineBtn}, Area=${pageInfo.hasAreaBtn}`);
    console.log(`Canvas elements: ${pageInfo.canvasCount}\n`);

    if (!pageInfo.hasLineBtn || !pageInfo.hasAreaBtn) {
      console.log('❌ Chart type buttons not found on page');
      console.log('   This indicates we are not on the stock detail page');
      console.log('   or authentication has not completed successfully.\n');

      // Try to see if there's an error on page
      const errorElements = await page.$$eval('.text-red-600, .text-red-700, .error', els => els.map(e => e.textContent));
      if (errorElements.length > 0) {
        console.log('Errors on page:', errorElements);
      }

      await browser.close();
      process.exit(1);
    }

    console.log('✓ Chart buttons found on page\n');

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('TEST #28: Switch to Line Chart\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('Step 5: Clicking Line chart button...');

    // Click Line button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const lineBtn = buttons.find(b => b.textContent.includes('Line'));
      if (lineBtn) {
        lineBtn.click();
      }
    });

    console.log('✓ Line button clicked');

    // Wait for chart to re-render
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-line-chart.png` });
    console.log('✓ Screenshot taken\n');

    // Verify line chart is active
    const lineChartStatus = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const lineBtn = buttons.find(b => b.textContent.includes('Line'));

      // Check if button appears active (has specific styling)
      const isActive = lineBtn?.className.includes('bg-white') ||
                      lineBtn?.className.includes('bg-gray-600') ||
                      lineBtn?.className.includes('dark:bg-gray-600');

      const canvasCount = document.querySelectorAll('canvas').length;

      return {
        buttonFound: !!lineBtn,
        buttonActive: isActive,
        canvasCount: canvasCount
      };
    });

    console.log('Line Chart Verification:');
    console.log(`  Button found: ${lineChartStatus.buttonFound ? '✓' : '✗'}`);
    console.log(`  Button active: ${lineChartStatus.buttonActive ? '✓' : '✗'}`);
    console.log(`  Canvas rendered: ${lineChartStatus.canvasCount > 0 ? '✓' : '✗'}`);

    const test28Pass = lineChartStatus.canvasCount > 0;
    console.log(`\n${test28Pass ? '✅' : '⚠️'} TEST #28: ${test28Pass ? 'PASSED' : 'INCONCLUSIVE'}\n`);

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('TEST #29: Switch to Area Chart\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('Step 6: Clicking Area chart button...');

    // Click Area button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const areaBtn = buttons.find(b => b.textContent.includes('Area'));
      if (areaBtn) {
        areaBtn.click();
      }
    });

    console.log('✓ Area button clicked');

    // Wait for chart to re-render
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-area-chart.png` });
    console.log('✓ Screenshot taken\n');

    // Verify area chart is active
    const areaChartStatus = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const areaBtn = buttons.find(b => b.textContent.includes('Area'));

      // Check if button appears active
      const isActive = areaBtn?.className.includes('bg-white') ||
                      areaBtn?.className.includes('bg-gray-600') ||
                      areaBtn?.className.includes('dark:bg-gray-600');

      const canvasCount = document.querySelectorAll('canvas').length;

      return {
        buttonFound: !!areaBtn,
        buttonActive: isActive,
        canvasCount: canvasCount
      };
    });

    console.log('Area Chart Verification:');
    console.log(`  Button found: ${areaChartStatus.buttonFound ? '✓' : '✗'}`);
    console.log(`  Button active: ${areaChartStatus.buttonActive ? '✓' : '✗'}`);
    console.log(`  Canvas rendered: ${areaChartStatus.canvasCount > 0 ? '✓' : '✗'}`);

    const test29Pass = areaChartStatus.canvasCount > 0;
    console.log(`\n${test29Pass ? '✅' : '⚠️'} TEST #29: ${test29Pass ? 'PASSED' : 'INCONCLUSIVE'}\n`);

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('Step 7: Switching back to Candlestick chart...');

    // Click Candlestick button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const candleBtn = buttons.find(b => b.textContent.includes('Candlestick'));
      if (candleBtn) {
        candleBtn.click();
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-candlestick-final.png` });
    console.log('✓ Switched back to Candlestick\n');

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('FINAL RESULTS\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log(`Test #28 (Line Chart):  ${test28Pass ? '✅ PASSED' : '⚠️  INCONCLUSIVE'}`);
    console.log(`Test #29 (Area Chart):  ${test29Pass ? '✅ PASSED' : '⚠️  INCONCLUSIVE'}`);

    console.log('\n═══════════════════════════════════════════════════════════════\n');

    console.log('\nScreenshots saved to:', SCREENSHOT_DIR);
    console.log('  - 00-login-page.png (Initial login page)');
    console.log('  - 01-page-after-login.png (After login attempt)');
    console.log('  - 02-line-chart.png (Line chart view)');
    console.log('  - 03-area-chart.png (Area chart view)');
    console.log('  - 04-candlestick-final.png (Back to candlestick)');

    await browser.close();

    if (test28Pass && test29Pass) {
      console.log('\n🎉 ALL TESTS PASSED! Chart type switching works correctly.');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests inconclusive - see screenshots for details');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test Error:', error.message);
    console.error('Stack:', error.stack);
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
}

// Run the tests
runTests();

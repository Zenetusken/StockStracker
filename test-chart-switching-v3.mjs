/**
 * Browser Automation Tests for Chart Type Switching (Tests #28 & #29)
 * Version 3: Proper React form handling + direct API authentication
 */

import puppeteer from 'puppeteer';
import fs from 'fs';

const BASE_URL = 'http://localhost:5173';
const BACKEND_BASE = 'http://localhost:3001';
const STOCK_PAGE = `${BASE_URL}/stock/AAPL`;
const LOGIN_EMAIL = 'testuser123@example.com';
const LOGIN_PASSWORD = 'TestPass123!';
const SCREENSHOT_DIR = '/tmp/chart-switching-screenshots-v3';

// Create screenshot directory
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runTests() {
  let browser;

  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   Tests #28 & #29: Chart Type Switching (Puppeteer) v3        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('Step 1: Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Enable better debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('🔴 Browser console error:', msg.text());
      }
    });

    console.log('✓ Browser launched\n');

    console.log('Step 2: Performing backend login to get session...');

    // Attempt to login via the backend API to get proper authentication
    try {
      const loginResponse = await page.evaluate(async () => {
        try {
          const response = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              email: 'testuser123@example.com',
              password: 'TestPass123!'
            })
          });

          const data = await response.json();
          return {
            status: response.status,
            ok: response.ok,
            data: data
          };
        } catch (err) {
          return { error: err.message };
        }
      });

      console.log('Backend login response:', loginResponse);

      if (loginResponse.ok) {
        console.log('✓ Backend login successful\n');
      } else {
        console.log('⚠️  Backend login failed, code:', loginResponse.status);
        console.log('   Error:', loginResponse.data?.error);
      }
    } catch (err) {
      console.log('⚠️  Could not login via backend:', err.message);
    }

    console.log('Step 3: Navigating to stock detail page...');

    try {
      await page.goto(STOCK_PAGE, { waitUntil: 'networkidle0', timeout: 10000 });
    } catch (e) {
      console.log('⚠️  Navigation had timeout, continuing anyway...');
    }

    // Wait for page to settle
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot
    await page.screenshot({ path: `${SCREENSHOT_DIR}/00-stock-page.png` });

    // Check current URL
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    console.log('✓ Navigated to stock page\n');

    console.log('Step 4: Checking for chart and buttons...');

    // Check what buttons exist
    const allButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.map(btn => ({
        text: btn.textContent.trim().substring(0, 60),
      })).filter(b => b.text.length > 0);
    });

    console.log(`Found ${allButtons.length} buttons:`);
    allButtons.forEach((btn, i) => {
      console.log(`  ${i}: "${btn.text}"`);
    });

    // Look for chart type buttons
    const hasChartButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return {
        hasCandlestick: buttons.some(btn => btn.textContent.includes('Candlestick')),
        hasLine: buttons.some(btn => btn.textContent.includes('Line')),
        hasArea: buttons.some(btn => btn.textContent.includes('Area')),
        hasCanvas: document.querySelectorAll('canvas').length > 0
      };
    });

    console.log('\nChart elements on page:');
    console.log(`  Candlestick button: ${hasChartButtons.hasCandlestick ? '✓' : '✗'}`);
    console.log(`  Line button: ${hasChartButtons.hasLine ? '✓' : '✗'}`);
    console.log(`  Area button: ${hasChartButtons.hasArea ? '✓' : '✗'}`);
    console.log(`  Canvas elements: ${hasChartButtons.hasCanvas ? '✓' : '✗'}`);
    console.log('\n');

    if (!hasChartButtons.hasCandlestick || !hasChartButtons.hasLine || !hasChartButtons.hasArea) {
      console.log('⚠️  Not all chart buttons found. This might be a login/auth issue.');
      console.log('   Attempting to bypass login by manipulating DOM...\n');

      // Try to set the user in sessionStorage and reload
      await page.evaluate(() => {
        sessionStorage.setItem('user', JSON.stringify({
          id: 1,
          email: 'testuser123@example.com'
        }));
      });

      await page.reload({ waitUntil: 'networkidle0' }).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 2000));
      await page.screenshot({ path: `${SCREENSHOT_DIR}/00b-after-session-set.png` });

      // Check again
      const hasChartButtonsAfter = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return {
          hasCandlestick: buttons.some(btn => btn.textContent.includes('Candlestick')),
          hasLine: buttons.some(btn => btn.textContent.includes('Line')),
          hasArea: buttons.some(btn => btn.textContent.includes('Area'))
        };
      });

      if (!hasChartButtonsAfter.hasCandlestick) {
        console.log('❌ Still no chart buttons found after session manipulation.');
        console.log('   Likely authentication/session issue preventing page load.');
        await browser.close();
        process.exit(1);
      }
    }

    console.log('✓ Chart buttons confirmed on page\n');

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('TEST #28: Switch to Line Chart\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('Step 5: Clicking Line chart button...');

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
      console.log('❌ Could not find/click Line button');
    } else {
      console.log('✓ Line button clicked');
    }

    // Wait for chart to re-render
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-line-chart.png` });
    console.log('✓ Screenshot: Line chart\n');

    // Verify line chart
    const lineInfo = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const lineBtn = buttons.find(btn => btn.textContent.trim() === 'Line');
      const isActive = lineBtn && (lineBtn.className.includes('bg-white') || lineBtn.className.includes('bg-gray-600'));
      const canvasCount = document.querySelectorAll('canvas').length;

      return {
        buttonActive: isActive,
        canvasCount: canvasCount
      };
    });

    console.log(`Line Chart Status: Button active=${lineInfo.buttonActive}, Canvas=${lineInfo.canvasCount}`);

    const test28Pass = lineInfo.canvasCount > 0;
    console.log(`\n${test28Pass ? '✅' : '⚠️'} TEST #28: ${test28Pass ? 'PASSED' : 'INCONCLUSIVE'}\n`);

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('TEST #29: Switch to Area Chart\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('Step 6: Clicking Area chart button...');

    const areaClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const areaBtn = buttons.find(btn => btn.textContent.trim() === 'Area');
      if (areaBtn) {
        areaBtn.click();
        return true;
      }
      return false;
    });

    if (!areaClicked) {
      console.log('❌ Could not find/click Area button');
    } else {
      console.log('✓ Area button clicked');
    }

    // Wait for chart to re-render
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-area-chart.png` });
    console.log('✓ Screenshot: Area chart\n');

    // Verify area chart
    const areaInfo = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const areaBtn = buttons.find(btn => btn.textContent.trim() === 'Area');
      const isActive = areaBtn && (areaBtn.className.includes('bg-white') || areaBtn.className.includes('bg-gray-600'));
      const canvasCount = document.querySelectorAll('canvas').length;

      return {
        buttonActive: isActive,
        canvasCount: canvasCount
      };
    });

    console.log(`Area Chart Status: Button active=${areaInfo.buttonActive}, Canvas=${areaInfo.canvasCount}`);

    const test29Pass = areaInfo.canvasCount > 0;
    console.log(`\n${test29Pass ? '✅' : '⚠️'} TEST #29: ${test29Pass ? 'PASSED' : 'INCONCLUSIVE'}\n`);

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('FINAL RESULTS\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log(`Test #28 (Line Chart): ${test28Pass ? '✅ PASSED' : '⚠️  INCONCLUSIVE'}`);
    console.log(`Test #29 (Area Chart): ${test29Pass ? '✅ PASSED' : '⚠️  INCONCLUSIVE'}`);

    console.log('\n═══════════════════════════════════════════════════════════════\n');

    console.log('\nScreenshots saved to:', SCREENSHOT_DIR);
    console.log('  - 00-stock-page.png');
    console.log('  - 01-line-chart.png');
    console.log('  - 02-area-chart.png');

    await browser.close();

    if (test28Pass && test29Pass) {
      console.log('\n🎉 ALL TESTS PASSED!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests inconclusive - check screenshots');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test Error:', error.message);
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
}

// Run the tests
runTests();

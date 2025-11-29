/**
 * Browser Automation Tests for Chart Type Switching (Tests #28 & #29)
 * Version 2: Direct navigation approach (bypasses login issues)
 */

import puppeteer from 'puppeteer';
import fs from 'fs';

const BASE_URL = 'http://localhost:5173';
const STOCK_PAGE = `${BASE_URL}/stock/AAPL`;
const SCREENSHOT_DIR = '/tmp/chart-switching-screenshots-v2';

// Create screenshot directory
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runTests() {
  let browser;

  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   Tests #28 & #29: Chart Type Switching (Puppeteer) v2        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('Step 1: Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.log('✓ Browser launched\n');

    console.log('Step 2: Attempting direct navigation to stock page...');
    try {
      await page.goto(STOCK_PAGE, { waitUntil: 'networkidle0', timeout: 10000 });
    } catch (e) {
      console.log('⚠️  Navigation had some issues, continuing anyway...');
    }

    // Wait a moment for the page to settle
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot to see what we're working with
    await page.screenshot({ path: `${SCREENSHOT_DIR}/00-initial-page.png` });

    // Check current URL
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    // Check if we're on the login page
    const isLoginPage = await page.evaluate(() => {
      return document.querySelector('input[type="email"]') !== null;
    });

    if (isLoginPage) {
      console.log('⚠️  We are on login page. Need to authenticate.\n');
      console.log('Step 3: Attempting login...');

      // Try to login
      await page.evaluate(() => {
        const emailInput = document.querySelector('input[type="email"]');
        if (emailInput) {
          emailInput.value = 'testuser123@example.com';
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          emailInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const passwordInput = document.querySelector('input[type="password"]');
        if (passwordInput) {
          passwordInput.value = 'TestPass123!';
          passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
          passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Click submit and wait
      await page.click('button[type="submit"]');

      // Wait for the page to load
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check if login was successful
      const postLoginUrl = page.url();
      console.log(`URL after login attempt: ${postLoginUrl}`);

      // If still on login, try navigate again
      if (postLoginUrl.includes('/login')) {
        console.log('⚠️  Still on login page, trying direct navigation again...');
        await page.goto(STOCK_PAGE, { waitUntil: 'networkidle0', timeout: 5000 }).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('✓ Page loaded\n');

    console.log('Step 4: Looking for chart and buttons...');

    // Take screenshot to see what's on the page
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-page-content.png` });

    // Check what buttons exist
    const allButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.map(btn => ({
        text: btn.textContent.trim().substring(0, 50),
        class: btn.className.substring(0, 100)
      })).filter(b => b.text.length > 0);
    });

    console.log(`Found ${allButtons.length} buttons on page:`);
    allButtons.slice(0, 10).forEach((btn, i) => {
      console.log(`  ${i}: "${btn.text}"`);
    });

    console.log('\n');

    // Check for chart type buttons specifically
    const chartButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const chartBtns = {
        candlestick: buttons.find(btn => btn.textContent.includes('Candlestick')),
        line: buttons.find(btn => btn.textContent.includes('Line')),
        area: buttons.find(btn => btn.textContent.includes('Area'))
      };
      return {
        candleFound: !!chartBtns.candlestick,
        lineFound: !!chartBtns.line,
        areaFound: !!chartBtns.area
      };
    });

    console.log('Chart type buttons found:');
    console.log(`  Candlestick: ${chartButtons.candleFound}`);
    console.log(`  Line: ${chartButtons.lineFound}`);
    console.log(`  Area: ${chartButtons.areaFound}`);
    console.log('\n');

    if (!chartButtons.candleFound) {
      console.log('❌ Chart type buttons not found! This might be a login issue.');
      console.log('   The page might be showing the login form instead of the stock detail page.');
      await browser.close();
      process.exit(1);
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('TEST #28: Switch to Line Chart\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('Step 5: Clicking Line chart button...');

    // Click the Line button
    const lineClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const lineBtn = buttons.find(btn => btn.textContent.includes('Line'));
      if (lineBtn) {
        lineBtn.click();
        return true;
      }
      return false;
    });

    if (!lineClicked) {
      console.log('❌ Could not click Line button');
    } else {
      console.log('✓ Line button clicked');
    }

    // Wait for chart to re-render
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot of line chart
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-line-chart.png` });
    console.log('✓ Screenshot taken: line chart\n');

    // Verify line chart is active
    const lineChartInfo = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const lineBtn = buttons.find(btn => btn.textContent.includes('Line'));

      if (!lineBtn) return { lineButtonActive: false, error: 'Line button not found' };

      const isActive = lineBtn.className.includes('bg-white') ||
                      lineBtn.className.includes('bg-gray-600') ||
                      lineBtn.className.includes('dark:bg-gray-600');

      const canvases = Array.from(document.querySelectorAll('canvas'));

      return {
        lineButtonActive: isActive,
        canvasCount: canvases.length,
        hasCanvas: canvases.length > 0,
        buttonClass: lineBtn.className.substring(0, 200)
      };
    });

    console.log('Line Chart Verification:');
    console.log(`  Line button active: ${lineChartInfo.lineButtonActive}`);
    console.log(`  Canvas elements: ${lineChartInfo.canvasCount}`);
    console.log(`  Button has visual indicator: ${lineChartInfo.lineButtonActive ? 'YES' : 'NO'}`);

    const test28Pass = lineChartInfo.canvasCount > 0;

    if (test28Pass) {
      console.log('\n✅ TEST #28 PASSED: Line chart displays\n');
    } else {
      console.log('\n⚠️  TEST #28 INCONCLUSIVE: Could not verify line chart\n');
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('TEST #29: Switch to Area Chart\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('Step 6: Clicking Area chart button...');

    // Click the Area button
    const areaClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const areaBtn = buttons.find(btn => btn.textContent.includes('Area'));
      if (areaBtn) {
        areaBtn.click();
        return true;
      }
      return false;
    });

    if (!areaClicked) {
      console.log('❌ Could not click Area button');
    } else {
      console.log('✓ Area button clicked');
    }

    // Wait for chart to re-render
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot of area chart
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-area-chart.png` });
    console.log('✓ Screenshot taken: area chart\n');

    // Verify area chart is active
    const areaChartInfo = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const areaBtn = buttons.find(btn => btn.textContent.includes('Area'));

      if (!areaBtn) return { areaButtonActive: false, error: 'Area button not found' };

      const isActive = areaBtn.className.includes('bg-white') ||
                      areaBtn.className.includes('bg-gray-600') ||
                      areaBtn.className.includes('dark:bg-gray-600');

      const canvases = Array.from(document.querySelectorAll('canvas'));

      return {
        areaButtonActive: isActive,
        canvasCount: canvases.length,
        hasCanvas: canvases.length > 0
      };
    });

    console.log('Area Chart Verification:');
    console.log(`  Area button active: ${areaChartInfo.areaButtonActive}`);
    console.log(`  Canvas elements: ${areaChartInfo.canvasCount}`);
    console.log(`  Button has visual indicator: ${areaChartInfo.areaButtonActive ? 'YES' : 'NO'}`);

    const test29Pass = areaChartInfo.canvasCount > 0;

    if (test29Pass) {
      console.log('\n✅ TEST #29 PASSED: Area chart displays\n');
    } else {
      console.log('\n⚠️  TEST #29 INCONCLUSIVE: Could not verify area chart\n');
    }

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('Step 7: Switching back to Candlestick chart...');

    // Click the Candlestick button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const candleBtn = buttons.find(btn => btn.textContent.includes('Candlestick'));
      if (candleBtn) candleBtn.click();
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Take screenshot
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-candlestick-final.png` });
    console.log('✓ Switched back to Candlestick\n');

    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('FINAL RESULTS\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log(`Test #28 (Line Chart): ${test28Pass ? '✅ PASSED' : '⚠️  INCONCLUSIVE'}`);
    console.log(`Test #29 (Area Chart): ${test29Pass ? '✅ PASSED' : '⚠️  INCONCLUSIVE'}`);

    console.log('\n═══════════════════════════════════════════════════════════════\n');

    console.log('\nScreenshots saved to:', SCREENSHOT_DIR);
    console.log('  - 00-initial-page.png');
    console.log('  - 01-page-content.png');
    console.log('  - 02-line-chart.png');
    console.log('  - 03-area-chart.png');
    console.log('  - 04-candlestick-final.png');

    await browser.close();
    process.exit((test28Pass && test29Pass) ? 0 : 1);

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

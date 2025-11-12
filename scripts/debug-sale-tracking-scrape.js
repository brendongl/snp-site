// scripts/debug-sale-tracking-scrape.js
// Debug script to see what the sale tracking page actually contains

const { chromium } = require('playwright');

async function debugSaleTracking() {
  console.log('🔍 Debugging sale tracking page scraping...\n');

  const email = process.env.IPOS_EMAIL || 'sipnplay@ipos.vn';
  const password = process.env.IPOS_PASSWORD;

  if (!password) {
    console.error('❌ IPOS_PASSWORD not set in environment');
    process.exit(1);
  }

  let browser, page;

  try {
    browser = await chromium.launch({
      headless: false,  // Show browser so we can see what's happening
      slowMo: 500
    });
    page = await browser.newPage();

    // Navigate to login page
    console.log('📝 Logging in...');
    await page.goto('https://fabi.ipos.vn/login', { waitUntil: 'networkidle' });

    // Fill in credentials
    await page.fill('input[name="email_input"]', email);
    await page.fill('input[type="password"]', password);

    // Click login and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button:has-text("Đăng nhập")')
    ]);

    console.log('✅ Logged in successfully\n');

    // Navigate to sale tracking page
    console.log('🔍 Navigating to sale tracking page...');
    await page.goto('https://fabi.ipos.vn/report/revenue/sale/track-sale', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('✅ Page loaded\n');

    // Check if we need to click on "Tables are open" tab
    const tabExists = await page.locator('text=Tables are open').count();
    if (tabExists > 0) {
      console.log('📑 Clicking "Tables are open" tab...');
      await page.click('text=Tables are open');
      await page.waitForTimeout(1000);
    }

    // Get the entire body text
    const bodyText = await page.evaluate(() => document.body.innerText);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📄 FULL PAGE TEXT:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(bodyText);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check for Entry Combo specifically
    const hasEntryCombo = bodyText.includes('Entry Combo');
    console.log(`🎫 Contains "Entry Combo": ${hasEntryCombo}`);

    if (hasEntryCombo) {
      // Find lines containing Entry Combo
      const lines = bodyText.split('\n');
      console.log('\n📋 Lines containing "Entry Combo":');
      lines.forEach((line, index) => {
        if (line.includes('Entry Combo') || line.includes('Entry')) {
          console.log(`  Line ${index}: "${line}"`);
        }
      });
    }

    // Try to find table cards
    const tableCards = await page.locator('[class*="table"]').count();
    console.log(`\n🪑 Found ${tableCards} elements with "table" in class name`);

    // Get HTML structure
    const tableHTML = await page.evaluate(() => {
      // Try to find the open tables section
      const bodyHTML = document.body.innerHTML;
      // Look for sections that might contain table data
      return bodyHTML.substring(0, 5000); // First 5000 chars
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 HTML STRUCTURE (first 5000 chars):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(tableHTML);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('\n✅ Debug complete. Press Ctrl+C to close browser.');
    await new Promise(() => {}); // Keep browser open

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugSaleTracking();

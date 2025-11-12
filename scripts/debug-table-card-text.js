// scripts/debug-table-card-text.js
// Debug script to see what text is in the table card elements

const { chromium } = require('playwright');

async function debugTableCards() {
  console.log('🔍 Debugging table card text content...\n');

  const email = process.env.IPOS_EMAIL || 'sipnplay@ipos.vn';
  const password = process.env.IPOS_PASSWORD;

  if (!password) {
    console.error('❌ IPOS_PASSWORD not set in environment');
    process.exit(1);
  }

  let browser, page;

  try {
    browser = await chromium.launch({
      headless: false,
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

    // Click on "Các bàn đang phục vụ" tab
    const tabButton = page.locator('text=Các bàn đang phục vụ');
    const tabExists = await tabButton.count();
    if (tabExists > 0) {
      console.log('📑 Clicking "Các bàn đang phục vụ" tab...');
      await tabButton.click();
      await page.waitForTimeout(2000);
    }

    console.log('✅ Page loaded\n');

    // Find all potential table cards
    const tableCards = await page.locator('[class*="card"], [class*="table"], button').all();
    console.log(`📊 Found ${tableCards.length} potential table elements\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📄 TEXT CONTENT OF EACH ELEMENT:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let matchingCount = 0;

    for (let i = 0; i < tableCards.length; i++) {
      const card = tableCards[i];
      try {
        const cardText = await card.innerText().catch(() => '');
        const isMatch = cardText.match(/G\d+T\d+/);

        console.log(`Element ${i + 1}:`);
        console.log(`  Match: ${isMatch ? '✅ YES' : '❌ NO'}`);
        console.log(`  Text: "${cardText.substring(0, 100).replace(/\n/g, ' ')}"`);
        console.log('');

        if (isMatch) {
          matchingCount++;
          console.log(`  🎯 MATCHED! Full text:`);
          console.log(`  "${cardText}"`);
          console.log('');
        }
      } catch (error) {
        console.log(`  Error: ${error.message}`);
        console.log('');
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n📊 Summary: ${matchingCount} elements match G\d+T\d+ pattern\n`);

    console.log('✅ Debug complete. Press Ctrl+C to close browser.');
    await new Promise(() => {}); // Keep browser open

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugTableCards();

// scripts/debug-find-table-selector.js
// Find the correct selector for table cards

const { chromium } = require('playwright');
const fs = require('fs');

async function debugTableSelector() {
  console.log('🔍 Finding correct selector for table cards...\n');

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
      await page.waitForTimeout(3000); // Wait longer for table cards to load
    }

    console.log('✅ Page loaded\n');

    // Get the full page HTML
    const pageHTML = await page.content();

    // Save to file for inspection
    fs.writeFileSync('debug-sale-tracking-page.html', pageHTML);
    console.log('💾 Saved full page HTML to debug-sale-tracking-page.html\n');

    // Search for G1T02 or similar patterns in the HTML
    console.log('🔍 Searching for table patterns in HTML...\n');
    const matches = pageHTML.match(/G\d+T\d+/g);
    if (matches) {
      console.log(`✅ Found ${matches.length} table pattern matches:`);
      console.log(matches);
      console.log('');
    } else {
      console.log('❌ No G\\d+T\\d+ patterns found in HTML\n');
    }

    // Try to find elements containing G1T
    const textSearch = await page.evaluate(() => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null
      );

      const results = [];
      let node;

      while (node = walker.nextNode()) {
        if (node.textContent && node.textContent.match(/G\d+T\d+/)) {
          const parent = node.parentElement;
          results.push({
            text: node.textContent.trim(),
            tagName: parent.tagName,
            className: parent.className,
            id: parent.id
          });
        }
      }

      return results;
    });

    if (textSearch.length > 0) {
      console.log('📊 Found elements containing table patterns:');
      textSearch.forEach((item, index) => {
        console.log(`\n${index + 1}. ${item.tagName} (class: "${item.className}", id: "${item.id}")`);
        console.log(`   Text: "${item.text}"`);
      });
    } else {
      console.log('❌ No elements found with table patterns\n');
    }

    console.log('\n✅ Debug complete. Check debug-sale-tracking-page.html for full HTML.');
    console.log('Browser will stay open - press Ctrl+C to close.');
    await new Promise(() => {}); // Keep browser open

  } catch (error) {
    console.error('❌ Error:', error);
    if (browser) await browser.close();
  }
}

debugTableSelector();

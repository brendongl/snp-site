// scripts/debug-order-modal-structure.js
// Debug the order log modal structure to find quantity column

const { chromium } = require('playwright');
const fs = require('fs');

async function debugModalStructure() {
  console.log('🔍 Debugging order modal structure...\n');

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

    // Login
    console.log('📝 Logging in...');
    await page.goto('https://fabi.ipos.vn/login', { waitUntil: 'networkidle' });
    await page.fill('input[name="email_input"]', email);
    await page.fill('input[type="password"]', password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button:has-text("Đăng nhập")')
    ]);

    console.log('✅ Logged in\n');

    // Navigate to sale tracking
    console.log('🔍 Navigating to sale tracking...');
    await page.goto('https://fabi.ipos.vn/report/revenue/sale/track-sale', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click on "Các bàn đang phục vụ" tab
    const tabButton = page.locator('text=Các bàn đang phục vụ');
    if (await tabButton.count() > 0) {
      console.log('📑 Clicking tab...');
      await tabButton.click();
      await page.waitForTimeout(2000);
    }

    // Find all order log links
    const orderLogLinks = await page.locator('text=Xem nhật ký order').all();
    console.log(`\n📊 Found ${orderLogLinks.length} tables\n`);

    if (orderLogLinks.length === 0) {
      console.log('❌ No tables found');
      await browser.close();
      return;
    }

    // Click the first link to open modal
    console.log('🖱️ Clicking first table order log...');
    await orderLogLinks[0].click();
    await page.waitForTimeout(2000);

    // Get modal content
    const modalText = await page.locator('.modal.show').innerText();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📄 MODAL TEXT CONTENT:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(modalText);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Try to extract items in a structured way
    console.log('🔍 Attempting to parse table rows...\n');

    const rows = await page.locator('.modal.show table tbody tr').all();
    console.log(`Found ${rows.length} table rows\n`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = await row.locator('td').all();

      if (cells.length > 0) {
        const cellTexts = [];
        for (const cell of cells) {
          const text = await cell.innerText();
          cellTexts.push(text.trim());
        }
        console.log(`Row ${i + 1}:`, JSON.stringify(cellTexts));
      }
    }

    console.log('\n✅ Debug complete. Browser will stay open.');
    await new Promise(() => {}); // Keep open

  } catch (error) {
    console.error('❌ Error:', error);
    if (browser) await browser.close();
  }
}

debugModalStructure();

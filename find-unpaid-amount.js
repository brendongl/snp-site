const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('[1] Navigating to login page...');
  await page.goto('https://fabi.ipos.vn/login', { waitUntil: 'networkidle' });

  console.log('[2] Filling credentials...');
  await page.fill('input[name="email_input"]', 'sipnplay@ipos.vn');
  await page.fill('input[type="password"]', '123123A');

  console.log('[3] Clicking login button...');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('button:has-text("Đăng nhập")')
  ]);

  console.log('[4] Waiting for dashboard to load...');
  await page.waitForSelector('text=Doanh thu (NET)', { timeout: 10000 });
  await page.waitForTimeout(3000); // Extra wait for data to load

  console.log('[5] Finding all money amounts...');
  const textContent = await page.evaluate(() => document.body.innerText);

  // Find all lines with money amounts
  const lines = textContent.split('\n');
  console.log('\n=== ALL MONEY AMOUNTS AND PRECEDING TEXT ===');

  for (let i = 0; i < lines.length; i++) {
    // Look for lines with numbers and ₫ symbol
    if (lines[i].match(/[\d,]+\s*₫/)) {
      console.log(`\nAmount found at line ${i}: ${lines[i]}`);
      if (i > 0) {
        console.log(`  Previous line (${i-1}): ${lines[i-1]}`);
      }
      if (i > 1) {
        console.log(`  2 lines before (${i-2}): ${lines[i-2]}`);
      }
    }
  }

  // Look for specific sections
  console.log('\n=== SEARCHING FOR SPECIFIC SECTIONS ===');
  const searchTerms = [
    'Hiện tại ở quán',
    'Chưa thanh toán',
    'Tổng tiền',
    'Unpaid',
    'Còn lại',
    'Đang chờ',
    'Pending',
    'Doanh thu',
    'Revenue'
  ];

  for (const term of searchTerms) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(term.toLowerCase())) {
        console.log(`\nFound "${term}" at line ${i}: ${lines[i]}`);
        if (i + 1 < lines.length) {
          console.log(`  Next line (${i+1}): ${lines[i+1]}`);
        }
        if (i + 2 < lines.length) {
          console.log(`  2 lines after (${i+2}): ${lines[i+2]}`);
        }
      }
    }
  }

  await page.waitForTimeout(2000);
  await browser.close();

  console.log('\nDone!');
})();
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
  
  console.log('[5] Taking screenshot...');
  await page.screenshot({ path: 'dashboard.png', fullPage: false });
  
  console.log('[6] Extracting text content...');
  const textContent = await page.evaluate(() => document.body.innerText);
  
  // Look for key patterns
  console.log('\n=== KEY PATTERNS IN PAGE ===');
  
  const patterns = [
    /Tổng tiền chưa thanh toán\s+([\d,]+)/,
    /Doanh thu \(NET\)\s+([\d,]+)/,
    /Có\s+(\d+)\s+bàn\s+\/\s+(\d+)\s+bàn/,
    /Tổng:\s+(\d+)\s+khách/,
    /([\d,]+)\s*₫/g
  ];
  
  for (const pattern of patterns) {
    const matches = textContent.match(pattern);
    if (matches) {
      console.log(`Pattern ${pattern.source}: ${matches[0]}`);
    }
  }
  
  // Look for the actual revenue value
  const lines = textContent.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Doanh thu (NET)')) {
      console.log(`\nFound "Doanh thu (NET)" at line ${i}:`);
      console.log(`  Line ${i}: ${lines[i]}`);
      console.log(`  Line ${i+1}: ${lines[i+1]}`);
      console.log(`  Line ${i+2}: ${lines[i+2]}`);
      break;
    }
  }
  
  await page.waitForTimeout(5000);
  await browser.close();
  
  console.log('\nDone! Check dashboard.png for screenshot.');
})();

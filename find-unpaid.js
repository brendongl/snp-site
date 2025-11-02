const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Logging in...');
  await page.goto('https://fabi.ipos.vn/login', { waitUntil: 'networkidle' });
  await page.fill('input[name="email_input"]', 'sipnplay@ipos.vn');
  await page.fill('input[type="password"]', '123123A');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('button:has-text("Đăng nhập")')
  ]);
  
  console.log('Waiting for dashboard...');
  await page.waitForSelector('text=Doanh thu (NET)', { timeout: 10000 });
  await page.waitForTimeout(3000);
  
  const textContent = await page.evaluate(() => document.body.innerText);
  
  console.log('\n=== SEARCHING FOR UNPAID AMOUNT ===');
  
  // Search for various patterns
  const searchTerms = [
    'chưa thanh toán',
    'Hiện tại ở quán',
    'unpaid',
    'Tổng tiền'
  ];
  
  const lines = textContent.split('\n');
  for (const term of searchTerms) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(term.toLowerCase())) {
        console.log(`\nFound "${term}" at line ${i}:`);
        if (i > 0) console.log(`  Line ${i-1}: ${lines[i-1]}`);
        console.log(`  Line ${i}: ${lines[i]}`);
        if (i < lines.length - 1) console.log(`  Line ${i+1}: ${lines[i+1]}`);
      }
    }
  }
  
  await browser.close();
})();

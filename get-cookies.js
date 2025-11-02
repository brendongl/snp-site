const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://fabi.ipos.vn/dashboard');
  await page.waitForTimeout(3000);
  
  // Get ALL cookies including httpOnly
  const cookies = await context.cookies();
  
  console.log('\n=== ALL COOKIES (including httpOnly) ===');
  for (const cookie of cookies) {
    console.log(`${cookie.name}: ${cookie.value}`);
    console.log(`  domain: ${cookie.domain}, httpOnly: ${cookie.httpOnly}, secure: ${cookie.secure}`);
  }
  console.log('=====================================\n');
  
  await browser.close();
})();

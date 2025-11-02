// Script to capture exact request headers from browser
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture all requests to posapi.ipos.vn
  page.on('request', request => {
    if (request.url().includes('posapi.ipos.vn')) {
      console.log('\n=== CAPTURED API REQUEST ===');
      console.log('URL:', request.url());
      console.log('Method:', request.method());
      console.log('Headers:', JSON.stringify(request.headers(), null, 2));
      console.log('===========================\n');
    }
  });

  // Navigate to dashboard (will already be logged in from previous session)
  await page.goto('https://fabi.ipos.vn/dashboard');
  
  // Wait for API calls to complete
  await page.waitForTimeout(5000);
  
  console.log('\nDone capturing. Press Ctrl+C to exit.');
})();

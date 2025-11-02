const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  
  // Enable CDP session to capture full request details
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  
  // Enable network tracking
  await client.send('Network.enable');
  
  // Capture request with full headers
  client.on('Network.requestWillBeSent', (params) => {
    if (params.request.url.includes('posapi.ipos.vn')) {
      console.log('\n=== FULL REQUEST DETAILS ===');
      console.log('URL:', params.request.url);
      console.log('Method:', params.request.method);
      console.log('\nHeaders:');
      for (const [key, value] of Object.entries(params.request.headers)) {
        console.log(`  ${key}: ${value}`);
      }
      console.log('===========================\n');
    }
  });
  
  await page.goto('https://fabi.ipos.vn/dashboard');
  await page.waitForTimeout(5000);
  
  console.log('Done. Press Ctrl+C to exit.');
})();

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  
  await client.send('Network.enable');
  
  let capturedToken = null;
  
  client.on('Network.requestWillBeSent', (params) => {
    if (params.request.url.includes('posapi.ipos.vn') && params.request.headers.access_token) {
      capturedToken = params.request.headers.access_token;
    }
  });
  
  await page.goto('https://fabi.ipos.vn/dashboard');
  await page.waitForTimeout(5000);
  
  console.log('\n=== FRESH ACCESS_TOKEN ===');
  console.log(capturedToken || 'NOT FOUND');
  console.log('==========================\n');
  
  await browser.close();
})();

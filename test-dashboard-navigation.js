const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true }); // Using headless like the service
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

  console.log('[4] Current URL after login:', page.url());

  // Check if we're on the dashboard, if not navigate there
  if (!page.url().includes('/dashboard')) {
    console.log('[5] Navigating to dashboard...');
    await page.goto('https://fabi.ipos.vn/dashboard', { waitUntil: 'networkidle' });
  }

  console.log('[6] Waiting for dashboard to load...');
  try {
    await page.waitForSelector('text=Doanh thu (NET)', { timeout: 10000 });
    console.log('[7] Dashboard loaded successfully!');
  } catch (e) {
    console.log('[7] Failed to find "Doanh thu (NET)" - dashboard may not have loaded');
  }

  console.log('[8] Current URL:', page.url());

  // Extract data to verify
  const data = await page.evaluate(() => {
    const textContent = document.body.innerText;
    const lines = textContent.split('\n');

    let unpaidAmount = 0;
    let paidAmount = 0;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('Hiện tại ở quán')) {
        if (i + 1 < lines.length) {
          const match = lines[i + 1].match(/([\d,]+)\s*₫?/);
          if (match) {
            unpaidAmount = parseFloat(match[1].replace(/,/g, ''));
          }
        }
      }
      if (lines[i].includes('Doanh thu (NET)')) {
        if (i + 1 < lines.length) {
          const match = lines[i + 1].match(/([\d,]+)\s*₫?/);
          if (match) {
            paidAmount = parseFloat(match[1].replace(/,/g, ''));
          }
        }
      }
    }

    return { unpaidAmount, paidAmount };
  });

  console.log('[9] Extracted data:', data);

  await browser.close();
  console.log('\nDone!');
})();
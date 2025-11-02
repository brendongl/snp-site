const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
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

  // Wait longer for data to load
  console.log('[5] Waiting for dashboard to fully load...');
  await page.waitForTimeout(5000); // Wait 5 seconds for all data

  // Check what we can see
  const pageText = await page.evaluate(() => document.body.innerText);

  // Look for key indicators
  console.log('[6] Checking for key text patterns...');
  console.log('  - Has "Doanh thu (NET)"?', pageText.includes('Doanh thu (NET)'));
  console.log('  - Has "Hiện tại ở quán"?', pageText.includes('Hiện tại ở quán'));
  console.log('  - Has any ₫ symbols?', pageText.includes('₫'));

  // Try to find any amounts
  const amountMatches = pageText.match(/[\d,]+\s*₫/g);
  console.log('[7] Found amounts:', amountMatches ? amountMatches.slice(0, 5) : 'None');

  // Extract with more debugging
  const data = await page.evaluate(() => {
    const textContent = document.body.innerText;
    const lines = textContent.split('\n');

    let unpaidAmount = 0;
    let paidAmount = 0;
    let foundUnpaidText = false;
    let foundPaidText = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('Hiện tại ở quán')) {
        foundUnpaidText = true;
        console.log(`Found "Hiện tại ở quán" at line ${i}: ${lines[i]}`);
        if (i + 1 < lines.length) {
          console.log(`Next line: ${lines[i + 1]}`);
          const match = lines[i + 1].match(/([\d,]+)\s*₫?/);
          if (match) {
            unpaidAmount = parseFloat(match[1].replace(/,/g, ''));
            console.log(`Extracted unpaid amount: ${unpaidAmount}`);
          }
        }
      }
      if (lines[i].includes('Doanh thu (NET)')) {
        foundPaidText = true;
        console.log(`Found "Doanh thu (NET)" at line ${i}: ${lines[i]}`);
        if (i + 1 < lines.length) {
          console.log(`Next line: ${lines[i + 1]}`);
          const match = lines[i + 1].match(/([\d,]+)\s*₫?/);
          if (match) {
            paidAmount = parseFloat(match[1].replace(/,/g, ''));
            console.log(`Extracted paid amount: ${paidAmount}`);
          }
        }
      }
    }

    return {
      unpaidAmount,
      paidAmount,
      foundUnpaidText,
      foundPaidText,
      totalLines: lines.length
    };
  });

  console.log('[8] Extracted data:', data);

  // Take a screenshot to see what the headless browser sees
  await page.screenshot({ path: 'headless-dashboard.png' });
  console.log('[9] Screenshot saved to headless-dashboard.png');

  await browser.close();
  console.log('\nDone!');
})();
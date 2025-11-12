// scripts/view-local-pos-header.js
// Open local dev server in Playwright to view the new POS header

const { chromium } = require('playwright');

async function viewLocalPOS() {
  console.log('🌐 Opening localhost:3000 in browser...\n');
  console.log('You can now see the new customer counting system!');
  console.log('');
  console.log('Look for:');
  console.log('  ✅ Paid: [number] (customers who paid and left)');
  console.log('  ⏱️  In Store: [number] (customers currently in store)');
  console.log('');
  console.log('Press Ctrl+C in this terminal to close the browser.\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  const page = await browser.newPage();

  try {
    // Navigate to local dev server
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    console.log('✅ Page loaded successfully!');
    console.log('');
    console.log('The POS header at the top shows:');
    console.log('  💰 Unpaid / ✅ Paid / 🪑 Tables / ✅ Paid (customers) / ⏱️ In Store (customers)');
    console.log('');
    console.log('Note: The customer counts will update every 5 minutes automatically.');
    console.log('');

    // Keep browser open indefinitely
    await new Promise(() => {}); // Never resolves - keeps browser open

  } catch (error) {
    console.error('❌ Error:', error.message);
    await browser.close();
  }
}

viewLocalPOS();

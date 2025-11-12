// scripts/open-local-browser.js
// Simple browser open without waiting for networkidle

const { chromium } = require('playwright');

async function openBrowser() {
  console.log('🌐 Opening localhost:3000 in browser...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100
  });

  const page = await browser.newPage();

  try {
    // Navigate without waiting for networkidle (since SSE keeps it busy)
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 10000 });

    console.log('✅ Browser opened!');
    console.log('');
    console.log('📊 Look at the blue header bar at the top:');
    console.log('   💰 Unpaid Amount');
    console.log('   ✅ Paid Amount');
    console.log('   🪑 Tables');
    console.log('   ✅ Paid (NEW - customers who paid)');
    console.log('   ⏱️  In Store (NEW - customers currently there)');
    console.log('');
    console.log('⏳ The POS data loads from iPOS after a few seconds...');
    console.log('');
    console.log('Browser will stay open - close this terminal or press Ctrl+C to exit.');
    console.log('');

    // Keep browser open
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error:', error.message);
    await browser.close();
  }
}

openBrowser();

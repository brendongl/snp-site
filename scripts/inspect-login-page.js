// scripts/inspect-login-page.js
// Inspect what's actually on the login page

const puppeteer = require('puppeteer');

async function inspectLoginPage() {
  console.log('🔍 Inspecting login page structure...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  try {
    const page = await browser.newPage();

    console.log('Loading login page...');
    await page.goto('https://fabi.ipos.vn/login', { waitUntil: 'networkidle0' });

    // Wait for page to fully load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Take screenshot
    await page.screenshot({ path: 'login-page.png', fullPage: true });
    console.log('✅ Screenshot saved to login-page.png');

    // Check what input fields exist
    console.log('\n📋 Input fields on page:');
    const inputs = await page.evaluate(() => {
      const allInputs = Array.from(document.querySelectorAll('input'));
      return allInputs.map(input => ({
        type: input.type,
        name: input.name,
        id: input.id,
        placeholder: input.placeholder,
        className: input.className
      }));
    });

    if (inputs.length === 0) {
      console.log('   ❌ No input fields found!');
    } else {
      inputs.forEach((input, i) => {
        console.log(`\n   Input ${i + 1}:`);
        console.log(`     Type: ${input.type || 'not set'}`);
        console.log(`     Name: ${input.name || 'not set'}`);
        console.log(`     ID: ${input.id || 'not set'}`);
        console.log(`     Placeholder: ${input.placeholder || 'not set'}`);
        console.log(`     Class: ${input.className || 'not set'}`);
      });
    }

    // Check for buttons
    console.log('\n\n📋 Buttons on page:');
    const buttons = await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button'));
      return allButtons.map(btn => ({
        type: btn.type,
        text: btn.textContent.trim().substring(0, 50),
        className: btn.className
      }));
    });

    if (buttons.length === 0) {
      console.log('   ❌ No buttons found!');
    } else {
      buttons.forEach((btn, i) => {
        console.log(`\n   Button ${i + 1}:`);
        console.log(`     Type: ${btn.type || 'not set'}`);
        console.log(`     Text: ${btn.text}`);
        console.log(`     Class: ${btn.className || 'not set'}`);
      });
    }

    // Check if it's a Vue.js app
    console.log('\n\n📋 Page info:');
    const pageInfo = await page.evaluate(() => ({
      hasVue: typeof window.Vue !== 'undefined',
      title: document.title,
      bodyHTML: document.body.innerHTML.substring(0, 500)
    }));

    console.log(`   Title: ${pageInfo.title}`);
    console.log(`   Has Vue: ${pageInfo.hasVue}`);
    console.log(`   Body HTML (first 500 chars):\n${pageInfo.bodyHTML}`);

    console.log('\n\n⏳ Keeping browser open for 20 seconds for manual inspection...');
    console.log('   Press Ctrl+C to close early\n');
    await new Promise(resolve => setTimeout(resolve, 20000));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

inspectLoginPage().catch(console.error);

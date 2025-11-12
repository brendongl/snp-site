// scripts/get-entry-ticket-sales.js
// Fetch Entry Combo + Entry Only sales for today

const { chromium } = require('playwright');

const IPOS_EMAIL = process.env.IPOS_EMAIL || 'sipnplay@ipos.vn';
const IPOS_PASSWORD = process.env.IPOS_PASSWORD || '123123A';

const BRAND_UID = '32774afe-fd5c-4028-b837-f91837c0307c';
const COMPANY_UID = '8a508e04-440f-4145-9429-22b7696c6193';
const STORE_UID = '72a800a6-1719-4b4b-9065-31ab2e0c07e5';

async function getEntryTicketSales() {
  console.log('🎫 Fetching Entry ticket sales for today...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  let accessToken = '';
  let authToken = '';

  try {
    const page = await browser.newPage();

    // Capture authentication tokens from API responses
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('posapi.ipos.vn')) {
        const headers = response.request().headers();
        if (headers['access_token']) accessToken = headers['access_token'];
        if (headers['authorization']) authToken = headers['authorization'];
      }
    });

    // Login
    console.log('🔐 Logging in...');
    await page.goto('https://fabi.ipos.vn/login', { waitUntil: 'networkidle' });
    await page.fill('input[name="email_input"]', IPOS_EMAIL);
    await page.fill('input[type="password"]', IPOS_PASSWORD);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button:has-text("Đăng nhập")')
    ]);

    await page.waitForTimeout(3000);
    await browser.close();

    if (!accessToken || !authToken) {
      throw new Error('Failed to capture authentication tokens');
    }

    console.log('✅ Authentication successful\n');

    // Get today's date range (from 10 AM)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0);
    const startDate = today.getTime();
    const endDate = now.getTime();

    // Build API URL
    const params = new URLSearchParams({
      brand_uid: BRAND_UID,
      company_uid: COMPANY_UID,
      list_store_uid: STORE_UID,
      start_date: startDate.toString(),
      end_date: endDate.toString(),
      store_open_at: '10',
      limit: '100',
      order_by: 'revenue_net'
    });

    const url = `https://posapi.ipos.vn/api/v1/reports/sale-summary/items?${params}`;

    console.log('📊 Fetching item sales data...');

    // Make API request
    const response = await fetch(url, {
      headers: {
        'access_token': accessToken,
        'authorization': authToken,
        'fabi_type': 'pos-cms',
        'x-client-timezone': '25200000',
        'accept-language': 'vi',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const items = data.data.list_data_item_return || [];

    // Find Entry tickets
    const entryCombo = items.find(item =>
      item.item_name.toLowerCase().includes('entry combo')
    );
    const entryOnly = items.find(item =>
      item.item_name.toLowerCase().includes('entry only')
    );

    // Display results
    console.log('✅ Successfully fetched data\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎫 ENTRY TICKET SALES - TODAY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (entryCombo) {
      console.log('📦 Entry Combo');
      console.log(`   Quantity Sold: ${Math.round(entryCombo.quantity_sold)}`);
      console.log(`   Revenue (Gross): ${entryCombo.revenue_gross.toLocaleString()}₫`);
      console.log(`   Revenue (Net): ${entryCombo.revenue_net.toLocaleString()}₫`);
      console.log(`   Discount: ${entryCombo.discount_amount.toLocaleString()}₫`);
    } else {
      console.log('📦 Entry Combo: Not found or 0 sold');
    }

    console.log('');

    if (entryOnly) {
      console.log('🎟️  Entry Only');
      console.log(`   Quantity Sold: ${Math.round(entryOnly.quantity_sold)}`);
      console.log(`   Revenue (Gross): ${entryOnly.revenue_gross.toLocaleString()}₫`);
      console.log(`   Revenue (Net): ${entryOnly.revenue_net.toLocaleString()}₫`);
      console.log(`   Discount: ${entryOnly.discount_amount.toLocaleString()}₫`);
    } else {
      console.log('🎟️  Entry Only: Not found or 0 sold');
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 TOTAL ENTRY TICKETS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const totalQuantity = Math.round(
      (entryCombo?.quantity_sold || 0) + (entryOnly?.quantity_sold || 0)
    );
    const totalRevenue =
      (entryCombo?.revenue_net || 0) + (entryOnly?.revenue_net || 0);

    console.log(`   Total Tickets: ${totalQuantity}`);
    console.log(`   Total Revenue: ${totalRevenue.toLocaleString()}₫`);
    console.log('');

    // Show breakdown percentage
    if (entryCombo && entryOnly && totalQuantity > 0) {
      const comboPercent = Math.round((entryCombo.quantity_sold / totalQuantity) * 100);
      const onlyPercent = Math.round((entryOnly.quantity_sold / totalQuantity) * 100);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📈 BREAKDOWN');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log(`   Entry Combo: ${comboPercent}%`);
      console.log(`   Entry Only:  ${onlyPercent}%`);
      console.log('');
    }

    // Bonus: Show other entry-related items
    const otherEntryItems = items.filter(item =>
      (item.item_type_name === 'ENTRY' || item.item_name.toLowerCase().includes('entry')) &&
      !item.item_name.toLowerCase().includes('entry combo') &&
      !item.item_name.toLowerCase().includes('entry only')
    );

    if (otherEntryItems.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎮 OTHER ENTRY-RELATED ITEMS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      otherEntryItems.forEach(item => {
        console.log(`   ${item.item_name}`);
        console.log(`   Quantity: ${Math.round(item.quantity_sold)} | Revenue: ${item.revenue_net.toLocaleString()}₫`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

getEntryTicketSales();

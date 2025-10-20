require('dotenv').config({ path: '.env.local' });

const fetch = require('node-fetch');
const { Pool } = require('pg');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_SIP_N_PLAY_BASE_ID = process.env.AIRTABLE_SIP_N_PLAY_BASE_ID || 'appjD3LJhXYjp0tXm';
const AIRTABLE_STAFF_TABLE_ID = process.env.AIRTABLE_STAFF_TABLE_ID || 'tblLthDOTzCPbSdAA';
const DATABASE_URL = process.env.DATABASE_URL;

const pool = new Pool({ connectionString: DATABASE_URL });

(async () => {
  try {
    console.log('📥 Syncing staff from Airtable to database...\n');

    // Fetch from Airtable
    console.log('1️⃣  Fetching staff from Airtable...');
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_SIP_N_PLAY_BASE_ID}/${AIRTABLE_STAFF_TABLE_ID}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } }
    );

    if (!response.ok) throw new Error(`Airtable API error: ${response.statusText}`);

    const data = await response.json();
    const staff = data.records.map(r => ({
      id: r.id,
      name: r.fields['Name'] || 'Unknown',
      email: r.fields['Email'] || '',
      type: r.fields['Type'] || 'Staff'
    }));

    console.log(`   ✓ Fetched ${staff.length} staff members\n`);

    // Sync to database
    console.log('2️⃣  Syncing to database...');
    const client = await pool.connect();

    try {
      await client.query('DELETE FROM staff_list');
      for (const s of staff) {
        await client.query(
          'INSERT INTO staff_list (staff_id, staff_name, staff_email, staff_type) VALUES ($1, $2, $3, $4)',
          [s.id, s.name, s.email, s.type]
        );
      }
      console.log(`   ✓ Synced ${staff.length} staff members\n`);
      console.log('✅ Staff sync complete!\n');
    } finally {
      client.release();
    }

    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();

const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

// STAGING DATABASE
const STAGING_DATABASE_URL = 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

// Environment variables
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_SIP_N_PLAY_BASE_ID = process.env.AIRTABLE_SIP_N_PLAY_BASE_ID || 'appjD3LJhXYjp0tXm';
const AIRTABLE_STAFF_TABLE_ID = process.env.AIRTABLE_STAFF_TABLE_ID || 'tblLthDOTzCPbSdAA';

// Persistent volume path for National ID images
const STAFF_IDS_DIR = path.join(process.cwd(), 'data', 'staff-ids');

const pool = new Pool({ connectionString: STAGING_DATABASE_URL });

/**
 * Ensure staff-ids directory exists
 */
async function ensureDirectoryExists() {
  try {
    await fs.access(STAFF_IDS_DIR);
    console.log(`✓ Staff IDs directory exists: ${STAFF_IDS_DIR}`);
  } catch {
    await fs.mkdir(STAFF_IDS_DIR, { recursive: true });
    console.log(`✓ Created staff IDs directory: ${STAFF_IDS_DIR}`);
  }
}

/**
 * Calculate MD5 hash from buffer
 */
function calculateHash(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

/**
 * Download image from URL and save to persistent volume
 */
async function downloadAndSaveImage(imageUrl, staffName) {
  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const hash = calculateHash(buffer);

    const urlPath = new URL(imageUrl).pathname;
    let extension = path.extname(urlPath).toLowerCase();

    if (!extension || extension === '') {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('jpeg') || contentType?.includes('jpg')) {
        extension = '.jpg';
      } else if (contentType?.includes('png')) {
        extension = '.png';
      } else {
        extension = '.jpg';
      }
    }

    const filename = `${hash}${extension}`;
    const filePath = path.join(STAFF_IDS_DIR, filename);

    // Check if file already exists
    try {
      await fs.access(filePath);
      console.log(`   ✓ File already exists: ${filename}`);
      return hash;
    } catch {
      // File doesn't exist, continue with save
    }

    // Atomic write: write to temp file, then rename
    const tempPath = path.join(STAFF_IDS_DIR, `${hash}.tmp`);

    try {
      await fs.writeFile(tempPath, buffer);
      await fs.rename(tempPath, filePath);
      console.log(`   ✓ Saved National ID: ${filename} (${buffer.length} bytes)`);
      return hash;
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  } catch (error) {
    console.error(`   ❌ Error downloading image:`, error.message);
    return null;
  }
}

/**
 * Parse banking account field
 */
function parseBankingAccount(bankingText) {
  if (!bankingText || typeof bankingText !== 'string') {
    return { bankName: null, accountNumber: null };
  }

  const trimmed = bankingText.trim();

  const dashMatch = trimmed.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    return {
      bankName: dashMatch[1].trim(),
      accountNumber: dashMatch[2].trim()
    };
  }

  const colonMatch = trimmed.match(/^(.+?)\s*:\s*(.+)$/);
  if (colonMatch) {
    return {
      bankName: colonMatch[1].trim(),
      accountNumber: colonMatch[2].trim()
    };
  }

  if (/^\d+$/.test(trimmed)) {
    return {
      bankName: null,
      accountNumber: trimmed
    };
  }

  return {
    bankName: null,
    accountNumber: trimmed
  };
}

/**
 * Parse date string to ISO format (YYYY-MM-DD)
 */
function parseDate(dateString) {
  if (!dateString) return null;

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

/**
 * Fetch all staff records from Airtable
 */
async function fetchStaffFromAirtable() {
  console.log('📥 Fetching staff records from Airtable...\n');

  const records = [];
  let offset = null;

  do {
    const url = `https://api.airtable.com/v0/${AIRTABLE_SIP_N_PLAY_BASE_ID}/${AIRTABLE_STAFF_TABLE_ID}${
      offset ? `?offset=${offset}` : ''
    }`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.statusText}`);
    }

    const data = await response.json();
    records.push(...data.records);
    offset = data.offset;

    if (offset) {
      console.log(`   Fetched ${records.length} records so far...`);
    }
  } while (offset);

  console.log(`✓ Fetched ${records.length} total staff records from Airtable\n`);
  return records;
}

/**
 * Migrate a single staff record
 */
async function migrateStaffRecord(record, client) {
  const fields = record.fields;
  const staffId = record.id;
  const staffName = fields['Name'] || 'Unknown';

  try {
    console.log(`📝 Migrating: ${staffName} (${staffId})`);

    const bankingText = fields['Bank account'];
    const { bankName, accountNumber } = parseBankingAccount(bankingText);
    const dateOfHire = parseDate(fields['Date of Hire']);

    let nationalIdHash = null;
    const nationalIdAttachments = fields['National ID Card'];

    if (nationalIdAttachments && Array.isArray(nationalIdAttachments) && nationalIdAttachments.length > 0) {
      const firstAttachment = nationalIdAttachments[0];
      console.log(`   ⬇️  Downloading National ID image...`);
      nationalIdHash = await downloadAndSaveImage(firstAttachment.url, staffName);
    }

    const updateQuery = `
      UPDATE staff_list
      SET
        nickname = $1,
        contact_ph = $2,
        bank_account_number = $3,
        bank_name = $4,
        national_id_hash = $5,
        home_address = $6,
        emergency_contact_name = $7,
        emergency_contact_ph = $8,
        date_of_hire = $9,
        profile_updated_at = CURRENT_TIMESTAMP
      WHERE staff_id = $10
      RETURNING staff_name;
    `;

    const values = [
      fields['Nickname'] || null,
      fields['Contact Ph'] || null,
      accountNumber,
      bankName,
      nationalIdHash,
      fields['Home Address'] || null,
      fields['Emergency Contact Name'] || null,
      fields['Emergency Contact Ph No'] || null,
      dateOfHire,
      staffId
    ];

    const result = await client.query(updateQuery, values);

    if (result.rowCount === 0) {
      console.log(`   ⚠️  Staff member not found in database`);
      return { success: false, error: 'Staff member not found in database' };
    }

    console.log(`   ✅ Updated profile for ${staffName}`);
    return { success: true };

  } catch (error) {
    console.error(`   ❌ Error migrating ${staffName}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main migration function
 */
async function migrateStaffProfiles() {
  console.log('🚀 Staff Profile Data Migration - STAGING DATABASE');
  console.log('===================================================\n');
  console.log(`Database: shuttle.proxy.rlwy.net:38585`);
  console.log(`Airtable Base: ${AIRTABLE_SIP_N_PLAY_BASE_ID}`);
  console.log(`Staff IDs Directory: ${STAFF_IDS_DIR}\n`);

  const client = await pool.connect();

  try {
    await ensureDirectoryExists();

    // Fetch all staff from Airtable
    const airtableRecords = await fetchStaffFromAirtable();

    console.log('📋 Migrating staff profile data...\n');

    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const record of airtableRecords) {
      const result = await migrateStaffRecord(record, client);
      if (result.success) {
        results.successful++;
      } else {
        results.failed++;
        results.errors.push({
          name: record.fields['Name'] || 'Unknown',
          id: record.id,
          error: result.error
        });
      }
    }

    console.log('\n📊 Migration Summary');
    console.log('===================');
    console.log(`Total records: ${airtableRecords.length}`);
    console.log(`✅ Successful: ${results.successful}`);
    console.log(`❌ Failed: ${results.failed}`);

    if (results.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      results.errors.forEach(err => {
        console.log(`   - ${err.name} (${err.id}): ${err.error}`);
      });
    }

    // Verification
    const verifyResult = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(nickname) as with_nickname,
        COUNT(contact_ph) as with_contact,
        COUNT(bank_account_number) as with_bank,
        COUNT(national_id_hash) as with_national_id,
        COUNT(home_address) as with_home_address,
        COUNT(emergency_contact_name) as with_emergency,
        COUNT(date_of_hire) as with_hire_date,
        COUNT(profile_updated_at) as with_profile_update
      FROM staff_list
    `);

    console.log('\n🔍 Verification:');
    console.log(`   Total staff in database: ${verifyResult.rows[0].total}`);
    console.log(`   With nickname: ${verifyResult.rows[0].with_nickname}`);
    console.log(`   With contact phone: ${verifyResult.rows[0].with_contact}`);
    console.log(`   With bank account: ${verifyResult.rows[0].with_bank}`);
    console.log(`   With National ID: ${verifyResult.rows[0].with_national_id}`);
    console.log(`   With home address: ${verifyResult.rows[0].with_home_address}`);
    console.log(`   With emergency contact: ${verifyResult.rows[0].with_emergency}`);
    console.log(`   With date of hire: ${verifyResult.rows[0].with_hire_date}`);
    console.log(`   With profile update timestamp: ${verifyResult.rows[0].with_profile_update}`);

    console.log('\n✅ Migration complete!');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateStaffProfiles();

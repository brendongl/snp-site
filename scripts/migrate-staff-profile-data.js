const { Pool } = require('pg');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

// Environment variables
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_SIP_N_PLAY_BASE_ID = process.env.AIRTABLE_SIP_N_PLAY_BASE_ID || 'appjD3LJhXYjp0tXm';
const AIRTABLE_STAFF_TABLE_ID = process.env.AIRTABLE_STAFF_TABLE_ID || 'tblLthDOTzCPbSdAA';
const DATABASE_URL = process.env.DATABASE_URL;

// Persistent volume path for National ID images
const STAFF_IDS_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'staff-ids')
  : path.join(process.cwd(), 'data', 'staff-ids');

const pool = new Pool({ connectionString: DATABASE_URL });

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
 * Uses atomic write pattern (temp file -> rename)
 */
async function downloadAndSaveImage(imageUrl, staffName) {
  try {
    // Fetch image from Airtable
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Read image buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Calculate hash
    const hash = calculateHash(buffer);

    // Get file extension from URL or Content-Type
    const urlPath = new URL(imageUrl).pathname;
    let extension = path.extname(urlPath).toLowerCase();

    if (!extension || extension === '') {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('jpeg') || contentType?.includes('jpg')) {
        extension = '.jpg';
      } else if (contentType?.includes('png')) {
        extension = '.png';
      } else {
        extension = '.jpg'; // Default fallback
      }
    }

    const filename = `${hash}${extension}`;
    const filePath = path.join(STAFF_IDS_DIR, filename);

    // Check if file already exists
    try {
      await fs.access(filePath);
      console.log(`   ℹ  National ID already exists on disk: ${filename}`);
      return hash;
    } catch {
      // File doesn't exist, proceed with save
    }

    // Atomic write pattern: write to temp file, then rename
    const tempPath = path.join(STAFF_IDS_DIR, `${filename}.tmp`);

    try {
      await fs.writeFile(tempPath, buffer);
      await fs.rename(tempPath, filePath);
      console.log(`   ✓ Saved National ID: ${filename} (${buffer.length} bytes)`);
    } catch (error) {
      // Clean up temp file if rename fails
      try {
        await fs.unlink(tempPath);
      } catch {}
      throw error;
    }

    return hash;
  } catch (error) {
    console.error(`   ❌ Failed to download National ID for ${staffName}:`, error.message);
    return null;
  }
}

/**
 * Parse banking account field
 * Format might be: "Bank Name - Account Number" or "Account Number" or just free text
 */
function parseBankingAccount(bankingText) {
  if (!bankingText || typeof bankingText !== 'string') {
    return { bankName: null, accountNumber: null };
  }

  const trimmed = bankingText.trim();

  // Try to detect pattern: "Bank Name - Account Number"
  const dashMatch = trimmed.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    return {
      bankName: dashMatch[1].trim(),
      accountNumber: dashMatch[2].trim()
    };
  }

  // Try to detect pattern: "Bank Name: Account Number"
  const colonMatch = trimmed.match(/^(.+?)\s*:\s*(.+)$/);
  if (colonMatch) {
    return {
      bankName: colonMatch[1].trim(),
      accountNumber: colonMatch[2].trim()
    };
  }

  // If text looks like only numbers/digits, assume it's account number
  if (/^\d+$/.test(trimmed)) {
    return {
      bankName: null,
      accountNumber: trimmed
    };
  }

  // Otherwise, store entire text as account number (safest fallback)
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
    // Airtable returns dates in ISO format already
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;

    return date.toISOString().split('T')[0]; // YYYY-MM-DD
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
      throw new Error(`Airtable API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    records.push(...data.records);
    offset = data.offset;

    console.log(`   Fetched ${records.length} records so far...`);
  } while (offset);

  console.log(`✓ Fetched ${records.length} total staff records from Airtable\n`);
  return records;
}

/**
 * Migrate a single staff member's profile data
 */
async function migrateStaffProfile(client, record) {
  const fields = record.fields;
  const staffId = record.id;
  const staffName = fields['Name'] || 'Unknown';

  try {
    console.log(`📝 Migrating: ${staffName} (${staffId})`);

    // Parse banking account
    const bankingText = fields['Bank account'];
    const { bankName, accountNumber } = parseBankingAccount(bankingText);

    // Parse date of hire
    const dateOfHire = parseDate(fields['Date of Hire']);

    // Handle National ID image download
    let nationalIdHash = null;
    const nationalIdAttachments = fields['National ID Card'];

    if (nationalIdAttachments && Array.isArray(nationalIdAttachments) && nationalIdAttachments.length > 0) {
      const firstAttachment = nationalIdAttachments[0];
      console.log(`   ⬇️  Downloading National ID image...`);
      nationalIdHash = await downloadAndSaveImage(firstAttachment.url, staffName);
    }

    // Update database record
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
      console.log(`   ⚠️  Staff member not found in database (may need to run sync first)`);
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
  console.log('🚀 Staff Profile Data Migration');
  console.log('================================\n');
  console.log(`Database: ${DATABASE_URL?.split('@')[1] || 'local'}`);
  console.log(`Airtable Base: ${AIRTABLE_SIP_N_PLAY_BASE_ID}`);
  console.log(`Staff IDs Directory: ${STAFF_IDS_DIR}\n`);

  const client = await pool.connect();
  const results = {
    total: 0,
    success: 0,
    failed: 0,
    errors: []
  };

  try {
    // Step 1: Ensure staff-ids directory exists
    await ensureDirectoryExists();

    // Step 2: Fetch staff from Airtable
    const staffRecords = await fetchStaffFromAirtable();
    results.total = staffRecords.length;

    if (staffRecords.length === 0) {
      console.log('⚠️  No staff records found in Airtable. Nothing to migrate.');
      return;
    }

    // Step 3: Verify staff_list table has the new columns
    console.log('🔍 Verifying database schema...\n');
    const schemaCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'staff_list'
      AND column_name IN (
        'nickname', 'contact_ph', 'bank_account_number', 'bank_name',
        'national_id_hash', 'home_address', 'emergency_contact_name',
        'emergency_contact_ph', 'date_of_hire', 'profile_updated_at'
      )
    `);

    const foundColumns = schemaCheck.rows.map(r => r.column_name);
    const requiredColumns = [
      'nickname', 'contact_ph', 'bank_account_number', 'bank_name',
      'national_id_hash', 'home_address', 'emergency_contact_name',
      'emergency_contact_ph', 'date_of_hire', 'profile_updated_at'
    ];

    const missingColumns = requiredColumns.filter(col => !foundColumns.includes(col));

    if (missingColumns.length > 0) {
      console.error('❌ Missing required columns in staff_list table:');
      missingColumns.forEach(col => console.error(`   - ${col}`));
      console.error('\n⚠️  Please run: node scripts/add-staff-profile-columns.js\n');
      process.exit(1);
    }

    console.log('✓ Database schema verified\n');

    // Step 4: Migrate each staff member
    console.log('📋 Migrating staff profile data...\n');

    for (const record of staffRecords) {
      const result = await migrateStaffProfile(client, record);

      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push({
          name: record.fields['Name'] || 'Unknown',
          id: record.id,
          error: result.error
        });
      }

      console.log(''); // Blank line between staff members
    }

    // Step 5: Summary
    console.log('\n📊 Migration Summary');
    console.log('===================');
    console.log(`Total records: ${results.total}`);
    console.log(`✅ Successful: ${results.success}`);
    console.log(`❌ Failed: ${results.failed}`);

    if (results.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      results.errors.forEach(err => {
        console.log(`   - ${err.name} (${err.id}): ${err.error}`);
      });
    }

    // Step 6: Verify results
    console.log('\n🔍 Verification:');
    const verifyQuery = await client.query(`
      SELECT
        COUNT(*) as total_staff,
        COUNT(nickname) as with_nickname,
        COUNT(contact_ph) as with_contact_ph,
        COUNT(bank_account_number) as with_bank_account,
        COUNT(national_id_hash) as with_national_id,
        COUNT(home_address) as with_home_address,
        COUNT(emergency_contact_name) as with_emergency_contact,
        COUNT(date_of_hire) as with_date_of_hire,
        COUNT(profile_updated_at) as with_profile_update
      FROM staff_list;
    `);

    const stats = verifyQuery.rows[0];
    console.log(`   Total staff in database: ${stats.total_staff}`);
    console.log(`   With nickname: ${stats.with_nickname}`);
    console.log(`   With contact phone: ${stats.with_contact_ph}`);
    console.log(`   With bank account: ${stats.with_bank_account}`);
    console.log(`   With National ID: ${stats.with_national_id}`);
    console.log(`   With home address: ${stats.with_home_address}`);
    console.log(`   With emergency contact: ${stats.with_emergency_contact}`);
    console.log(`   With date of hire: ${stats.with_date_of_hire}`);
    console.log(`   With profile update timestamp: ${stats.with_profile_update}`);

    console.log('\n✅ Migration complete!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
migrateStaffProfiles().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

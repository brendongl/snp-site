const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Hire dates mapping - input data
const hireDates = [
  { inputName: 'Vu Thinh Van Hoang', date: '2025-03-13' },
  { inputName: 'Thọ Nguyễn Phước', date: '2025-02-08' },
  { inputName: 'Sơn Nguyễn Thế', date: '2024-09-15' },
  { inputName: 'Phong Chu', date: '2024-06-20' },
  { inputName: 'Nhi Nguyen', date: '2024-06-27' },
  { inputName: 'Minh Đặng Nhật', date: '2024-01-07' },
  { inputName: 'Long Hoang Quang Phi', date: '2025-02-02' },
  { inputName: 'Le Huy', date: '2024-07-31' },
  { inputName: 'Hieu Nguyễn', date: '2023-05-15' },
  { inputName: 'Chase Thanh Phong Nguyễn', date: '2025-08-20' },
  { inputName: 'An Pham', date: '2025-09-28' },
  { inputName: 'Brendon', date: '2023-09-01' },
  { inputName: 'Ivy', date: '2023-09-01' },
];

/**
 * Normalize a name for fuzzy matching
 * - Remove diacritics
 * - Convert to lowercase
 * - Remove extra spaces
 */
function normalizeName(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // Normalize spaces
}

/**
 * Calculate simple similarity score between two names
 * Returns a score between 0 and 1 (1 = perfect match)
 */
function calculateSimilarity(name1, name2) {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);

  // Exact match
  if (norm1 === norm2) return 1.0;

  // Check if one is contained in the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return 0.9;
  }

  // Split into words and check overlap
  const words1 = new Set(norm1.split(' '));
  const words2 = new Set(norm2.split(' '));

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  // Jaccard similarity
  return intersection.size / union.size;
}

/**
 * Find the best match for a name in the staff list
 */
function findBestMatch(inputName, staffList) {
  let bestMatch = null;
  let bestScore = 0;

  for (const staff of staffList) {
    // Check against both staff_name and nickname
    const nameScore = calculateSimilarity(inputName, staff.staff_name);
    const nicknameScore = staff.nickname
      ? calculateSimilarity(inputName, staff.nickname)
      : 0;

    const score = Math.max(nameScore, nicknameScore);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        staff_id: staff.staff_id,
        staff_name: staff.staff_name,
        nickname: staff.nickname,
        matchScore: score,
        matchedAgainst: nameScore > nicknameScore ? 'name' : 'nickname'
      };
    }
  }

  return bestMatch;
}

async function updateHireDates() {
  const client = await pool.connect();

  try {
    console.log('🔍 Fetching current staff list...\n');

    // Get all staff members
    const staffResult = await client.query(`
      SELECT staff_id, staff_name, nickname, date_of_hire
      FROM staff_list
      ORDER BY staff_name
    `);

    const staffList = staffResult.rows;
    console.log(`Found ${staffList.length} staff members in database\n`);

    console.log('📋 Current staff:');
    staffList.forEach(staff => {
      const hireDate = staff.date_of_hire || 'Not set';
      const nickname = staff.nickname ? ` (${staff.nickname})` : '';
      console.log(`   - ${staff.staff_name}${nickname} - Hire date: ${hireDate}`);
    });
    console.log();

    // Match input names with database names
    console.log('🔗 Matching names and preparing updates...\n');

    const updates = [];
    const unmatched = [];

    for (const hire of hireDates) {
      const match = findBestMatch(hire.inputName, staffList);

      if (match && match.matchScore >= 0.5) {
        updates.push({
          inputName: hire.inputName,
          dbName: match.staff_name,
          nickname: match.nickname,
          staffId: match.staff_id,
          date: hire.date,
          matchScore: match.matchScore,
          matchedAgainst: match.matchedAgainst
        });

        const confidence = match.matchScore === 1.0 ? 'EXACT' :
                          match.matchScore >= 0.8 ? 'HIGH' : 'MEDIUM';
        console.log(`   ✓ "${hire.inputName}" → "${match.staff_name}" (${confidence} - ${match.matchedAgainst})`);
        console.log(`     Will set hire date to: ${hire.date}`);
      } else {
        unmatched.push(hire.inputName);
        console.log(`   ✗ "${hire.inputName}" - No good match found (best score: ${match ? match.matchScore.toFixed(2) : 'N/A'})`);
      }
    }

    console.log();

    if (unmatched.length > 0) {
      console.log('⚠️  WARNING: The following names could not be matched:');
      unmatched.forEach(name => console.log(`   - ${name}`));
      console.log();
    }

    if (updates.length === 0) {
      console.log('❌ No updates to perform. Exiting.');
      return;
    }

    console.log(`\n📝 Ready to update ${updates.length} hire dates.\n`);
    console.log('Press Ctrl+C to cancel, or any key to continue...');

    // Wait for user confirmation (in non-interactive mode, this will just continue)
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n🚀 Updating hire dates...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const update of updates) {
      try {
        await client.query(
          `UPDATE staff_list
           SET date_of_hire = $1, updated_at = CURRENT_TIMESTAMP
           WHERE staff_id = $2`,
          [update.date, update.staffId]
        );

        console.log(`   ✅ Updated ${update.dbName} → ${update.date}`);
        successCount++;
      } catch (error) {
        console.error(`   ❌ Failed to update ${update.dbName}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Update Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   ⚠️  Unmatched: ${unmatched.length}`);

    // Show final state
    console.log('\n📋 Final hire dates:');
    const finalResult = await client.query(`
      SELECT staff_name, nickname, date_of_hire
      FROM staff_list
      WHERE date_of_hire IS NOT NULL
      ORDER BY date_of_hire DESC
    `);

    finalResult.rows.forEach(staff => {
      const nickname = staff.nickname ? ` (${staff.nickname})` : '';
      console.log(`   - ${staff.staff_name}${nickname}: ${staff.date_of_hire}`);
    });

    console.log('\n✅ Done!');

  } catch (error) {
    console.error('❌ Error updating hire dates:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
updateHireDates().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

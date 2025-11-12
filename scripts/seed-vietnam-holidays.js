/**
 * Seed Script: Vietnam Public Holidays 2025
 * Version: 2.0.0
 * Phase 1: Database Setup
 *
 * Seeds the roster_holidays table with Vietnamese public holidays for 2025.
 * Pay multipliers: 2x for regular holidays, 3x for Tết (Lunar New Year)
 *
 * Run: node scripts/seed-vietnam-holidays.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

const VIETNAM_HOLIDAYS_2025 = [
  {
    name: 'Tết Nguyên Đán (Lunar New Year)',
    startDate: '2025-01-28',
    endDate: '2025-02-03',
    multiplier: 3.0
  },
  {
    name: 'Hung Kings\' Commemoration Day',
    startDate: '2025-04-18',
    endDate: '2025-04-18',
    multiplier: 2.0
  },
  {
    name: 'Reunification Day',
    startDate: '2025-04-30',
    endDate: '2025-04-30',
    multiplier: 2.0
  },
  {
    name: 'International Labor Day',
    startDate: '2025-05-01',
    endDate: '2025-05-01',
    multiplier: 2.0
  },
  {
    name: 'National Day',
    startDate: '2025-09-02',
    endDate: '2025-09-02',
    multiplier: 2.0
  }
];

async function seedHolidays() {
  const client = await pool.connect();

  try {
    console.log('🎉 Seeding Vietnam holidays for 2025...\n');

    await client.query('BEGIN');

    // Clear existing 2025 holidays (in case of re-run)
    const deleteResult = await client.query(`
      DELETE FROM roster_holidays
      WHERE start_date >= '2025-01-01' AND end_date <= '2025-12-31'
    `);

    if (deleteResult.rowCount > 0) {
      console.log(`🗑️  Removed ${deleteResult.rowCount} existing 2025 holidays\n`);
    }

    // Insert holidays
    for (const holiday of VIETNAM_HOLIDAYS_2025) {
      await client.query(`
        INSERT INTO roster_holidays (holiday_name, start_date, end_date, pay_multiplier)
        VALUES ($1, $2, $3, $4)
      `, [holiday.name, holiday.startDate, holiday.endDate, holiday.multiplier]);

      const days = Math.floor((new Date(holiday.endDate) - new Date(holiday.startDate)) / (1000 * 60 * 60 * 24)) + 1;
      console.log(`✅ ${holiday.name}`);
      console.log(`   Date: ${holiday.startDate}${days > 1 ? ` to ${holiday.endDate}` : ''} (${days} day${days > 1 ? 's' : ''})`);
      console.log(`   Pay: ${holiday.multiplier}x multiplier\n`);
    }

    await client.query('COMMIT');

    console.log('✨ Seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   • Total holidays: ${VIETNAM_HOLIDAYS_2025.length}`);
    console.log(`   • Total days: ${VIETNAM_HOLIDAYS_2025.reduce((sum, h) => {
      const days = Math.floor((new Date(h.endDate) - new Date(h.startDate)) / (1000 * 60 * 60 * 24)) + 1;
      return sum + days;
    }, 0)}`);
    console.log(`   • 3x multiplier: Tết (7 days)`);
    console.log(`   • 2x multiplier: Other holidays (4 days)`);
    console.log('\n💡 Note: For 2026 holidays, create a new seed script or update via /admin/roster/holidays\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run seeding
seedHolidays()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  });

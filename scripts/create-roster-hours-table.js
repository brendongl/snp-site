/**
 * Create roster_hours table for daily open/close times
 *
 * Stores the required opening and closing times for each day of the week.
 * These are HARD constraints - shifts MUST begin at or after open_time
 * and MUST end at or before close_time.
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createTable() {
  try {
    console.log('🔧 Creating roster_hours table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS roster_hours (
        id SERIAL PRIMARY KEY,
        day_of_week TEXT NOT NULL CHECK (
          day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
        ),
        open_time TIME NOT NULL,
        close_time TIME NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(day_of_week)
      )
    `);
    console.log('✅ Created roster_hours table');

    // Insert default hours for all days (12pm - midnight)
    const defaultHours = [
      { day: 'Monday', open: '12:00', close: '00:00' },
      { day: 'Tuesday', open: '12:00', close: '00:00' },
      { day: 'Wednesday', open: '12:00', close: '00:00' },
      { day: 'Thursday', open: '12:00', close: '00:00' },
      { day: 'Friday', open: '09:00', close: '00:00' },
      { day: 'Saturday', open: '09:00', close: '00:00' },
      { day: 'Sunday', open: '09:00', close: '00:00' },
    ];

    console.log('📋 Inserting default hours...');
    for (const { day, open, close } of defaultHours) {
      await pool.query(`
        INSERT INTO roster_hours (day_of_week, open_time, close_time, is_active)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (day_of_week) DO NOTHING
      `, [day, open, close]);
      console.log(`   ✅ ${day}: ${open} - ${close}`);
    }

    await pool.end();
    console.log('\n✨ Table creation complete!');
    console.log('📌 Usage:');
    console.log('   - Shifts MUST begin at or after open_time');
    console.log('   - Shifts MUST end at or before close_time');
    console.log('   - Set is_active=false to disable enforcement for a day');

  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

createTable();

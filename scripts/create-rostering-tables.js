/**
 * Migration Script: Create Rostering System Tables
 * Version: 2.0.0
 * Phase 1: Database Schema Setup
 *
 * Creates all tables and indexes required for the AI-powered rostering system:
 * - Adds columns to staff_list
 * - Creates 9 new tables for rostering functionality
 * - Sets up all necessary indexes for performance
 *
 * Run: node scripts/create-rostering-tables.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function createRosteringTables() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting rostering system database migration...\n');

    // Start transaction
    await client.query('BEGIN');

    // ========================================
    // 1. Add columns to staff_list
    // ========================================
    console.log('📝 Step 1: Adding columns to staff_list...');

    await client.query(`
      ALTER TABLE staff_list
      ADD COLUMN IF NOT EXISTS base_hourly_rate INTEGER,
      ADD COLUMN IF NOT EXISTS discord_username TEXT,
      ADD COLUMN IF NOT EXISTS has_keys BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS available_roles TEXT[]
    `);

    console.log('   ✅ Added: base_hourly_rate, discord_username, has_keys, available_roles\n');

    // ========================================
    // 2. Create roster_shifts table
    // ========================================
    console.log('📝 Step 2: Creating roster_shifts table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS roster_shifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        roster_week_start DATE NOT NULL,
        day_of_week TEXT NOT NULL,
        shift_type TEXT NOT NULL,
        staff_id UUID REFERENCES staff_list(id),
        scheduled_start TIME NOT NULL,
        scheduled_end TIME NOT NULL,
        role_required TEXT NOT NULL,
        shift_notes TEXT,
        clock_in_reminder TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT valid_shift_type CHECK (shift_type IN ('opening', 'day', 'evening', 'closing')),
        CONSTRAINT valid_day_of_week CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'))
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_roster_shifts_week ON roster_shifts(roster_week_start)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_roster_shifts_staff ON roster_shifts(staff_id)
    `);

    console.log('   ✅ Created roster_shifts with 2 indexes\n');

    // ========================================
    // 3. Create staff_availability table
    // ========================================
    console.log('📝 Step 3: Creating staff_availability table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_availability (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        staff_id UUID REFERENCES staff_list(id),
        day_of_week TEXT NOT NULL,
        hour_start INTEGER NOT NULL,
        hour_end INTEGER NOT NULL,
        availability_status TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT valid_day_of_week CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
        CONSTRAINT valid_availability_status CHECK (availability_status IN ('available', 'preferred_not', 'unavailable')),
        CONSTRAINT valid_hours CHECK (hour_start >= 0 AND hour_start <= 23 AND hour_end >= 0 AND hour_end <= 23),
        UNIQUE(staff_id, day_of_week, hour_start, hour_end)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_availability_lookup ON staff_availability(staff_id, day_of_week)
    `);

    console.log('   ✅ Created staff_availability with 1 index\n');

    // ========================================
    // 4. Create roster_rules table
    // ========================================
    console.log('📝 Step 4: Creating roster_rules table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS roster_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rule_text TEXT NOT NULL,
        parsed_constraint JSONB NOT NULL,
        weight INTEGER NOT NULL CHECK (weight >= 0 AND weight <= 100),
        is_active BOOLEAN DEFAULT true,
        expires_at DATE,
        created_by UUID REFERENCES staff_list(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_roster_rules_active ON roster_rules(is_active, expires_at)
    `);

    console.log('   ✅ Created roster_rules with 1 index\n');

    // ========================================
    // 5. Create clock_records table
    // ========================================
    console.log('📝 Step 5: Creating clock_records table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS clock_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        staff_id UUID REFERENCES staff_list(id) NOT NULL,
        shift_id UUID REFERENCES roster_shifts(id),
        clock_in_time TIMESTAMP NOT NULL,
        clock_out_time TIMESTAMP,
        clock_in_location JSONB,
        clock_out_location JSONB,
        rostered_start TIME,
        rostered_end TIME,
        variance_reason TEXT,
        requires_approval BOOLEAN DEFAULT false,
        approved_by UUID REFERENCES staff_list(id),
        approved_at TIMESTAMP,
        approved_hours DECIMAL(5,2),
        points_awarded INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_clock_records_staff_date ON clock_records(staff_id, clock_in_time)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_clock_records_approval ON clock_records(requires_approval, approved_by)
    `);

    console.log('   ✅ Created clock_records with 2 indexes\n');

    // ========================================
    // 6. Create shift_swaps table
    // ========================================
    console.log('📝 Step 6: Creating shift_swaps table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS shift_swaps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shift_id UUID REFERENCES roster_shifts(id) NOT NULL,
        requesting_staff_id UUID REFERENCES staff_list(id) NOT NULL,
        target_staff_id UUID REFERENCES staff_list(id) NOT NULL,
        status TEXT NOT NULL,
        reason TEXT,
        requested_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP,
        resolved_by UUID REFERENCES staff_list(id),
        notes TEXT,
        CONSTRAINT valid_swap_status CHECK (status IN ('pending', 'auto_approved', 'admin_approved', 'vetoed'))
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_shift_swaps_status ON shift_swaps(status)
    `);

    console.log('   ✅ Created shift_swaps with 1 index\n');

    // ========================================
    // 7. Create roster_notifications table
    // ========================================
    console.log('📝 Step 7: Creating roster_notifications table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS roster_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        notification_type TEXT NOT NULL,
        staff_id UUID REFERENCES staff_list(id),
        related_record_id UUID,
        message TEXT NOT NULL,
        severity TEXT NOT NULL,
        is_cleared BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        cleared_at TIMESTAMP,
        CONSTRAINT valid_notification_type CHECK (notification_type IN ('late_clock_in', 'shift_swap', 'hour_adjustment', 'missing_clock_out', 'rule_expired', 'unscheduled_clock_in', 'availability_conflict')),
        CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'requires_action'))
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_roster_notifications_active ON roster_notifications(is_cleared, created_at)
    `);

    console.log('   ✅ Created roster_notifications with 1 index\n');

    // ========================================
    // 8. Create roster_holidays table
    // ========================================
    console.log('📝 Step 8: Creating roster_holidays table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS roster_holidays (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        holiday_name TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        pay_multiplier DECIMAL(3,1) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT valid_multiplier CHECK (pay_multiplier IN (2.0, 3.0))
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_roster_holidays_dates ON roster_holidays(start_date, end_date)
    `);

    console.log('   ✅ Created roster_holidays with 1 index\n');

    // ========================================
    // 9. Create pay_adjustments table
    // ========================================
    console.log('📝 Step 9: Creating pay_adjustments table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS pay_adjustments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        staff_id UUID REFERENCES staff_list(id) NOT NULL,
        adjustment_date DATE NOT NULL,
        adjustment_type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        reason TEXT NOT NULL,
        created_by UUID REFERENCES staff_list(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT valid_adjustment_type CHECK (adjustment_type IN ('commission', 'bonus', 'deduction'))
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pay_adjustments_staff_date ON pay_adjustments(staff_id, adjustment_date)
    `);

    console.log('   ✅ Created pay_adjustments with 1 index\n');

    // ========================================
    // 10. Create store_notifications table
    // ========================================
    console.log('📝 Step 10: Creating store_notifications table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS store_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        notification_text TEXT NOT NULL,
        target_staff TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES staff_list(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT valid_target CHECK (target_staff IN ('all_staff', 'specific_staff'))
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_store_notifications_active ON store_notifications(is_active, start_date, end_date)
    `);

    console.log('   ✅ Created store_notifications with 1 index\n');

    // Commit transaction
    await client.query('COMMIT');

    console.log('✨ Migration completed successfully!\n');
    console.log('📊 Summary:');
    console.log('   • Modified: staff_list (4 new columns)');
    console.log('   • Created: 9 new tables');
    console.log('   • Created: 11 indexes');
    console.log('\n🎯 Next steps:');
    console.log('   1. Run: node scripts/seed-vietnam-holidays.js');
    console.log('   2. Update staff hourly rates via /admin/roster/staff-config');
    console.log('   3. Staff members mark their availability');
    console.log('   4. Generate first roster!\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    console.error('\n🔄 All changes have been rolled back.');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
createRosteringTables()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  });

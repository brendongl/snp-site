/**
 * Create Roster Management Tables
 * Phase 3: Admin UI Database Schema
 *
 * Creates:
 * - shift_requirement_templates: Reusable shift requirement sets
 * - roster_metadata: Generated roster tracking
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createTables() {
  const client = await pool.connect();

  try {
    console.log('🗄️  Creating roster management tables...\n');

    // Table 1: Shift Requirement Templates
    console.log('Creating shift_requirement_templates table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS shift_requirement_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_name TEXT NOT NULL,
        description TEXT,
        requirements JSONB NOT NULL,
        created_by UUID REFERENCES staff_list(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(template_name)
      );
    `);
    console.log('✅ shift_requirement_templates created\n');

    // Table 2: Roster Metadata
    console.log('Creating roster_metadata table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS roster_metadata (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        roster_week_start DATE NOT NULL,
        generated_at TIMESTAMP DEFAULT NOW(),
        generated_by UUID REFERENCES staff_list(id),
        solution_score NUMERIC,
        is_valid BOOLEAN DEFAULT false,
        violations JSONB,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(roster_week_start)
      );
    `);
    console.log('✅ roster_metadata created\n');

    // Create indexes
    console.log('Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_roster_metadata_week_start
      ON roster_metadata(roster_week_start);

      CREATE INDEX IF NOT EXISTS idx_shift_requirement_templates_name
      ON shift_requirement_templates(template_name);
    `);
    console.log('✅ Indexes created\n');

    // Insert default template
    console.log('Inserting default shift requirements template...');
    await client.query(`
      INSERT INTO shift_requirement_templates (
        template_name,
        description,
        requirements
      ) VALUES (
        'Default 4-Shift Pattern',
        'Standard opening, day, evening, and closing shifts for all days',
        $1::jsonb
      )
      ON CONFLICT (template_name) DO NOTHING
    `, [JSON.stringify({
      Monday: [
        { shift_type: 'opening', start: '12:00', end: '17:00', role: 'cafe', min_staff: 1, max_staff: 1, requires_keys: true },
        { shift_type: 'day', start: '14:00', end: '18:00', role: 'floor', min_staff: 1, max_staff: 1, requires_keys: false },
        { shift_type: 'evening', start: '18:00', end: '22:00', role: 'floor', min_staff: 1, max_staff: 1, requires_keys: false },
        { shift_type: 'closing', start: '22:00', end: '23:00', role: 'cafe', min_staff: 1, max_staff: 1, requires_keys: true }
      ],
      Tuesday: [
        { shift_type: 'opening', start: '12:30', end: '17:30', role: 'cafe', min_staff: 1, max_staff: 1, requires_keys: true },
        { shift_type: 'day', start: '14:00', end: '18:00', role: 'floor', min_staff: 1, max_staff: 1, requires_keys: false },
        { shift_type: 'evening', start: '18:00', end: '22:00', role: 'floor', min_staff: 1, max_staff: 1, requires_keys: false },
        { shift_type: 'closing', start: '22:00', end: '23:00', role: 'cafe', min_staff: 1, max_staff: 1, requires_keys: true }
      ],
      Wednesday: [
        { shift_type: 'opening', start: '12:00', end: '17:00', role: 'cafe', min_staff: 1, max_staff: 1, requires_keys: true },
        { shift_type: 'day', start: '14:00', end: '18:00', role: 'floor', min_staff: 1, max_staff: 1, requires_keys: false },
        { shift_type: 'evening', start: '18:00', end: '22:00', role: 'floor', min_staff: 1, max_staff: 1, requires_keys: false },
        { shift_type: 'closing', start: '22:00', end: '23:00', role: 'cafe', min_staff: 1, max_staff: 1, requires_keys: true }
      ],
      Thursday: [
        { shift_type: 'opening', start: '12:30', end: '17:30', role: 'cafe', min_staff: 1, max_staff: 1, requires_keys: true },
        { shift_type: 'day', start: '14:00', end: '18:00', role: 'floor', min_staff: 1, max_staff: 1, requires_keys: false },
        { shift_type: 'evening', start: '18:00', end: '22:00', role: 'floor', min_staff: 1, max_staff: 1, requires_keys: false },
        { shift_type: 'closing', start: '22:00', end: '23:00', role: 'cafe', min_staff: 1, max_staff: 1, requires_keys: true }
      ],
      Friday: [
        { shift_type: 'opening', start: '09:00', end: '14:00', role: 'cafe', min_staff: 1, max_staff: 1, requires_keys: true },
        { shift_type: 'day', start: '14:00', end: '18:00', role: 'floor', min_staff: 1, max_staff: 1, requires_keys: false },
        { shift_type: 'evening', start: '18:00', end: '22:00', role: 'floor', min_staff: 1, max_staff: 1, requires_keys: false },
        { shift_type: 'closing', start: '22:00', end: '23:00', role: 'cafe', min_staff: 1, max_staff: 1, requires_keys: true }
      ],
      Saturday: [
        { shift_type: 'opening', start: '09:00', end: '14:00', role: 'cafe', min_staff: 1, max_staff: 1, requires_keys: true },
        { shift_type: 'day', start: '14:00', end: '18:00', role: 'floor', min_staff: 1, max_staff: 1, requires_keys: false },
        { shift_type: 'evening', start: '18:00', end: '22:00', role: 'floor', min_staff: 1, max_staff: 1, requires_keys: false },
        { shift_type: 'closing', start: '22:00', end: '23:00', role: 'cafe', min_staff: 1, max_staff: 1, requires_keys: true }
      ],
      Sunday: [
        { shift_type: 'opening', start: '09:00', end: '14:00', role: 'cafe', min_staff: 1, max_staff: 1, requires_keys: true },
        { shift_type: 'day', start: '14:00', end: '18:00', role: 'floor', min_staff: 1, max_staff: 1, requires_keys: false },
        { shift_type: 'evening', start: '18:00', end: '22:00', role: 'floor', min_staff: 1, max_staff: 1, requires_keys: false },
        { shift_type: 'closing', start: '22:00', end: '23:00', role: 'cafe', min_staff: 1, max_staff: 1, requires_keys: true }
      ]
    })]);
    console.log('✅ Default template inserted\n');

    console.log('📊 Table Summary:');
    console.log('  ✅ shift_requirement_templates - Store reusable shift patterns');
    console.log('  ✅ roster_metadata - Track generated rosters');
    console.log('');
    console.log('🎉 Roster management schema created successfully!');

  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

createTables();

/**
 * Create roster_approvals table for shift swaps and hour adjustments
 * Run: node scripts/create-approvals-table.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createApprovalsTable() {
  const client = await pool.connect();

  try {
    console.log('Creating roster_approvals table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS roster_approvals (
        id SERIAL PRIMARY KEY,
        request_type VARCHAR(50) NOT NULL, -- 'shift_swap', 'hour_adjustment', 'time_off'
        requested_by UUID NOT NULL REFERENCES staff_list(id),
        shift_id UUID REFERENCES roster_shifts(id),
        original_data JSONB, -- Original shift data
        requested_data JSONB, -- Requested changes
        reason TEXT,
        status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
        reviewed_by UUID REFERENCES staff_list(id),
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ roster_approvals table created');

    // Create indexes for performance
    console.log('Creating indexes...');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_approvals_status ON roster_approvals(status);
      CREATE INDEX IF NOT EXISTS idx_approvals_requested_by ON roster_approvals(requested_by);
      CREATE INDEX IF NOT EXISTS idx_approvals_shift_id ON roster_approvals(shift_id);
      CREATE INDEX IF NOT EXISTS idx_approvals_created_at ON roster_approvals(created_at DESC);
    `);

    console.log('✅ Indexes created');

    // Check table structure
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'roster_approvals'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Table structure:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name} (${row.data_type}) ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${row.column_default || ''}`);
    });

    console.log('\n🎉 roster_approvals table setup complete!');

  } catch (error) {
    console.error('❌ Error creating roster_approvals table:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createApprovalsTable().catch(console.error);

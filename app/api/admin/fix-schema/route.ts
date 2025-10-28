/**
 * API Endpoint: Fix Database Schema
 *
 * Adds missing check_type column to content_checks table
 * This is a one-time migration endpoint
 */

import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function POST() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('🔧 Adding check_type column to content_checks table...');

    // Add column with default value
    await pool.query(`
      ALTER TABLE content_checks
      ADD COLUMN IF NOT EXISTS check_type VARCHAR(50) DEFAULT 'regular';
    `);

    // Update existing records to have 'regular' type
    const updateResult = await pool.query(`
      UPDATE content_checks
      SET check_type = 'regular'
      WHERE check_type IS NULL;
    `);

    // Verify
    const verifyResult = await pool.query(`
      SELECT COUNT(*) as total_checks, COUNT(check_type) as checks_with_type
      FROM content_checks;
    `);

    console.log('✅ check_type column added successfully');
    console.log('✅ Updated', updateResult.rowCount, 'existing records');

    return NextResponse.json({
      success: true,
      message: 'Database schema fixed successfully',
      updatedRows: updateResult.rowCount,
      verification: verifyResult.rows[0]
    });

  } catch (error) {
    console.error('❌ Error fixing database schema:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fix database schema',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await pool.end();
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/admin/fix-schema',
    usage: 'POST to this endpoint to add check_type column to content_checks table',
    description: 'One-time migration to fix database schema'
  });
}

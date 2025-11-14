/**
 * Staff Configuration API
 * Manage staff pay rates, roles, and permissions
 *
 * GET    /api/admin/staff-config    - List all staff with configuration
 * PUT    /api/admin/staff-config    - Update staff configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/postgres';

/**
 * GET /api/admin/staff-config
 * List all staff members with their configuration
 */
export async function GET(request: NextRequest) {
  try {
    const result = await pool.query(`
      SELECT
        id,
        staff_name,
        nickname,
        staff_email,
        staff_type,
        base_hourly_rate,
        has_keys,
        available_roles,
        date_of_hire,
        created_at,
        updated_at
      FROM staff_list
      ORDER BY staff_name
    `);

    return NextResponse.json({
      success: true,
      staff: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Error fetching staff configuration:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch staff configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/staff-config
 * Update staff member configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { staff_id, updates } = body;

    if (!staff_id) {
      return NextResponse.json(
        { error: 'staff_id is required' },
        { status: 400 }
      );
    }

    // Allowed fields to update
    const allowedFields = [
      'base_hourly_rate',
      'has_keys',
      'available_roles',
      'staff_type'
    ];

    const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'No valid update fields provided' },
        { status: 400 }
      );
    }

    // Build dynamic UPDATE query
    const setClauses = updateFields.map((field, index) => `${field} = $${index + 2}`);
    const query = `
      UPDATE staff_list
      SET ${setClauses.join(', ')}, updated_at = NOW()
      WHERE id = $1
      RETURNING id, staff_name, nickname, base_hourly_rate, has_keys, available_roles, staff_type
    `;

    const params = [staff_id, ...updateFields.map(field => updates[field])];
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      staff: result.rows[0],
      message: 'Staff configuration updated successfully'
    });

  } catch (error) {
    console.error('Error updating staff configuration:', error);
    return NextResponse.json(
      {
        error: 'Failed to update staff configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

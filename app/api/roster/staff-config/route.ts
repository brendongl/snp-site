/**
 * Staff Payroll Configuration API
 * GET /api/roster/staff-config - Fetch all staff with pay rates
 * PUT /api/roster/staff-config - Update staff pay rates and roles
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/postgres';

export async function GET(request: NextRequest) {
  try {
    const result = await pool.query(`
      SELECT
        id,
        staff_name,
        nickname,
        base_hourly_rate,
        weekend_multiplier,
        holiday_multiplier,
        overtime_multiplier,
        available_roles,
        has_keys,
        is_active
      FROM staff_list
      WHERE is_active = true
      ORDER BY staff_name
    `);

    const staffConfig = result.rows.map((row: any) => ({
      id: row.id,
      staff_name: row.staff_name,
      nickname: row.nickname,
      base_hourly_rate: row.base_hourly_rate,
      weekend_multiplier: row.weekend_multiplier || 1.0,
      holiday_multiplier: row.holiday_multiplier || 1.0,
      overtime_multiplier: row.overtime_multiplier || 1.5,
      available_roles: row.available_roles || [],
      has_keys: row.has_keys || false,
    }));

    return NextResponse.json({
      success: true,
      staff: staffConfig,
      metadata: {
        total_staff: staffConfig.length,
      },
    });

  } catch (error) {
    console.error('Error fetching staff config:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch staff configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { staff_id, base_hourly_rate, weekend_multiplier, holiday_multiplier, overtime_multiplier, available_roles, has_keys } = body;

    if (!staff_id) {
      return NextResponse.json(
        { error: 'staff_id is required' },
        { status: 400 }
      );
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (base_hourly_rate !== undefined) {
      updates.push(`base_hourly_rate = $${paramIndex}`);
      values.push(base_hourly_rate);
      paramIndex++;
    }

    if (weekend_multiplier !== undefined) {
      updates.push(`weekend_multiplier = $${paramIndex}`);
      values.push(weekend_multiplier);
      paramIndex++;
    }

    if (holiday_multiplier !== undefined) {
      updates.push(`holiday_multiplier = $${paramIndex}`);
      values.push(holiday_multiplier);
      paramIndex++;
    }

    if (overtime_multiplier !== undefined) {
      updates.push(`overtime_multiplier = $${paramIndex}`);
      values.push(overtime_multiplier);
      paramIndex++;
    }

    if (available_roles !== undefined) {
      updates.push(`available_roles = $${paramIndex}`);
      values.push(JSON.stringify(available_roles));
      paramIndex++;
    }

    if (has_keys !== undefined) {
      updates.push(`has_keys = $${paramIndex}`);
      values.push(has_keys);
      paramIndex++;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Add staff_id as last parameter
    values.push(staff_id);

    const query = `
      UPDATE staff_list
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      staff: result.rows[0],
      message: 'Staff configuration updated successfully',
    });

  } catch (error) {
    console.error('Error updating staff config:', error);

    return NextResponse.json(
      {
        error: 'Failed to update staff configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Admin API: Assign default roles to all staff members
 * POST /api/admin/assign-staff-roles
 *
 * Ensures all staff have "floor" and "cafe" roles for rostering.
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db/postgres';

export async function POST() {
  try {
    // Get all staff without roles or with incomplete roles
    const result = await pool.query(`
      SELECT id, staff_name, nickname, available_roles
      FROM staff_list
      WHERE available_roles IS NULL
         OR NOT (available_roles @> ARRAY['floor']::text[]
             AND available_roles @> ARRAY['cafe']::text[])
    `);

    console.log(`[Admin] Found ${result.rows.length} staff members needing role assignment`);

    const updates: Array<{ name: string; before: string[]; after: string[] }> = [];

    for (const staff of result.rows) {
      const currentRoles = staff.available_roles || [];
      const newRoles = Array.from(new Set([...currentRoles, 'floor', 'cafe']));

      await pool.query(`
        UPDATE staff_list
        SET available_roles = $1
        WHERE id = $2
      `, [newRoles, staff.id]);

      updates.push({
        name: staff.nickname || staff.staff_name,
        before: currentRoles,
        after: newRoles
      });

      console.log(`[Admin] ✅ ${staff.nickname || staff.staff_name}: ${JSON.stringify(currentRoles)} → ${JSON.stringify(newRoles)}`);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully assigned roles to ${updates.length} staff members`,
      updates
    });

  } catch (error) {
    console.error('[Admin] Error assigning staff roles:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to assign staff roles',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

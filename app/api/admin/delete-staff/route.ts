/**
 * Admin API: Delete a staff member
 * DELETE /api/admin/delete-staff?nickname=xxx
 *
 * Removes staff member from staff_list and all related data
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/postgres';

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const nickname = searchParams.get('nickname');

    if (!nickname) {
      return NextResponse.json(
        { error: 'nickname parameter is required' },
        { status: 400 }
      );
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get staff details before deletion
      const staffResult = await client.query(
        'SELECT id, staff_name, nickname FROM staff_list WHERE nickname = $1',
        [nickname]
      );

      if (staffResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: `Staff member '${nickname}' not found` },
          { status: 404 }
        );
      }

      const staff = staffResult.rows[0];
      const staffId = staff.id;

      // Delete related data (column names vary by table)
      const deleteOperations = [
        { table: 'staff_availability', field: 'staff_id' },
        { table: 'roster_shifts', field: 'staff_id' },
        { table: 'staff_knowledge', field: 'staff_member_id' },
        { table: 'play_logs', field: 'staff_list_id' },
        { table: 'content_checks', field: 'inspector_id' },
      ];

      const deletedCounts: Record<string, number> = {};

      for (const op of deleteOperations) {
        const result = await client.query(
          `DELETE FROM ${op.table} WHERE ${op.field} = $1`,
          [staffId]
        );
        deletedCounts[op.table] = result.rowCount || 0;
      }

      // Finally delete the staff member
      await client.query('DELETE FROM staff_list WHERE id = $1', [staffId]);

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: `Successfully deleted staff member '${staff.nickname || staff.staff_name}'`,
        deleted: {
          staff: staff,
          related_records: deletedCounts,
          total_related: Object.values(deletedCounts).reduce((a, b) => a + b, 0)
        }
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[Admin] Error deleting staff member:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete staff member',
        details: error.message
      },
      { status: 500 }
    );
  }
}

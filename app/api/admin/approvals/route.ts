/**
 * Approval Queue API
 * Manage shift swap and hour adjustment requests
 *
 * GET    /api/admin/approvals           - List all pending approvals
 * POST   /api/admin/approvals           - Create new approval request
 * PUT    /api/admin/approvals           - Approve/reject request
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/postgres';

/**
 * GET /api/admin/approvals
 * List all approval requests with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    const result = await pool.query(`
      SELECT
        ra.id,
        ra.request_type,
        ra.requested_by,
        sl_req.staff_name as requester_name,
        sl_req.nickname as requester_nickname,
        ra.shift_id,
        ra.original_data,
        ra.requested_data,
        ra.reason,
        ra.status,
        ra.reviewed_by,
        sl_rev.staff_name as reviewer_name,
        sl_rev.nickname as reviewer_nickname,
        ra.reviewed_at,
        ra.created_at,
        ra.updated_at
      FROM roster_approvals ra
      JOIN staff_list sl_req ON ra.requested_by = sl_req.id
      LEFT JOIN staff_list sl_rev ON ra.reviewed_by = sl_rev.id
      WHERE ra.status = $1
      ORDER BY ra.created_at DESC
    `, [status]);

    return NextResponse.json({
      success: true,
      approvals: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Error fetching approvals:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch approvals',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/approvals
 * Create a new approval request
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      request_type,
      requested_by,
      shift_id,
      original_data,
      requested_data,
      reason
    } = body;

    if (!request_type || !requested_by) {
      return NextResponse.json(
        { error: 'request_type and requested_by are required' },
        { status: 400 }
      );
    }

    const result = await pool.query(`
      INSERT INTO roster_approvals (
        request_type,
        requested_by,
        shift_id,
        original_data,
        requested_data,
        reason
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      request_type,
      requested_by,
      shift_id,
      original_data,
      requested_data,
      reason
    ]);

    return NextResponse.json({
      success: true,
      approval: result.rows[0],
      message: 'Approval request created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating approval request:', error);
    return NextResponse.json(
      {
        error: 'Failed to create approval request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/approvals
 * Approve or reject an approval request
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      approval_id,
      action, // 'approve' or 'reject'
      reviewed_by
    } = body;

    if (!approval_id || !action || !reviewed_by) {
      return NextResponse.json(
        { error: 'approval_id, action, and reviewed_by are required' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const result = await pool.query(`
      UPDATE roster_approvals
      SET
        status = $1,
        reviewed_by = $2,
        reviewed_at = NOW(),
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [newStatus, reviewed_by, approval_id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Approval request not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      approval: result.rows[0],
      message: `Request ${action}d successfully`
    });

  } catch (error) {
    console.error('Error updating approval:', error);
    return NextResponse.json(
      {
        error: 'Failed to update approval',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

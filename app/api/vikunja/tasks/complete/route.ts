/**
 * POST /api/vikunja/tasks/complete
 *
 * Complete a Vikunja task and award points to staff member
 * v1.6.1: Now adds completion comment to task
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { awardPoints } from '@/lib/services/points-service';
import { createTaskComment } from '@/lib/services/vikunja-service';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

const VIKUNJA_URL = process.env.VIKUNJA_API_URL || 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = process.env.VIKUNJA_API_TOKEN;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, staffId, points } = body;

    // Validate required fields
    if (!taskId || !staffId || points === undefined) {
      return NextResponse.json(
        { error: 'taskId, staffId, and points are required' },
        { status: 400 }
      );
    }

    if (!VIKUNJA_TOKEN) {
      return NextResponse.json(
        { error: 'Vikunja API token not configured' },
        { status: 500 }
      );
    }

    // Step 1: Get staff info first (needed for completion comment)
    const client = await pool.connect();
    let staffName: string;

    try {
      const result = await client.query(
        `SELECT staff_name as name FROM staff_list WHERE id = $1`,
        [staffId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Staff member not found' },
          { status: 404 }
        );
      }

      staffName = result.rows[0].name;
    } finally {
      client.release();
    }

    // Step 2: Mark task as complete in Vikunja
    const vikunjaResponse = await fetch(`${VIKUNJA_URL}/tasks/${taskId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        done: true
      })
    });

    if (!vikunjaResponse.ok) {
      const error = await vikunjaResponse.text();
      console.error('Vikunja API error:', error);
      return NextResponse.json(
        { error: 'Failed to complete task in Vikunja' },
        { status: 500 }
      );
    }

    const completedTask = await vikunjaResponse.json();

    // Step 3: Add completion comment to task
    // v1.6.1: Add comment recording who completed the task and when
    try {
      const timestamp = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Ho_Chi_Minh'
      });
      const comment = `Done by ${staffName} on ${timestamp}`;
      await createTaskComment(taskId, comment);
    } catch (commentError) {
      // Log error but don't fail the whole operation
      console.error('Failed to add completion comment:', commentError);
    }

    // Step 4: Award points using centralized service (creates changelog entry)
    await awardPoints({
      staffId: staffId,
      actionType: 'task_complete',
      points: points,
      metadata: {
        taskId: taskId,
        taskTitle: completedTask.title
      },
      context: `Completed task: ${completedTask.title}`
    });

    // Step 5: Get updated staff info
    const client2 = await pool.connect();
    try {
      const result = await client2.query(
        `SELECT
          id,
          staff_name as name,
          points
        FROM staff_list
        WHERE id = $1`,
        [staffId]
      );

      const updatedStaff = result.rows[0];

      return NextResponse.json({
        success: true,
        task: completedTask,
        staff: {
          id: updatedStaff.id,
          name: updatedStaff.name,
          points: updatedStaff.points,
          pointsAwarded: points
        }
      });

    } finally {
      client2.release();
    }

  } catch (error) {
    console.error('Error completing task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

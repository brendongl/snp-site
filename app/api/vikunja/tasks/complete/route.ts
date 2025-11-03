/**
 * POST /api/vikunja/tasks/complete
 *
 * Complete a Vikunja task and award points to staff member
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

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

    // Step 1: Mark task as complete in Vikunja
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

    // Step 2: Award points to staff member in database
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE staff_list
         SET points = COALESCE(points, 0) + $1
         WHERE id = $2`,
        [points, staffId]
      );

      // Get updated staff info
      const result = await client.query(
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
      client.release();
    }

  } catch (error) {
    console.error('Error completing task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

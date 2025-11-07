/**
 * POST /api/vikunja/tasks/[id]/complete
 *
 * Mark a Vikunja task as complete (without awarding points)
 * Used for observation notes where no points should be awarded
 * v1.6.1: Now adds completion comment
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { createTaskComment } from '@/lib/services/vikunja-service';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

const VIKUNJA_URL = process.env.VIKUNJA_API_URL || 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = process.env.VIKUNJA_API_TOKEN;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const body = await request.json();
    const { staffId } = body;

    // Validate required fields
    if (!staffId) {
      return NextResponse.json(
        { error: 'staffId is required' },
        { status: 400 }
      );
    }

    if (!VIKUNJA_TOKEN) {
      return NextResponse.json(
        { error: 'Vikunja API token not configured' },
        { status: 500 }
      );
    }

    // Get staff name for completion comment
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

    // Mark task as complete in Vikunja
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

    // Add completion comment
    try {
      const timestamp = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      const comment = `Done by ${staffName} on ${timestamp}`;
      await createTaskComment(parseInt(taskId), comment);
    } catch (commentError) {
      // Log error but don't fail the whole operation
      console.error('Failed to add completion comment:', commentError);
    }

    return NextResponse.json({
      success: true,
      task: completedTask,
      message: 'Observation note marked as complete'
    });

  } catch (error) {
    console.error('Error completing task:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

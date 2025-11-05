/**
 * POST /api/vikunja/tasks/[id]/complete
 *
 * Mark a Vikunja task as complete (without awarding points)
 * Used for observation notes where no points should be awarded
 */

import { NextRequest, NextResponse } from 'next/server';

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

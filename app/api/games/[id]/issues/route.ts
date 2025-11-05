/**
 * GET /api/games/[id]/issues
 *
 * Fetch Vikunja tasks (issues) related to a specific game
 */

import { NextRequest, NextResponse } from 'next/server';

const VIKUNJA_URL = process.env.VIKUNJA_API_URL || 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = process.env.VIKUNJA_API_TOKEN;
const BOARD_GAME_ISSUES_PROJECT_ID = 25; // Board Game Issues project

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: gameId } = await params;

    if (!VIKUNJA_TOKEN) {
      return NextResponse.json(
        { error: 'Vikunja API not configured' },
        { status: 500 }
      );
    }

    // Fetch all tasks from Board Game Issues project
    const response = await fetch(
      `${VIKUNJA_URL}/projects/${BOARD_GAME_ISSUES_PROJECT_ID}/tasks?per_page=100`,
      {
        headers: {
          'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
          'Content-Type': 'application/json'
        },
        // Disable caching to always get fresh data
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      console.error('Vikunja API error:', await response.text());
      return NextResponse.json(
        { error: 'Failed to fetch issues from Vikunja' },
        { status: 500 }
      );
    }

    const allTasks = await response.json();

    // Filter tasks that match this game ID
    const gameTasks = allTasks.filter((task: any) => {
      if (task.done) return false;
      const searchText = `${task.title} ${task.description}`.toLowerCase();
      return searchText.includes(gameId.toLowerCase());
    });

    // Transform tasks to simpler format
    const issues = gameTasks.map((task: any) => {
      const categoryMatch = task.title.match(/^(.+?)\s*-/);
      const issueCategory = categoryMatch
        ? categoryMatch[1].toLowerCase().replace(/\s+/g, '_')
        : 'other';

      const descriptionLines = task.description.split('\n').filter((line: string) => line.trim());
      const shortDescription = descriptionLines[0] || task.title;

      const pointsLabel = task.labels?.find((label: any) =>
        label.title.toLowerCase().startsWith('points:')
      );
      const points = pointsLabel
        ? parseInt(pointsLabel.title.split(':')[1]) || 0
        : 0;

      return {
        id: task.id,
        title: task.title,
        issueCategory,
        description: shortDescription,
        fullDescription: task.description,
        points,
        priority: task.priority,
        dueDate: task.due_date,
        createdAt: task.created,
        labels: task.labels
      };
    });

    return NextResponse.json({
      success: true,
      issues,
      count: issues.length
    });

  } catch (error) {
    console.error('Error fetching game issues:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

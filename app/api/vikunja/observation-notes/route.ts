/**
 * GET /api/vikunja/observation-notes
 *
 * Fetch all observation notes (tasks with "note" label) from Vikunja
 * Used by BG Issues & Checks page
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const VIKUNJA_URL = process.env.VIKUNJA_API_URL || 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = process.env.VIKUNJA_API_TOKEN;

interface VikunjaLabel {
  id: number;
  title: string;
  hex_color: string;
}

interface VikunjaUser {
  id: number;
  username: string;
  name: string;
}

interface VikunjaTask {
  id: number;
  title: string;
  description: string;
  done: boolean;
  due_date: string | null;
  priority: number;
  project_id: number;
  created: string;
  labels: VikunjaLabel[];
  assignees: VikunjaUser[];
}

export async function GET(request: NextRequest) {
  try {
    if (!VIKUNJA_TOKEN) {
      return NextResponse.json(
        { error: 'Vikunja API token not configured' },
        { status: 500 }
      );
    }

    const projectId = 25; // Board Game Issues project

    // Fetch all tasks from Project 25
    const response = await fetch(`${VIKUNJA_URL}/projects/${projectId}/tasks`, {
      headers: {
        'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tasks: ${response.status} ${response.statusText}`);
    }

    const allTasks: VikunjaTask[] = await response.json();

    // Filter to only tasks with "note" label that are not done
    const noteTasks = allTasks.filter(task => {
      const hasNoteLabel = task.labels?.some(label => label.title === 'note') ?? false;
      return hasNoteLabel && !task.done;
    });

    // Extract game name and issue category from task title
    // Format: "{category} - {game_name}"
    const enrichedNotes = await Promise.all(noteTasks.map(async (task) => {
      const titleMatch = task.title.match(/^(.+?)\s*-\s*(.+)$/);
      const issueCategory = titleMatch ? titleMatch[1].trim().toLowerCase().replace(/\s+/g, '_') : 'unknown';
      const gameName = titleMatch ? titleMatch[2].trim() : task.title;

      // Extract game ID from description (if available)
      const gameIdMatch = task.description.match(/\*\*Game ID:\*\*\s*(\S+)/);
      const gameId = gameIdMatch ? gameIdMatch[1] : null;

      // Extract reporter name from description
      const reporterMatch = task.description.match(/\*\*Reported by:\*\*\s*(.+)/);
      const reporterName = reporterMatch ? reporterMatch[1].trim() : 'Unknown';

      // Extract actual issue description from description
      const issueDescMatch = task.description.match(/\*\*Note:\*\*\s*(.+?)\n/);
      const issueDescription = issueDescMatch ? issueDescMatch[1].trim() : task.description;

      // Calculate days ago
      const createdDate = new Date(task.created);
      const now = new Date();
      const daysAgo = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: task.id.toString(),
        gameId: gameId,
        gameName: gameName,
        issueCategory: issueCategory,
        description: issueDescription,
        reporterName: reporterName,
        vikunjaTaskId: task.id,
        createdAt: task.created,
        daysAgo: daysAgo,
        priority: task.priority,
        dueDate: task.due_date
      };
    }));

    // Sort by created date (newest first)
    enrichedNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      count: enrichedNotes.length,
      issues: enrichedNotes
    });

  } catch (error) {
    console.error('❌ Error fetching observation notes from Vikunja:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch observation notes',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

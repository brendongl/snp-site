/**
 * GET /api/vikunja/board-game-issues
 *
 * Fetch all incomplete tasks from the Board Game Issues project
 * Used for staff dashboard to show pending issue resolution tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBoardGameIssueTasks } from '@/lib/services/vikunja-service';

export async function GET(request: NextRequest) {
  try {
    // Fetch all incomplete Board Game Issues tasks
    const tasks = await getBoardGameIssueTasks();

    return NextResponse.json({
      success: true,
      count: tasks.length,
      tasks: tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        points: task.points,
        dueDate: task.due_date,
        priority: task.priority,
        isOverdue: task.isOverdue,
        isDueToday: task.isDueToday,
        isDueSoon: task.isDueSoon,
        assignees: task.assignees.map(a => ({
          id: a.id,
          username: a.username,
          name: a.name
        })),
        labels: task.labels,
        createdAt: task.created,
        updatedAt: task.updated
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching Board Game Issues tasks:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch Board Game Issues tasks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

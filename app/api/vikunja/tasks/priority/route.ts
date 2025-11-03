import { NextResponse } from 'next/server';
import { getPriorityTasks } from '@/lib/services/vikunja-service';

/**
 * GET /api/vikunja/tasks/priority
 *
 * Returns tasks that are due today or overdue from Vikunja
 * Used in Staff Dashboard "Priority Actions" section
 */
export async function GET() {
  try {
    const priorityTasks = await getPriorityTasks();

    return NextResponse.json({
      tasks: priorityTasks,
      count: priorityTasks.length,
      totalPoints: priorityTasks.reduce((sum, task) => sum + task.points, 0)
    });

  } catch (error) {
    console.error('[Vikunja API] Error fetching priority tasks:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch priority tasks from Vikunja',
        tasks: [],
        count: 0,
        totalPoints: 0
      },
      { status: 500 }
    );
  }
}

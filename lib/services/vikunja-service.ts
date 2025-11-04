/**
 * Vikunja API Service
 *
 * Integrates with Vikunja task management system
 * Extracts point values from labels (e.g., "points:500")
 */

const VIKUNJA_URL = process.env.VIKUNJA_API_URL || 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = process.env.VIKUNJA_API_TOKEN;

if (!VIKUNJA_TOKEN) {
  console.warn('⚠️  VIKUNJA_API_TOKEN not set in environment');
}

interface VikunjaLabel {
  id: number;
  title: string;
  description: string;
  hex_color: string;
  created_by: number;
  updated: string;
  created: string;
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
  done_at: string | null;
  due_date: string | null;
  start_date: string | null;
  end_date: string | null;
  priority: number;
  percent_done: number;
  project_id: number;
  created: string;
  updated: string;
  created_by: VikunjaUser;
  labels: VikunjaLabel[];
  assignees: VikunjaUser[];
}

export interface TaskWithPoints extends VikunjaTask {
  points: number;
  isOverdue: boolean;
  isDueToday: boolean;
  isDueSoon: boolean; // Due within next 3 days
}

/**
 * Extract point value from task labels
 */
export function extractPoints(task: VikunjaTask): number {
  // Handle tasks without labels
  if (!task.labels || !Array.isArray(task.labels) || task.labels.length === 0) {
    return 0;
  }

  const pointLabel = task.labels.find(label =>
    label.title.startsWith('points:')
  );

  if (!pointLabel) return 0;

  const pointsStr = pointLabel.title.replace('points:', '');
  return parseInt(pointsStr) || 0;
}

/**
 * Check if task is overdue
 */
export function isOverdue(task: VikunjaTask): boolean {
  if (!task.due_date || task.done) return false;

  const dueDate = new Date(task.due_date);
  const now = new Date();
  return dueDate < now;
}

/**
 * Check if task is due today
 */
export function isDueToday(task: VikunjaTask): boolean {
  if (!task.due_date || task.done) return false;

  const dueDate = new Date(task.due_date);
  const today = new Date();

  return (
    dueDate.getDate() === today.getDate() &&
    dueDate.getMonth() === today.getMonth() &&
    dueDate.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if task is due within next N days (default: 3 days)
 */
export function isDueSoon(task: VikunjaTask, days: number = 3): boolean {
  if (!task.due_date || task.done) return false;

  const dueDate = new Date(task.due_date);
  const now = new Date();
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // Task is due soon if it's between now and the future date
  return dueDate >= now && dueDate <= future;
}

/**
 * Enhance task with computed fields
 */
export function enhanceTask(task: VikunjaTask): TaskWithPoints {
  return {
    ...task,
    points: extractPoints(task),
    isOverdue: isOverdue(task),
    isDueToday: isDueToday(task),
    isDueSoon: isDueSoon(task, 3) // Next 3 days
  };
}

/**
 * Fetch all tasks from a project
 */
export async function getProjectTasks(projectId: number): Promise<TaskWithPoints[]> {
  if (!VIKUNJA_TOKEN) {
    throw new Error('VIKUNJA_API_TOKEN not configured');
  }

  const response = await fetch(`${VIKUNJA_URL}/projects/${projectId}/tasks`, {
    headers: {
      'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
      'Content-Type': 'application/json'
    },
    next: { revalidate: 60 } // Cache for 1 minute
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vikunja API error: ${response.status} - ${error}`);
  }

  const tasks: VikunjaTask[] = await response.json();
  return tasks.map(enhanceTask);
}

/**
 * Get priority tasks (due within 3 days, today, or overdue) for staff dashboard
 */
export async function getPriorityTasks(projectId: number = 2): Promise<TaskWithPoints[]> {
  const allTasks = await getProjectTasks(projectId);

  // Include tasks that are: overdue, due today, or due within next 3 days
  const priorityTasks = allTasks.filter(task =>
    !task.done && (task.isOverdue || task.isDueToday || task.isDueSoon)
  );

  // Sort: overdue first, then by due date (soonest first)
  return priorityTasks.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;

    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }

    return 0;
  });
}

/**
 * Get task by ID
 */
export async function getTask(taskId: number): Promise<TaskWithPoints | null> {
  if (!VIKUNJA_TOKEN) {
    throw new Error('VIKUNJA_API_TOKEN not configured');
  }

  const response = await fetch(`${VIKUNJA_URL}/tasks/${taskId}`, {
    headers: {
      'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
      'Content-Type': 'application/json'
    },
    next: { revalidate: 60 }
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    const error = await response.text();
    throw new Error(`Vikunja API error: ${response.status} - ${error}`);
  }

  const task: VikunjaTask = await response.json();
  return enhanceTask(task);
}

/**
 * Mark task as complete
 */
export async function completeTask(taskId: number): Promise<TaskWithPoints> {
  if (!VIKUNJA_TOKEN) {
    throw new Error('VIKUNJA_API_TOKEN not configured');
  }

  const response = await fetch(`${VIKUNJA_URL}/tasks/${taskId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      done: true
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to complete task: ${response.status} - ${error}`);
  }

  const task: VikunjaTask = await response.json();
  return enhanceTask(task);
}

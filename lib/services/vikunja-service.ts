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
 * Extract point value from task labels or title
 */
export function extractPoints(task: VikunjaTask): number {
  // Try to extract from labels first
  if (task.labels && Array.isArray(task.labels) && task.labels.length > 0) {
    const pointLabel = task.labels.find(label =>
      label.title.startsWith('points:')
    );

    if (pointLabel) {
      const pointsStr = pointLabel.title.replace('points:', '');
      return parseInt(pointsStr) || 0;
    }
  }

  // Fallback: Parse from task title if format is "... [XXXpts]"
  const titleMatch = task.title.match(/\[(\d+)pts?\]/i);
  if (titleMatch) {
    return parseInt(titleMatch[1]) || 0;
  }

  // Fallback: Parse from description if it says "earn X points"
  const descMatch = task.description.match(/earn\s+(\d+)\s+points/i);
  if (descMatch) {
    return parseInt(descMatch[1]) || 0;
  }

  return 0;
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
    cache: 'no-store' // Always fetch fresh data (no caching)
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

// ============================================================================
// BOARD GAME ISSUES PROJECT METHODS (v1.5.0)
// ============================================================================

/**
 * Map point values to Vikunja label IDs
 * Labels created via scripts/reset-vikunja-db-sequence.js
 * Last reset: 2025-11-05 (IDs 1-26) - Comprehensive coverage
 *
 * Covers all possible point values the system can award:
 * - Play logs: 100
 * - Knowledge adds: 100-2500 (various complexity combinations)
 * - Issue resolution: 500, 1000, 2000
 * - Content checks: 1000-5000 (complexity × 1000)
 * - Teaching: 1000-15000 (complexity × students × 1000)
 * - Photo uploads: 1000
 * - Major projects: 20000, 50000
 */
function getPointLabelId(points: number): number | null {
  const labelMap: Record<number, number> = {
    100: 1,     // Play log, knowledge upgrade, simple task
    200: 2,     // Knowledge add level 1-2
    300: 3,     // Knowledge add level 1-3
    400: 4,     // Knowledge add level 1-4
    500: 5,     // Knowledge add level 1-5, issue resolution basic
    600: 6,     // Knowledge add level 2-3
    800: 7,     // Knowledge add level 2-4
    900: 8,     // Knowledge add level 3
    1000: 9,    // Content check ×1, teaching ×1×1, photo upload
    1200: 10,   // Knowledge add level 3-4
    1500: 11,   // Knowledge add level 3-5, level 4-3
    2000: 12,   // Content check ×2, teaching ×2×1, knowledge level 4-4
    2500: 13,   // Knowledge add level 4-5
    3000: 14,   // Content check ×3, teaching ×3×1 or ×1×3
    4000: 15,   // Content check ×4, teaching ×4×1 or ×2×2
    5000: 16,   // Content check ×5, teaching ×5×1
    6000: 17,   // Teaching ×3×2 or ×2×3
    8000: 18,   // Teaching ×4×2 or ×2×4
    9000: 19,   // Teaching ×3×3
    10000: 20,  // Teaching ×5×2 or ×2×5
    12000: 21,  // Teaching ×4×3 or ×3×4
    15000: 22,  // Teaching ×5×3 or ×3×5
    20000: 23,  // Major project, teaching ×4×5
    50000: 24   // Epic achievement (1+ week)
  };
  return labelMap[points] || null;
}

/**
 * Get issue resolution base points by category
 */
function getIssueResolutionPoints(category: string): number {
  const pointMap: Record<string, number> = {
    'broken_sleeves': 500,
    'needs_sorting': 500,
    'needs_cleaning': 500,
    'box_rewrap': 1000,
    'customer_reported': 0, // Just triggers content check
    'other_actionable': 500
  };
  return pointMap[category] || 0;
}

/**
 * Calculate due date based on issue urgency
 */
function calculateDueDate(issueCategory: string): string {
  const urgencyMap: Record<string, number> = {
    'broken_sleeves': 7,      // 1 week
    'needs_sorting': 3,       // 3 days
    'needs_cleaning': 2,      // 2 days
    'box_rewrap': 7,          // 1 week
    'customer_reported': 1,   // 1 day (urgent)
    'other_actionable': 3     // 3 days
  };

  const daysUntilDue = urgencyMap[issueCategory] || 3;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + daysUntilDue);
  return dueDate.toISOString();
}

/**
 * Calculate priority (1-5, 5 = highest)
 */
function calculatePriority(issueCategory: string): number {
  const priorityMap: Record<string, number> = {
    'customer_reported': 5,   // Highest
    'needs_cleaning': 4,
    'broken_sleeves': 3,
    'needs_sorting': 3,
    'box_rewrap': 2,
    'other_actionable': 3
  };
  return priorityMap[issueCategory] || 3;
}

/**
 * Map issue type to Vikunja label IDs
 * Labels created via scripts/reset-vikunja-db-sequence.js
 * Last reset: 2025-11-05 (IDs 25-26)
 */
function getIssueTypeLabelId(issueType: 'task' | 'note'): number {
  return issueType === 'task' ? 25 : 26; // task=25, note=26
}

/**
 * Create a Board Game Issue task in Vikunja
 * v1.5.3: Now supports issue types (task/note) with appropriate labels
 */
export async function createBoardGameIssueTask(params: {
  gameName: string;
  gameId: string;
  gameComplexity: number;
  issueCategory: string;
  issueDescription: string;
  reportedBy: string;
  reportedByVikunjaUserId: number;
  issueType?: 'task' | 'note'; // Optional, defaults to 'task' for backward compatibility
}): Promise<number> {
  if (!VIKUNJA_TOKEN) {
    throw new Error('VIKUNJA_API_TOKEN not configured');
  }

  const projectId = 25; // Board Game Issues project (hard-coded)
  const issueType = params.issueType || 'task'; // Default to 'task' if not specified

  // Calculate points for task completion (only for actionable tasks)
  const basePoints = getIssueResolutionPoints(params.issueCategory);
  const points = issueType === 'task' && params.gameComplexity >= 3 ? basePoints * 2 : basePoints;

  // Calculate due date and priority
  const dueDate = calculateDueDate(params.issueCategory);
  const priority = calculatePriority(params.issueCategory);

  // Get label IDs for points and issue type
  const pointLabelId = getPointLabelId(points);
  const issueTypeLabelId = getIssueTypeLabelId(issueType);

  // Build request body
  const taskBody: any = {
    title: `${params.issueCategory.replace(/_/g, ' ')} - ${params.gameName}`,
    description: issueType === 'task'
      ? `
**Issue:** ${params.issueDescription}

**Reported by:** ${params.reportedBy}
**Game ID:** ${params.gameId}
**Complexity:** ${params.gameComplexity}

Complete this task to resolve the issue and earn ${points} points!
    `.trim()
      : `
**Note:** ${params.issueDescription}

**Reported by:** ${params.reportedBy}
**Game ID:** ${params.gameId}
**Complexity:** ${params.gameComplexity}

This is a non-actionable observation. No points awarded upon completion.
    `.trim(),
    project_id: projectId,
    due_date: dueDate,
    priority: priority,
    assignees: [{ id: params.reportedByVikunjaUserId }]
  };

  // Add labels: always add issue type label, optionally add points label for actionable tasks
  const labels = [{ id: issueTypeLabelId }];
  if (issueType === 'task' && pointLabelId) {
    labels.push({ id: pointLabelId });
  } else if (issueType === 'task' && points > 0 && !pointLabelId) {
    console.warn(`⚠️  No label found for ${points} points. Task will use description fallback.`);
  }
  taskBody.labels = labels;

  // Create task using PUT method
  const response = await fetch(`${VIKUNJA_URL}/projects/${projectId}/tasks`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(taskBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create Vikunja task: ${response.status} - ${errorText}`);
  }

  const task = await response.json();
  return task.id;
}

/**
 * Get all tasks from Board Game Issues project
 * v1.5.3: Filters out observation notes (only shows actionable tasks labeled as 'task')
 */
export async function getBoardGameIssueTasks(): Promise<TaskWithPoints[]> {
  const projectId = 25; // Board Game Issues project (hard-coded)

  const allTasks = await getProjectTasks(projectId);

  // Filter to incomplete tasks that are NOT labeled as 'note' (observation notes)
  // Include tasks labeled as 'task' (actionable) and unlabeled tasks (backward compatibility)
  return allTasks.filter(task => {
    if (task.done) return false;

    // Check if task has the 'note' label (ID: 26) - these are observation notes
    // Handle null/undefined labels array with optional chaining
    const hasNoteLabel = task.labels?.some(label => label.id === 26) ?? false;

    // Exclude all observation notes - include everything else (actionable tasks)
    return !hasNoteLabel;
  });
}

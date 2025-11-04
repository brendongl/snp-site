'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, GamepadIcon, TrendingUp, ArrowLeft, Clock, AlertCircle, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { StaffMenu } from '@/components/features/staff/StaffMenu';

interface DashboardStats {
  gamesNeedingCheck: number;
  playLogsToday: number;
  playLogsThisWeek: number;
  knowledgeGaps: number;
}

interface PriorityAction {
  game_id: string;
  name: string;
  days_since_check: number | null;
  plays_since_check: number;
}

interface Activity {
  type: string;
  timestamp: string;
  staff_name: string;
  game_name: string;
  action: string;
  description?: string;
}

// v1.2.0: Games with issues interface
interface GameWithIssue {
  game_id: string;
  game_name: string;
  issue_description: string;
  reported_by: string;
  reported_date: string;
}

// Vikunja task with points
interface VikunjaTask {
  id: number;
  title: string;
  description: string;
  done: boolean;
  due_date: string | null;
  priority: number;
  points: number;
  isOverdue: boolean;
  isDueToday: boolean;
  isDueSoon: boolean; // Due within next 3 days
}

interface StaffInfo {
  id: string;
  name: string;
  points: number;
  vikunjaUserId: number | null;
  vikunjaUsername: string | null;
}

export default function StaffDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [priorityActions, setPriorityActions] = useState<PriorityAction[]>([]);
  const [gamesWithIssues, setGamesWithIssues] = useState<GameWithIssue[]>([]); // v1.2.0
  const [vikunjaTasks, setVikunjaTasks] = useState<VikunjaTask[]>([]);
  const [boardGameIssueTasks, setBoardGameIssueTasks] = useState<VikunjaTask[]>([]); // v1.5.0
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);

  // Collapsible section states
  const [upcomingTasksCollapsed, setUpcomingTasksCollapsed] = useState(false);
  const [boardGameIssuesCollapsed, setBoardGameIssuesCollapsed] = useState(false); // v1.5.0
  const [gamesNeedingAttentionCollapsed, setGamesNeedingAttentionCollapsed] = useState(false);
  const [priorityActionsCollapsed, setPriorityActionsCollapsed] = useState(false);
  const [recentActivityCollapsed, setRecentActivityCollapsed] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    fetchStaffInfo();
  }, []);

  const fetchStaffInfo = async () => {
    try {
      const staffId = localStorage.getItem('staff_id');
      if (!staffId) {
        console.warn('No staff ID found in localStorage');
        return;
      }

      const response = await fetch(`/api/staff/points?staffId=${staffId}`);
      if (response.ok) {
        const data = await response.json();
        setStaffInfo(data);
      }
    } catch (error) {
      console.error('Error fetching staff info:', error);
    }
  };

  const handleCompleteTask = async (taskId: number, taskPoints: number) => {
    if (!staffInfo) {
      console.error('No staff info available');
      return;
    }

    try {
      setCompletingTaskId(taskId);

      // Call API to complete task and award points
      const response = await fetch('/api/vikunja/tasks/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId,
          staffId: staffInfo.id,
          points: taskPoints
        })
      });

      if (!response.ok) {
        throw new Error('Failed to complete task');
      }

      const result = await response.json();

      // Update staff points locally
      setStaffInfo(prev => prev ? {
        ...prev,
        points: prev.points + taskPoints
      } : null);

      // Remove completed task from list
      setVikunjaTasks(prev => prev.filter(task => task.id !== taskId));

      console.log('Task completed successfully:', result);
    } catch (error) {
      console.error('Error completing task:', error);
      alert('Failed to complete task. Please try again.');
    } finally {
      setCompletingTaskId(null);
    }
  };

  const fetchDashboardData = async () => {
    try {
      // v1.2.0: Added games with issues fetch
      // v1.5.0: Added board game issues tasks fetch
      const [statsRes, actionsRes, issuesRes, vikunjaRes, bgIssuesRes, activityRes] = await Promise.all([
        fetch('/api/staff/dashboard/stats'),
        fetch('/api/staff/dashboard/priority-actions?limit=5'),
        fetch('/api/content-checks/needs-attention'),
        fetch('/api/vikunja/tasks/priority'),
        fetch('/api/vikunja/board-game-issues'),
        fetch('/api/staff/dashboard/recent-activity?limit=10'),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (actionsRes.ok) {
        const actionsData = await actionsRes.json();
        setPriorityActions(actionsData.actions);
      }

      // v1.2.0: Fetch games with issues
      if (issuesRes.ok) {
        const issuesData = await issuesRes.json();
        setGamesWithIssues(issuesData.issues || []);
      }

      // Fetch Vikunja priority tasks
      if (vikunjaRes.ok) {
        const vikunjaData = await vikunjaRes.json();
        setVikunjaTasks(vikunjaData.tasks || []);
      }

      // v1.5.0: Fetch Board Game Issues tasks from Vikunja
      if (bgIssuesRes.ok) {
        const bgIssuesData = await bgIssuesRes.json();
        setBoardGameIssueTasks(bgIssuesData.tasks || []);
      }

      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setRecentActivity(activityData.activities);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    }
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  };

  const getPointBadgeColor = (points: number) => {
    if (points >= 10000) return 'bg-purple-100 text-purple-700 border-purple-200';
    if (points >= 5000) return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    if (points >= 1000) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (points >= 500) return 'bg-cyan-100 text-cyan-700 border-cyan-200';
    return 'bg-green-100 text-green-700 border-green-200';
  };

  const formatDueDate = (dueDate: string) => {
    const date = new Date(dueDate);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-6 max-w-6xl">
            <div className="flex items-center justify-between gap-3 mb-4">
              <Link href="/games" className="inline-flex items-center gap-2 text-primary hover:text-primary/80">
                <ArrowLeft className="w-4 h-4" />
                Back to Games
              </Link>
              <StaffMenu />
            </div>
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold">Staff Dashboard</h1>
              {staffInfo && (
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Welcome,</div>
                    <div className="font-semibold">{staffInfo.name}</div>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <Star className="h-5 w-5 text-yellow-600 fill-yellow-600" />
                    <span className="font-bold text-yellow-900">{staffInfo.points.toLocaleString()}</span>
                    <span className="text-sm text-yellow-700">points</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 py-8">
          <div className="space-y-8 animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="h-64 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <div className="flex items-center justify-between gap-3 mb-4">
            <Link href="/games" className="inline-flex items-center gap-2 text-primary hover:text-primary/80">
              <ArrowLeft className="w-4 h-4" />
              Back to Games
            </Link>
            <StaffMenu />
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Staff Dashboard</h1>
            {staffInfo && (
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Welcome,</div>
                  <div className="font-semibold">{staffInfo.name}</div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <Star className="h-5 w-5 text-yellow-600 fill-yellow-600" />
                  <span className="font-bold text-yellow-900">{staffInfo.points.toLocaleString()}</span>
                  <span className="text-sm text-yellow-700">points</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8 space-y-8">

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card className="p-3 sm:p-6">
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <div className="text-[10px] sm:text-sm text-gray-600">Games Need Checking</div>
            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
          </div>
          <div className="text-xl sm:text-3xl font-bold">{stats?.gamesNeedingCheck || 0}</div>
          <Link href="/staff/check-history" className="text-[10px] sm:text-sm text-blue-600 hover:underline mt-1 sm:mt-2 inline-block">
            View all →
          </Link>
        </Card>

        <Card className="p-3 sm:p-6">
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <div className="text-[10px] sm:text-sm text-gray-600">Play Logs</div>
            <GamepadIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
          </div>
          <div className="text-xl sm:text-3xl font-bold">{stats?.playLogsToday || 0}</div>
          <div className="text-[10px] sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
            {stats?.playLogsThisWeek || 0} this week
          </div>
          <Link href="/staff/play-logs" className="text-[10px] sm:text-sm text-blue-600 hover:underline mt-1 sm:mt-2 inline-block">
            View all →
          </Link>
        </Card>

        <Card className="p-3 sm:p-6">
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <div className="text-[10px] sm:text-sm text-gray-600">Games I don't know</div>
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
          </div>
          <div className="text-xl sm:text-3xl font-bold">{stats?.knowledgeGaps || 0}</div>
          <Link href="/games?knowledgeFilter=unknown" className="text-[10px] sm:text-sm text-blue-600 hover:underline mt-1 sm:mt-2 inline-block">
            View all →
          </Link>
        </Card>
      </div>

      {/* Upcoming Tasks (Vikunja) */}
      {vikunjaTasks.length > 0 && (
        <Card className="p-6 border-orange-200 bg-orange-50/30">
          <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setUpcomingTasksCollapsed(!upcomingTasksCollapsed)}>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-orange-800">📋 Upcoming Tasks</h2>
              <span className="text-sm text-orange-700 font-medium">
                ({vikunjaTasks.length} task{vikunjaTasks.length !== 1 ? 's' : ''})
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                className="border-orange-300"
                asChild
                onClick={(e) => e.stopPropagation()}
              >
                <Link href="https://tasks.sipnplay.cafe" target="_blank" rel="noopener noreferrer">
                  Open Task Manager
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              {upcomingTasksCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
            </div>
          </div>
          {!upcomingTasksCollapsed && (
          <div className="space-y-2">
            {vikunjaTasks.map((task) => {
              // Determine card styling based on priority
              const getCardStyles = () => {
                if (task.isOverdue) {
                  return 'border-red-200 bg-red-50/50 hover:bg-red-50';
                }
                if (task.isDueToday) {
                  return 'border-orange-200 bg-white hover:bg-orange-50/50';
                }
                // Due soon (within 3 days)
                return 'border-blue-200 bg-blue-50/30 hover:bg-blue-50/50';
              };

              return (
              <div
                key={task.id}
                className={`flex items-start justify-between p-3 border rounded-lg transition-colors ${getCardStyles()}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`font-medium ${
                      task.isOverdue ? 'text-red-900' :
                      task.isDueToday ? 'text-orange-900' :
                      'text-blue-900'
                    }`}>
                      {task.title}
                    </div>
                    {task.points > 0 && (
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${getPointBadgeColor(task.points)}`}>
                        {task.points.toLocaleString()} pts
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {task.isOverdue ? (
                      <span className="flex items-center gap-1 text-red-600">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Overdue
                      </span>
                    ) : task.isDueToday ? (
                      <span className="flex items-center gap-1 text-orange-600">
                        <Clock className="h-3.5 w-3.5" />
                        Due today
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-blue-600">
                        <Clock className="h-3.5 w-3.5" />
                        Due soon
                      </span>
                    )}
                    {task.due_date && (
                      <span className={
                        task.isOverdue ? 'text-red-600' :
                        task.isDueToday ? 'text-orange-600' :
                        'text-blue-600'
                      }>
                        • {formatDueDate(task.due_date)}
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {task.description}
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => handleCompleteTask(task.id, task.points)}
                  disabled={completingTaskId === task.id}
                  size="sm"
                  className="ml-3 shrink-0"
                >
                  {completingTaskId === task.id ? (
                    <>
                      <Clock className="h-4 w-4 mr-1 animate-spin" />
                      Completing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Complete
                    </>
                  )}
                </Button>
              </div>
              );
            })}
          </div>
          )}
        </Card>
      )}

      {/* v1.5.0: Board Game Issues */}
      {boardGameIssueTasks.length > 0 && (
        <Card className="p-6 border-orange-200 bg-orange-50/50">
          <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setBoardGameIssuesCollapsed(!boardGameIssuesCollapsed)}>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-orange-700">🔧 Board Game Issues</h2>
              <span className="text-sm text-orange-600 font-medium">
                ({boardGameIssueTasks.length} task{boardGameIssueTasks.length !== 1 ? 's' : ''})
              </span>
            </div>
            {boardGameIssuesCollapsed ? <ChevronDown className="h-5 w-5 text-orange-600" /> : <ChevronUp className="h-5 w-5 text-orange-600" />}
          </div>
          {!boardGameIssuesCollapsed && (
            <div className="space-y-3">
              {boardGameIssueTasks.map((task) => {
                const taskColor = task.isOverdue
                  ? 'border-red-300 bg-red-50/50'
                  : task.isDueToday
                  ? 'border-orange-300 bg-orange-50/50'
                  : 'border-blue-300 bg-blue-50/50';

                return (
                  <div
                    key={task.id}
                    className={`flex flex-col p-4 border rounded-lg ${taskColor}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 mb-1">{task.title}</div>
                        {task.description && (
                          <div className="text-sm text-gray-600 whitespace-pre-line mb-2">
                            {task.description}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                          {task.due_date && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDueDate(task.due_date)}
                            </span>
                          )}
                          {task.priority > 0 && (
                            <span className="flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Priority {task.priority}
                            </span>
                          )}
                        </div>
                      </div>
                      {task.points > 0 && (
                        <div className={`shrink-0 px-3 py-1 border rounded-full text-sm font-medium ${getPointBadgeColor(task.points)}`}>
                          {task.points} pts
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Link href={`https://tasks.sipnplay.cafe/tasks/${task.id}`} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-100">
                          View in Vikunja
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="default"
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                        onClick={() => handleCompleteTask(task.id, task.points)}
                        disabled={completingTaskId === task.id}
                      >
                        {completingTaskId === task.id ? (
                          <>
                            <Clock className="h-4 w-4 mr-1 animate-spin" />
                            Completing...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Complete
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* v1.2.0: Games Needing Attention */}
      {gamesWithIssues.length > 0 && (
        <Card className="p-6 border-red-200 bg-red-50/50">
          <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setGamesNeedingAttentionCollapsed(!gamesNeedingAttentionCollapsed)}>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-red-700">⚠️ Games Needing Attention</h2>
              <span className="text-sm text-red-600 font-medium">
                ({gamesWithIssues.length} issue{gamesWithIssues.length !== 1 ? 's' : ''})
              </span>
            </div>
            {gamesNeedingAttentionCollapsed ? <ChevronDown className="h-5 w-5 text-red-600" /> : <ChevronUp className="h-5 w-5 text-red-600" />}
          </div>
          {!gamesNeedingAttentionCollapsed && (
          <div className="space-y-2">
            {gamesWithIssues.map((issue) => (
              <div
                key={issue.game_id}
                className="flex items-center justify-between p-3 border border-red-200 bg-white rounded-lg hover:bg-red-50/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-red-900">{issue.game_name}</div>
                  <div className="text-sm text-red-700 mt-1">
                    <span className="font-medium">Issue:</span> {issue.issue_description}
                  </div>
                  <div className="text-xs text-red-600 mt-1">
                    Reported by {issue.reported_by} on{' '}
                    {new Date(issue.reported_date).toLocaleDateString()}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="ml-4 border-red-300 text-red-700 hover:bg-red-100" asChild>
                  <Link href={`/games?openGame=${issue.game_id}`}>
                    Resolve
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
          )}
        </Card>
      )}

      {/* Priority Actions */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setPriorityActionsCollapsed(!priorityActionsCollapsed)}>
          <h2 className="text-xl font-semibold">Priority Actions</h2>
          {priorityActionsCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
        </div>
        {!priorityActionsCollapsed && (
        <>
        {priorityActions.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            All games are up to date! ✅
          </p>
        ) : (
          <div className="space-y-2">
            {priorityActions.map((action) => (
              <div
                key={action.game_id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div>
                  <div className="font-medium">{action.name}</div>
                  <div className="text-sm text-gray-600">
                    {action.days_since_check
                      ? `${action.days_since_check} days`
                      : 'Never checked'}
                    {' • '}
                    {action.plays_since_check} plays since check
                  </div>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/games?openGame=${action.game_id}`}>
                    Check Now
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}
        </>
        )}
      </Card>

      {/* Recent Activity */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setRecentActivityCollapsed(!recentActivityCollapsed)}>
          <h2 className="text-xl font-semibold">Recent Activity</h2>
          {recentActivityCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
        </div>
        {!recentActivityCollapsed && (
        <div className="space-y-2">
          {recentActivity.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No recent activity</p>
          ) : (
            recentActivity.map((activity, index) => (
              <div key={index} className="text-sm py-2 border-b last:border-0">
                <span className="font-medium">{activity.staff_name}</span>
                <span className="text-gray-600"> {activity.action}</span>
                <span className="text-gray-400 ml-2">
                  • {formatTimeAgo(activity.timestamp)}
                </span>
              </div>
            ))
          )}
        </div>
        )}
      </Card>
      </div>
    </div>
  );
}

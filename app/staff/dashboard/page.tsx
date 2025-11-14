'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, GamepadIcon, TrendingUp, ArrowLeft, Clock, AlertCircle, Star, ChevronDown, ChevronUp, Eye, ClipboardCheck, PlayCircle, BookOpen, AlertTriangle, CheckSquare, Settings, Activity as ActivityIcon } from 'lucide-react';
import { StaffMenu } from '@/components/features/staff/StaffMenu';

interface DashboardStats {
  gamesNeedingCheck: number;
  playLogsToday: number;
  playLogsThisWeek: number;
  knowledgeGaps: number;
}

interface Activity {
  type: string;
  timestamp: string;
  staff_name: string;
  nickname?: string;
  full_name?: string;
  game_name: string;
  action: string;
  description?: string;
  points_earned?: number;
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

interface AvailabilityStats {
  totalHours: number;
  availableHours: number;
  preferredNotHours: number;
  unavailableHours: number;
  availablePercentage: number;
}

// Helper function to get activity icon based on type (v1.5.9)
const getActivityIcon = (type: string) => {
  switch (type) {
    case 'content_check':
      return <ClipboardCheck className="h-4 w-4 text-blue-500" />;
    case 'play_log':
      return <PlayCircle className="h-4 w-4 text-green-500" />;
    case 'staff_knowledge':
      return <BookOpen className="h-4 w-4 text-purple-500" />;
    case 'issue_report':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'task':
      return <CheckSquare className="h-4 w-4 text-green-600" />;
    case 'points':
      return <Star className="h-4 w-4 text-yellow-500" />;
    case 'board_game':
      return <GamepadIcon className="h-4 w-4 text-blue-600" />;
    default:
      return <ActivityIcon className="h-4 w-4 text-gray-400" />;
  }
};

export default function StaffDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [gamesNeedingAttention, setGamesNeedingAttention] = useState<VikunjaTask[]>([]); // v1.5.0: From Vikunja Board Game Issues
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [availabilityStats, setAvailabilityStats] = useState<AvailabilityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);
  const [selectedGameIssue, setSelectedGameIssue] = useState<VikunjaTask | null>(null);
  const [showGameIssueDialog, setShowGameIssueDialog] = useState(false);

  // Collapsible section states
  const [gamesNeedingAttentionCollapsed, setGamesNeedingAttentionCollapsed] = useState(false);
  const [recentActivityCollapsed, setRecentActivityCollapsed] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    fetchStaffInfo();
    fetchAvailabilityStats();

    // Set up polling for real-time points updates (every 30 seconds)
    const pointsInterval = setInterval(() => {
      fetchStaffInfo();
    }, 30000);

    // Cleanup interval on unmount
    return () => clearInterval(pointsInterval);
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

  const fetchAvailabilityStats = async () => {
    try {
      const staffId = localStorage.getItem('staff_id');
      if (!staffId) {
        return;
      }

      const response = await fetch(`/api/staff/availability?staff_id=${staffId}`);
      if (response.ok) {
        const data = await response.json();

        // Calculate stats from availability data
        let availableHours = 0;
        let preferredNotHours = 0;
        let unavailableHours = 0;

        data.availability.forEach((slot: any) => {
          const hours = slot.hour_end - slot.hour_start;

          if (slot.availability_status === 'available') {
            availableHours += hours;
          } else if (slot.availability_status === 'preferred_not') {
            preferredNotHours += hours;
          } else if (slot.availability_status === 'unavailable') {
            unavailableHours += hours;
          }
        });

        const totalHours = 7 * 18; // 7 days × 18 hours (8am-2am)
        const availablePercentage = Math.round((availableHours / totalHours) * 100);

        setAvailabilityStats({
          totalHours,
          availableHours,
          preferredNotHours,
          unavailableHours,
          availablePercentage
        });
      }
    } catch (error) {
      console.error('Error fetching availability stats:', error);
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

      console.log('Task completed successfully:', result);

      // Update staff info immediately with response data (real-time update)
      if (result.staff) {
        setStaffInfo({
          id: result.staff.id,
          name: result.staff.name,
          points: result.staff.points,
          vikunjaUserId: staffInfo.vikunjaUserId,
          vikunjaUsername: staffInfo.vikunjaUsername
        });
      }

      // Refetch dashboard data to update task lists
      await fetchDashboardData();

    } catch (error) {
      console.error('Error completing task:', error);
      alert('Failed to complete task. Please try again.');
    } finally {
      setCompletingTaskId(null);
    }
  };

  const fetchDashboardData = async () => {
    try {
      // v1.5.0: Fetch from Vikunja for Games Needing Attention
      const [statsRes, gamesAttentionRes, activityRes] = await Promise.all([
        fetch('/api/staff/dashboard/stats'),
        fetch('/api/vikunja/board-game-issues'),
        fetch('/api/staff/dashboard/recent-activity?limit=10'),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // v1.5.0: Fetch Games Needing Attention from Vikunja
      if (gamesAttentionRes.ok) {
        const gamesAttentionData = await gamesAttentionRes.json();
        setGamesNeedingAttention(gamesAttentionData.tasks || []);
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
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

        <Card className="p-3 sm:p-6">
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <div className="text-[10px] sm:text-sm text-gray-600">My Availability</div>
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
          </div>
          <div className="text-xl sm:text-3xl font-bold">
            {availabilityStats ? `${availabilityStats.availablePercentage}%` : '—'}
          </div>
          <div className="text-[10px] sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
            {availabilityStats ? `${availabilityStats.availableHours} of ${availabilityStats.totalHours} hrs` : 'Not set'}
          </div>
          <Link href="/staff/availability" className="text-[10px] sm:text-sm text-blue-600 hover:underline mt-1 sm:mt-2 inline-block">
            Edit availability →
          </Link>
        </Card>
      </div>

      {/* v1.5.0: Games Needing Attention (from Vikunja Board Game Issues project 25) */}
      {gamesNeedingAttention.length > 0 && (
        <Card className="p-6 border-red-200 bg-red-50/50">
          <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setGamesNeedingAttentionCollapsed(!gamesNeedingAttentionCollapsed)}>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-red-700">⚠️ Games Needing Attention</h2>
              <span className="text-sm text-red-600 font-medium">
                ({gamesNeedingAttention.length} game{gamesNeedingAttention.length !== 1 ? 's' : ''})
              </span>
            </div>
            {gamesNeedingAttentionCollapsed ? <ChevronDown className="h-5 w-5 text-red-600" /> : <ChevronUp className="h-5 w-5 text-red-600" />}
          </div>
          {!gamesNeedingAttentionCollapsed && (
            <div className="space-y-3">
              {gamesNeedingAttention.map((task) => {
                // Extract issue type from title (text before " - ")
                const issueType = task.title.split(' - ')[0] || task.title;

                return (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 border border-red-300 bg-white rounded-lg hover:bg-red-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="font-medium text-red-900 truncate">{issueType}</div>
                    {task.points > 0 && (
                      <div className={`shrink-0 px-3 py-1 border rounded-full text-sm font-semibold ${getPointBadgeColor(task.points)}`}>
                        {task.points} pts
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-red-300 hover:bg-red-100"
                    onClick={() => {
                      setSelectedGameIssue(task);
                      setShowGameIssueDialog(true);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Game Issue Detail Dialog */}
      <Dialog open={showGameIssueDialog} onOpenChange={setShowGameIssueDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-900">{selectedGameIssue?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedGameIssue?.description && (
              <div className="text-sm text-gray-700 whitespace-pre-line p-4 bg-gray-50 rounded-lg">
                {selectedGameIssue.description.replace(/<[^>]*>/g, '')}
              </div>
            )}
            {selectedGameIssue && selectedGameIssue.points > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Points for resolving:</span>
                <div className={`px-3 py-1 border rounded-full text-sm font-semibold ${getPointBadgeColor(selectedGameIssue.points)}`}>
                  {selectedGameIssue.points} pts
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowGameIssueDialog(false)}
            >
              Close
            </Button>
            <Button
              variant="default"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (selectedGameIssue) {
                  handleCompleteTask(selectedGameIssue.id, selectedGameIssue.points);
                  setShowGameIssueDialog(false);
                }
              }}
              disabled={selectedGameIssue ? completingTaskId === selectedGameIssue.id : false}
            >
              {selectedGameIssue && completingTaskId === selectedGameIssue.id ? (
                <>
                  <Clock className="h-4 w-4 mr-1 animate-spin" />
                  Resolving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Resolve Issue
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <div key={index} className="flex items-start gap-3 p-3 border rounded hover:bg-accent/50 transition-colors">
                {/* Activity icon (v1.5.9) */}
                <div className="mt-1">
                  {getActivityIcon(activity.type)}
                </div>

                {/* Activity details */}
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    <span className="font-semibold">{activity.nickname || activity.staff_name}</span>
                    {' '}
                    <span className="text-muted-foreground">{activity.action}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTimeAgo(activity.timestamp)}
                  </p>
                </div>

                {/* Points earned (v1.5.9 - made more compact in v1.5.20) */}
                {activity.points_earned && activity.points_earned > 0 && (
                  <div className="flex items-center gap-0.5 text-xs font-semibold text-yellow-600 flex-shrink-0">
                    <Star className="h-3.5 w-3.5 fill-yellow-500" />
                    <span>+{activity.points_earned.toLocaleString()}</span>
                  </div>
                )}
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

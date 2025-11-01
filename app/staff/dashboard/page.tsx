'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, GamepadIcon, TrendingUp, ArrowLeft } from 'lucide-react';
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

export default function StaffDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [priorityActions, setPriorityActions] = useState<PriorityAction[]>([]);
  const [gamesWithIssues, setGamesWithIssues] = useState<GameWithIssue[]>([]); // v1.2.0
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // v1.2.0: Added games with issues fetch
      const [statsRes, actionsRes, issuesRes, activityRes] = await Promise.all([
        fetch('/api/staff/dashboard/stats'),
        fetch('/api/staff/dashboard/priority-actions?limit=5'),
        fetch('/api/content-checks/needs-attention'),
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
            <h1 className="text-3xl font-bold">Staff Dashboard</h1>
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
          <h1 className="text-3xl font-bold">Staff Dashboard</h1>
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

      {/* v1.2.0: Games Needing Attention */}
      {gamesWithIssues.length > 0 && (
        <Card className="p-6 border-red-200 bg-red-50/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-red-700">⚠️ Games Needing Attention</h2>
            <span className="text-sm text-red-600 font-medium">{gamesWithIssues.length} issue{gamesWithIssues.length !== 1 ? 's' : ''}</span>
          </div>
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
        </Card>
      )}

      {/* Priority Actions */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Priority Actions</h2>
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
      </Card>

      {/* Recent Activity */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
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
      </Card>
      </div>
    </div>
  );
}

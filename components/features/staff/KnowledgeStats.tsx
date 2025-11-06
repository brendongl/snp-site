'use client';

import Link from 'next/link';
import { BookOpen, TrendingUp, Users, CheckCircle, Activity, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface StaffStats {
  totalKnowledge: number;
  knowledgeByLevel: {
    beginner: number;
    intermediate: number;
    expert: number;
    instructor: number;
  };
  canTeachCount: number;
  totalPlayLogs: number;
  totalContentChecks: number;
  lastContentCheckDate: string | null;
}

interface KnowledgeStatsProps {
  staffId: string;
  stats: StaffStats;
}

export function KnowledgeStats({ staffId, stats }: KnowledgeStatsProps) {
  // Format date to readable format
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Never';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Knowledge Card */}
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Games Known</p>
              <p className="text-3xl font-bold">{stats.totalKnowledge}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
          </div>
        </Card>

        {/* Can Teach Card */}
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Can Teach</p>
              <p className="text-3xl font-bold">{stats.canTeachCount}</p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg">
              <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Expert & Instructor level games
          </p>
        </Card>

        {/* Play Logs Card */}
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Play Logs</p>
              <p className="text-3xl font-bold">{stats.totalPlayLogs}</p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Total play sessions logged
          </p>
        </Card>

        {/* Content Checks Card */}
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Content Checks</p>
              <p className="text-3xl font-bold">{stats.totalContentChecks}</p>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <CheckCircle className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Last check: {formatDate(stats.lastContentCheckDate)}
          </p>
        </Card>

        {/* Knowledge by Level Card */}
        <Card className="p-4 md:col-span-2">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Knowledge by Level</p>
            </div>
            <div className="p-3 bg-indigo-500/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
              <span className="text-sm font-medium">Beginner</span>
              <span className="text-lg font-bold">{stats.knowledgeByLevel.beginner}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <span className="text-sm font-medium">Intermediate</span>
              <span className="text-lg font-bold">{stats.knowledgeByLevel.intermediate}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950 rounded-lg">
              <span className="text-sm font-medium">Expert</span>
              <span className="text-lg font-bold">{stats.knowledgeByLevel.expert}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <span className="text-sm font-medium">Instructor</span>
              <span className="text-lg font-bold">{stats.knowledgeByLevel.instructor}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* My Game Knowledge - Link to Gallery */}
      <Card className="p-4">
        <Link
          href="/games?knowledgeFilter=unknown"
          className="w-full flex items-center justify-between text-left hover:bg-muted/50 -m-4 p-4 rounded-lg transition-colors group"
        >
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              My Game Knowledge
              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </h3>
            <p className="text-sm text-muted-foreground">
              View games you haven't learned yet
            </p>
          </div>
        </Link>
      </Card>
    </div>
  );
}

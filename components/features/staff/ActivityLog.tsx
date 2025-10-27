'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, FileText, Loader2, AlertCircle, Package, Activity, Users, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { ChangelogEntry } from '@/types';

interface ActivityLogProps {
  staffId: string;
}

export function ActivityLog({ staffId }: ActivityLogProps) {
  const [logs, setLogs] = useState<ChangelogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/changelog?staffId=${staffId}&limit=50`);

        if (!response.ok) {
          throw new Error(`Failed to fetch activity: ${response.statusText}`);
        }

        const data = await response.json();
        setLogs(data.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load activity');
        setLogs([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (staffId) {
      fetchActivity();
    }
  }, [staffId]);

  // Format timestamp as relative time
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  // Get icon for event type
  const getEventIcon = (eventType: string, category: string) => {
    if (eventType === 'photo_added') {
      return <FileText className="w-4 h-4" />;
    }

    switch (category) {
      case 'board_game':
        return <Package className="w-4 h-4" />;
      case 'play_log':
        return <Activity className="w-4 h-4" />;
      case 'staff_knowledge':
        return <Users className="w-4 h-4" />;
      case 'content_check':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  // Get badge color for event type
  const getEventBadgeColor = (eventType: string): string => {
    const colors = {
      created: 'bg-green-500/10 text-green-600 dark:text-green-400',
      updated: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      deleted: 'bg-red-500/10 text-red-600 dark:text-red-400',
      photo_added: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    };
    return colors[eventType as keyof typeof colors] || 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
  };

  // Get badge color for category
  const getCategoryBadgeColor = (category: string): string => {
    const colors = {
      board_game: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
      play_log: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      staff_knowledge: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
      content_check: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    };
    return colors[category as keyof typeof colors] || 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
  };

  // Format event type for display
  const formatEventType = (eventType: string): string => {
    return eventType.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Format category for display
  const formatCategory = (category: string): string => {
    return category.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading activity...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-lg flex items-start gap-2">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Error loading activity</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
        <p className="text-muted-foreground">No activity recorded yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Your actions on games, play logs, and content checks will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <Card key={log.id} className="p-4 hover:bg-muted/50 transition-colors">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className={`p-2 rounded-lg ${getCategoryBadgeColor(log.category)}`}>
              {getEventIcon(log.event_type, log.category)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Header: Description and Time */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-medium text-foreground leading-snug">
                  {log.description}
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  <span>{formatRelativeTime(log.created_at)}</span>
                </div>
              </div>

              {/* Badges: Event Type and Category */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${getEventBadgeColor(log.event_type)}`}>
                  {formatEventType(log.event_type)}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${getCategoryBadgeColor(log.category)}`}>
                  {formatCategory(log.category)}
                </span>

                {/* Entity Name (if it's a board game, make it a link) */}
                {log.category === 'board_game' && log.entity_id && (
                  <Link
                    href={`/games?search=${encodeURIComponent(log.entity_name)}`}
                    className="text-xs text-primary hover:underline"
                  >
                    View game
                  </Link>
                )}
              </div>
            </div>
          </div>
        </Card>
      ))}

      {/* Show message if there are more entries */}
      {logs.length >= 50 && (
        <div className="text-center pt-4 pb-2">
          <p className="text-sm text-muted-foreground">
            Showing 50 most recent activities
          </p>
        </div>
      )}
    </div>
  );
}

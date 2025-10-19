'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, User, Play, Zap } from 'lucide-react';

interface PlayLogEntry {
  id: string;
  gameId: string;
  gameName: string;
  playedBy: string;
  playDate: string;
  duration?: string;
  playerCount?: number;
  notes?: string;
}

export default function PlayLogsPage() {
  const router = useRouter();
  const [staffName, setStaffName] = useState<string | null>(null);
  const [playLogs, setPlayLogs] = useState<PlayLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'game'>('recent');

  // Check authentication
  useEffect(() => {
    const name = localStorage.getItem('staff_name');
    if (!name) {
      router.push('/auth/signin');
      return;
    }
    setStaffName(name);
  }, [router]);

  // Fetch play log data
  useEffect(() => {
    if (!staffName) return;

    const fetchPlayLogs = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/play-logs');

        if (!response.ok) {
          throw new Error(`Failed to fetch play logs: ${response.statusText}`);
        }

        const data = await response.json();
        setPlayLogs(Array.isArray(data.logs) ? data.logs : data.logs?.games || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load play logs');
        setPlayLogs([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayLogs();
  }, [staffName]);

  // Sort play logs
  const sortedLogs = [...playLogs].sort((a, b) => {
    if (sortBy === 'recent') {
      return new Date(b.playDate || 0).getTime() - new Date(a.playDate || 0).getTime();
    } else {
      return (a.gameName || '').localeCompare(b.gameName || '');
    }
  });

  const getStatusColor = (date?: string) => {
    if (!date) return 'text-gray-400';
    const daysSince = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince === 0) return 'text-green-600';
    if (daysSince <= 7) return 'text-blue-600';
    return 'text-gray-600';
  };

  const formatDate = (date?: string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/games?staff=true" className="inline-flex items-center gap-2 text-primary hover:text-primary/80">
              <ArrowLeft className="w-4 h-4" />
              Back to Games
            </Link>
          </div>
          <div>
            <h1 className="text-3xl font-bold">Play Logs</h1>
            <p className="text-muted-foreground mt-2">
              {staffName && `Logged in as ${staffName}`}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Controls */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="text-sm font-medium">Sort by:</label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'recent' | 'game')}
              className="px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
            >
              <option value="recent">Most Recent</option>
              <option value="game">Game Name</option>
            </select>
          </div>
          <p className="text-sm text-muted-foreground">
            {sortedLogs.length} play log{sortedLogs.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-2">
              <Zap className="w-5 h-5 animate-spin" />
              <span>Loading play logs...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-destructive/10 text-destructive rounded-lg p-4 mb-6">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && sortedLogs.length === 0 && (
          <div className="text-center py-12">
            <Play className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No play logs recorded yet</p>
          </div>
        )}

        {/* Play Logs List */}
        {!isLoading && !error && sortedLogs.length > 0 && (
          <div className="space-y-4">
            {sortedLogs.map((log) => (
              <div
                key={log.id}
                className="border border-border rounded-lg p-4 hover:bg-accent transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{log.gameName || 'Unknown Game'}</h3>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(log.playDate)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span>{log.playedBy || 'Unknown'}</span>
                      </div>
                      {log.playerCount && (
                        <div className="flex items-center gap-1">
                          <span>👥 {log.playerCount} player{log.playerCount !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {log.duration && (
                        <div className="flex items-center gap-1">
                          <span>⏱️ {log.duration}</span>
                        </div>
                      )}
                    </div>
                    {log.notes && (
                      <p className="mt-3 text-sm text-foreground bg-muted p-2 rounded">
                        {log.notes}
                      </p>
                    )}
                  </div>
                  <div className={`flex items-center gap-1 ${getStatusColor(log.playDate)}`}>
                    <Play className="w-5 h-5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

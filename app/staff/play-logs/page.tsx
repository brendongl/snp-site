'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, User, Play, Zap, Trash2, Edit2 } from 'lucide-react';
import { useAdminMode } from '@/lib/hooks/useAdminMode';

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
  const isAdmin = useAdminMode();
  const [staffName, setStaffName] = useState<string | null>(null);
  const [playLogs, setPlayLogs] = useState<PlayLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<{ notes: string; playDate: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  // Sort by most recent first
  const sortedLogs = [...playLogs].sort((a, b) => {
    return new Date(b.playDate || 0).getTime() - new Date(a.playDate || 0).getTime();
  });

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('Are you sure you want to delete this play log?')) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/play-logs?id=${logId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete play log');
      }

      setPlayLogs(playLogs.filter(log => log.id !== logId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete play log');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditLog = (log: PlayLogEntry) => {
    setEditingId(log.id);
    setEditingData({
      notes: log.notes || '',
      playDate: log.playDate || new Date().toISOString(),
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingData) return;

    try {
      setIsSaving(true);
      const response = await fetch(`/api/play-logs?id=${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update play log');
      }

      // Update local state
      setPlayLogs(playLogs.map(log =>
        log.id === editingId
          ? { ...log, notes: editingData.notes, playDate: editingData.playDate }
          : log
      ));

      setEditingId(null);
      setEditingData(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update play log');
    } finally {
      setIsSaving(false);
    }
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
        {/* Results count */}
        <div className="mb-6">
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

        {/* Play Logs List - Table Format */}
        {!isLoading && !error && sortedLogs.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className={`grid ${isAdmin ? 'grid-cols-12' : 'grid-cols-12'} bg-muted px-4 py-3 gap-4 font-semibold text-sm sticky top-0`}>
              <div className="col-span-2">Date</div>
              <div className="col-span-3">Game</div>
              <div className="col-span-2">Logged By</div>
              <div className={isAdmin ? 'col-span-3' : 'col-span-5'}>Notes</div>
              {isAdmin && <div className="col-span-2">Actions</div>}
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-border">
              {sortedLogs.map((log, idx) => (
                <div key={log.id}>
                  {editingId === log.id ? (
                    // Edit Mode
                    <div className={`grid grid-cols-12 px-4 py-3 gap-4 text-sm items-center ${
                      idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'
                    }`}>
                      <input
                        type="datetime-local"
                        value={editingData?.playDate?.split('T')[0] || ''}
                        onChange={(e) => setEditingData(prev => prev ? {
                          ...prev,
                          playDate: e.target.value
                        } : null)}
                        className="col-span-2 px-2 py-1 border border-border rounded text-xs bg-background"
                        disabled={isSaving}
                      />
                      <div className="col-span-3 text-sm">{log.gameName}</div>
                      <div className="col-span-2 text-sm">{log.playedBy}</div>
                      <textarea
                        value={editingData?.notes || ''}
                        onChange={(e) => setEditingData(prev => prev ? {
                          ...prev,
                          notes: e.target.value
                        } : null)}
                        className="col-span-3 px-2 py-1 border border-border rounded text-xs bg-background"
                        rows={2}
                        disabled={isSaving}
                      />
                      <div className="col-span-2 flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          disabled={isSaving}
                          className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditingData(null);
                          }}
                          disabled={isSaving}
                          className="px-2 py-1 bg-muted text-foreground rounded text-xs hover:bg-muted/80"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Normal View
                    <div
                      className={`grid grid-cols-12 px-4 py-3 gap-4 text-sm items-start hover:bg-accent transition-colors ${
                        idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'
                      }`}
                    >
                      <div className="col-span-2 font-medium">{formatDate(log.playDate)}</div>
                      <div className="col-span-3 font-medium text-foreground">{log.gameName || 'Unknown Game'}</div>
                      <div className="col-span-2 text-muted-foreground">{log.playedBy || 'Unknown'}</div>
                      <div className={`${isAdmin ? 'col-span-3' : 'col-span-5'} text-muted-foreground truncate`} title={log.notes}>
                        {log.notes || '—'}
                      </div>
                      {isAdmin && (
                        <div className="col-span-2 flex gap-2">
                          <button
                            onClick={() => handleEditLog(log)}
                            disabled={isDeleting || isSaving}
                            className="p-1 text-primary hover:bg-primary/10 rounded transition-colors disabled:opacity-50"
                            title="Edit play log"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            disabled={isDeleting || isSaving}
                            className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
                            title="Delete play log"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

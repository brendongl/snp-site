'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, User, Play, Zap, Trash2, Edit2, ChevronDown, ChevronRight } from 'lucide-react';
import { useAdminMode } from '@/lib/hooks/useAdminMode';
import PlayLogStats from '@/components/features/staff/PlayLogStats';

interface PlayLogEntry {
  id: string;
  gameId: string;
  gameName: string;
  staffName: string; // Changed from playedBy
  sessionDate: string; // Changed from playDate
  durationHours?: number | null;
  notes?: string | null;
}

interface GroupedLogs {
  date: string;
  dateFormatted: string;
  logs: PlayLogEntry[];
  gameCount: number;
  staffCount: number;
}

export default function PlayLogsPage() {
  const router = useRouter();
  const isAdmin = useAdminMode();
  const [staffName, setStaffName] = useState<string | null>(null);
  const [playLogs, setPlayLogs] = useState<PlayLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<{ notes: string; sessionDate: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // Filter state
  const [gameSearch, setGameSearch] = useState<string>('');
  const [staffFilter, setStaffFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');

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

  // Get unique staff names for filter dropdown
  const uniqueStaff = Array.from(new Set(playLogs.map(log => log.staffName))).sort();

  // Normalize name for comparison (case-insensitive, remove all spaces and hyphens)
  const normalizeName = (name: string | null | undefined): string => {
    if (!name) return '';
    return name.toLowerCase().trim().replace(/[\s\-–—]+/g, '');
  };

  // Check if current user can edit/delete a log (admin or log owner)
  const canEditLog = (log: PlayLogEntry): boolean => {
    if (isAdmin) return true;
    return normalizeName(log.staffName) === normalizeName(staffName);
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    return playLogs.filter(log => {
      // Game search filter
      if (gameSearch && !log.gameName.toLowerCase().includes(gameSearch.toLowerCase())) {
        return false;
      }
      // Staff filter
      if (staffFilter && log.staffName !== staffFilter) {
        return false;
      }
      // Date filter
      if (dateFilter) {
        const logDate = new Date(log.sessionDate).toISOString().split('T')[0];
        if (logDate !== dateFilter) {
          return false;
        }
      }
      return true;
    });
  }, [playLogs, gameSearch, staffFilter, dateFilter]);

  // Group logs by date
  const groupedLogs = useMemo(() => {
    const groups: Record<string, PlayLogEntry[]> = {};

    filteredLogs.forEach(log => {
      const date = new Date(log.sessionDate);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(log);
    });

    // Convert to array and calculate statistics
    const groupedArray: GroupedLogs[] = Object.entries(groups).map(([date, logs]) => {
      const dateObj = new Date(date);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });
      const dayNum = dateObj.getDate();

      const uniqueStaff = new Set(logs.map(log => log.staffName));

      return {
        date,
        dateFormatted: `${dayNum} ${dayName} ${monthName}`,
        logs: logs.sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime()),
        gameCount: logs.length,
        staffCount: uniqueStaff.size,
      };
    });

    // Sort by date descending
    return groupedArray.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredLogs]);

  const toggleDateExpansion = (date: string) => {
    setExpandedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

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
      sessionDate: log.sessionDate || new Date().toISOString(),
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
          ? { ...log, notes: editingData.notes, sessionDate: editingData.sessionDate }
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
    const dateObj = new Date(date);

    // Format date without year
    const datePart = dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    // Format time in 12-hour format with am/pm
    const timePart = dateObj.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).toLowerCase();

    return `${datePart} ${timePart}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/games" className="inline-flex items-center gap-2 text-primary hover:text-primary/80">
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
        {/* Statistics */}
        <div className="mb-8">
          <PlayLogStats />
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-3 items-center">
          {/* Game Search */}
          <input
            type="text"
            value={gameSearch}
            onChange={(e) => setGameSearch(e.target.value)}
            placeholder="Search games..."
            className="px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />

          {/* Staff Filter */}
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <option value="">All Staff</option>
            {uniqueStaff.map(staff => (
              <option key={staff} value={staff}>{staff}</option>
            ))}
          </select>

          {/* Date Filter */}
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
          />

          {/* Clear Filters */}
          {(gameSearch || staffFilter || dateFilter) && (
            <button
              onClick={() => {
                setGameSearch('');
                setStaffFilter('');
                setDateFilter('');
              }}
              className="px-3 py-2 rounded-lg text-sm bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Results count */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">
            {groupedLogs.length} day{groupedLogs.length !== 1 ? 's' : ''} • {filteredLogs.length} play log{filteredLogs.length !== 1 ? 's' : ''}
            {(gameSearch || staffFilter || dateFilter) && ` (filtered from ${playLogs.length} total)`}
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
        {!isLoading && !error && groupedLogs.length === 0 && (
          <div className="text-center py-12">
            <Play className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No play logs recorded yet</p>
          </div>
        )}

        {/* Play Logs List - Grouped by Date */}
        {!isLoading && !error && groupedLogs.length > 0 && (
          <div className="space-y-2">
            {groupedLogs.map((group) => {
              const isExpanded = expandedDates.has(group.date);

              return (
                <div key={group.date} className="border border-border rounded-lg overflow-hidden bg-white">
                  {/* Collapsed Row */}
                  <div
                    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleDateExpansion(group.date)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button className="text-muted-foreground hover:text-foreground transition-colors">
                        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </button>
                      <div className="font-semibold text-sm">{group.dateFormatted}</div>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded whitespace-nowrap">
                        🎲 {group.gameCount}
                      </span>
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded whitespace-nowrap">
                        👤 {group.staffCount}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t divide-y bg-gray-50">
                      {group.logs.map((log, idx) => (
                        <div key={log.id}>
                          {editingId === log.id ? (
                            // Edit Mode
                            <div className="px-4 py-3 bg-white">
                              <div className="grid grid-cols-12 gap-4 text-sm items-center">
                                <input
                                  type="datetime-local"
                                  value={editingData?.sessionDate || ''}
                                  onChange={(e) => setEditingData(prev => prev ? {
                                    ...prev,
                                    sessionDate: e.target.value
                                  } : null)}
                                  className="col-span-2 px-2 py-1 border border-border rounded text-xs bg-background"
                                  disabled={isSaving}
                                />
                                <div className="col-span-3 text-sm">{log.gameName}</div>
                                <div className="col-span-2 text-sm">{log.staffName}</div>
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
                            </div>
                          ) : (
                            // Normal View
                            <div className="px-4 py-3 hover:bg-gray-100 transition-colors">
                              <div className="grid grid-cols-12 gap-4 text-sm items-start">
                                <div className="col-span-2 text-muted-foreground">{formatDate(log.sessionDate)}</div>
                                <div className="col-span-3 font-medium">{log.gameName || 'Unknown Game'}</div>
                                <div className="col-span-2 text-muted-foreground">{log.staffName || 'Unknown'}</div>
                                <div className="col-span-3 text-muted-foreground truncate" title={log.notes || undefined}>
                                  {log.notes || '—'}
                                </div>
                                <div className="col-span-2 flex gap-2">
                                  {canEditLog(log) ? (
                                    <>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleEditLog(log); }}
                                        disabled={isDeleting || isSaving}
                                        className="p-1 text-primary hover:bg-primary/10 rounded transition-colors disabled:opacity-50"
                                        title="Edit play log"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteLog(log.id); }}
                                        disabled={isDeleting || isSaving}
                                        className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
                                        title="Delete play log"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

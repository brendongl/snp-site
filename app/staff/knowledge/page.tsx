'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Zap, ChevronDown, ChevronRight, ChevronLeft, Trash2, Edit2 } from 'lucide-react';
import { useAdminMode } from '@/lib/hooks/useAdminMode';

// Force dynamic rendering (no static generation)
export const dynamic = 'force-dynamic';

interface StaffKnowledgeEntry {
  id: string;
  staffMember: string;
  gameName: string;
  confidenceLevel: string;
  taughtBy: string | null;
  notes: string;
  canTeach: boolean;
}

interface GroupedGame {
  gameName: string;
  entries: StaffKnowledgeEntry[];
  totalPeople: number;
  canTeachCount: number;
}

const RECORDS_PER_PAGE = 20;
const CONFIDENCE_LEVELS = ['Beginner', 'Intermediate', 'Expert', 'Instructor'];

function KnowledgePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdmin = useAdminMode();
  const [staffName, setStaffName] = useState<string | null>(null);
  const [allKnowledge, setAllKnowledge] = useState<StaffKnowledgeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConfidence, setSelectedConfidence] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [gameNameSearch, setGameNameSearch] = useState<string>('');
  const [showMyKnowledgeOnly, setShowMyKnowledgeOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<{ confidenceLevel: string; notes: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedGames, setExpandedGames] = useState<Set<string>>(new Set());

  // Check if coming from successful knowledge addition
  useEffect(() => {
    const fromAdd = searchParams?.get('fromAdd');
    if (fromAdd === 'true') {
      setShowMyKnowledgeOnly(true);
    }
  }, [searchParams]);

  // Check authentication
  useEffect(() => {
    const name = localStorage.getItem('staff_name');
    if (!name) {
      router.push('/auth/signin');
      return;
    }
    setStaffName(name);
  }, [router]);

  // Fetch staff knowledge data
  useEffect(() => {
    if (!staffName) return;

    const fetchKnowledge = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/staff-knowledge');

        if (!response.ok) {
          throw new Error(`Failed to fetch knowledge: ${response.statusText}`);
        }

        const data = await response.json();
        setAllKnowledge(data.knowledge || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load knowledge');
        setAllKnowledge([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchKnowledge();
  }, [staffName]);

  // Get unique staff members for dropdown (excluding current user)
  const uniqueStaff = useMemo(() => {
    const staffSet = new Set(allKnowledge.map(k => k.staffMember));
    const staffArray = Array.from(staffSet)
      .filter(name => normalizeName(name) !== normalizeName(staffName))
      .sort();
    return staffArray;
  }, [allKnowledge, staffName]);

  // Normalize name for comparison
  const normalizeName = (name: string | null | undefined): string => {
    if (!name) return '';
    return name.toLowerCase().trim().replace(/[\s\-–—]+/g, '');
  };

  // Determine view mode: grouped or list
  const isListView = showMyKnowledgeOnly || (selectedStaff !== null && selectedStaff !== '');

  // Filter and prepare data
  const processedData = useMemo(() => {
    let filtered = allKnowledge;

    // Filter by search
    if (gameNameSearch) {
      filtered = filtered.filter(k =>
        k.gameName.toLowerCase().includes(gameNameSearch.toLowerCase())
      );
    }

    // Filter by confidence level
    if (selectedConfidence) {
      filtered = filtered.filter(k => k.confidenceLevel === selectedConfidence);
    }

    // List view: Filter by specific staff or "My Knowledge Only"
    if (isListView) {
      if (showMyKnowledgeOnly) {
        const normalizedStaffName = normalizeName(staffName);
        filtered = filtered.filter(k => normalizeName(k.staffMember) === normalizedStaffName);
      } else if (selectedStaff) {
        filtered = filtered.filter(k => k.staffMember === selectedStaff);
      }

      // Sort by game name for list view
      return filtered.sort((a, b) => a.gameName.localeCompare(b.gameName));
    }

    // Grouped view: Group by game name
    const grouped = filtered.reduce((acc, entry) => {
      if (!acc[entry.gameName]) {
        acc[entry.gameName] = [];
      }
      acc[entry.gameName].push(entry);
      return acc;
    }, {} as Record<string, StaffKnowledgeEntry[]>);

    // Convert to array and calculate counts
    const groupedArray: GroupedGame[] = Object.entries(grouped).map(([gameName, entries]) => ({
      gameName,
      entries: entries.sort((a, b) => a.staffMember.localeCompare(b.staffMember)),
      totalPeople: entries.length,
      canTeachCount: entries.filter(e => e.canTeach).length,
    }));

    // Sort by game name
    return groupedArray.sort((a, b) => a.gameName.localeCompare(b.gameName));
  }, [allKnowledge, gameNameSearch, selectedConfidence, isListView, showMyKnowledgeOnly, selectedStaff, staffName]);

  // Pagination
  const totalPages = Math.ceil(
    (isListView ? (processedData as StaffKnowledgeEntry[]).length : (processedData as GroupedGame[]).length) / RECORDS_PER_PAGE
  );
  const startIndex = (currentPage - 1) * RECORDS_PER_PAGE;
  const paginatedData = Array.isArray(processedData)
    ? processedData.slice(startIndex, startIndex + RECORDS_PER_PAGE)
    : [];

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [showMyKnowledgeOnly, selectedConfidence, selectedStaff, gameNameSearch]);

  const toggleGameExpansion = (gameName: string) => {
    setExpandedGames(prev => {
      const newSet = new Set(prev);
      if (newSet.has(gameName)) {
        newSet.delete(gameName);
      } else {
        newSet.add(gameName);
      }
      return newSet;
    });
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this knowledge entry?')) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/staff-knowledge?id=${entryId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete knowledge entry');
      }

      setAllKnowledge(allKnowledge.filter(k => k.id !== entryId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete knowledge entry');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditEntry = (entry: StaffKnowledgeEntry) => {
    setEditingId(entry.id);
    setEditingData({
      confidenceLevel: entry.confidenceLevel,
      notes: entry.notes || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingData) return;

    try {
      setIsSaving(true);
      const response = await fetch(`/api/staff-knowledge?id=${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update knowledge entry');
      }

      // Update local state
      setAllKnowledge(allKnowledge.map(k =>
        k.id === editingId
          ? { ...k, confidenceLevel: editingData.confidenceLevel, notes: editingData.notes }
          : k
      ));

      setEditingId(null);
      setEditingData(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update knowledge entry');
    } finally {
      setIsSaving(false);
    }
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'Beginner':
        return 'text-blue-700 bg-blue-50';
      case 'Intermediate':
        return 'text-yellow-700 bg-yellow-50';
      case 'Expert':
        return 'text-green-700 bg-green-50';
      case 'Instructor':
        return 'text-purple-700 bg-purple-50';
      default:
        return 'text-gray-700 bg-gray-50';
    }
  };

  const canEditEntry = (entry: StaffKnowledgeEntry): boolean => {
    if (isAdmin) return true;
    return normalizeName(entry.staffMember) === normalizeName(staffName);
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
            <h1 className="text-3xl font-bold">Staff Game Knowledge</h1>
            <p className="text-muted-foreground mt-2">
              {staffName && `Logged in as ${staffName}`}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Game Name Search */}
            <input
              type="text"
              value={gameNameSearch}
              onChange={(e) => setGameNameSearch(e.target.value)}
              placeholder="Search games..."
              className="px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />

            {/* Staff Filter */}
            <select
              value={selectedStaff || ''}
              onChange={(e) => setSelectedStaff(e.target.value || null)}
              className="px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <option value="">All Staff</option>
              {uniqueStaff.map(staff => (
                <option key={staff} value={staff}>{staff}</option>
              ))}
            </select>

            {/* Confidence Level Filter */}
            <select
              value={selectedConfidence || ''}
              onChange={(e) => setSelectedConfidence(e.target.value || null)}
              className="px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <option value="">All Levels</option>
              {CONFIDENCE_LEVELS.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>

            {/* My Knowledge Only Checkbox */}
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="checkbox"
                checked={showMyKnowledgeOnly}
                onChange={(e) => setShowMyKnowledgeOnly(e.target.checked)}
                className="w-4 h-4 rounded cursor-pointer"
              />
              <span className="text-sm font-medium">My Knowledge Only</span>
            </label>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isListView
              ? `${(paginatedData as StaffKnowledgeEntry[]).length} record${(paginatedData as StaffKnowledgeEntry[]).length !== 1 ? 's' : ''}`
              : `${(paginatedData as GroupedGame[]).length} game${(paginatedData as GroupedGame[]).length !== 1 ? 's' : ''}`
            } — Page {currentPage} of {totalPages || 1}
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-2">
              <Zap className="w-5 h-5 animate-spin" />
              <span>Loading knowledge...</span>
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
        {!isLoading && !error && paginatedData.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {showMyKnowledgeOnly ? 'No knowledge entries for you' : 'No knowledge entries found'}
            </p>
          </div>
        )}

        {/* LIST VIEW */}
        {!isLoading && !error && isListView && paginatedData.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            {/* Table for larger screens */}
            <div className="hidden sm:block">
              <table className="w-full">
                <thead className="bg-muted border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold">Game</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold">Level</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold">Can Teach</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(paginatedData as StaffKnowledgeEntry[]).map((entry, idx) => (
                    <tr key={entry.id} className={`${idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'} hover:bg-accent transition-colors`}>
                      {editingId === entry.id ? (
                        // Edit Mode
                        <>
                          <td className="px-4 py-3 font-medium">{entry.gameName}</td>
                          <td className="px-4 py-3">
                            <select
                              value={editingData?.confidenceLevel || ''}
                              onChange={(e) => setEditingData(prev => prev ? { ...prev, confidenceLevel: e.target.value } : null)}
                              className="px-2 py-1 border border-border rounded text-sm bg-background"
                              disabled={isSaving}
                            >
                              {CONFIDENCE_LEVELS.map(level => (
                                <option key={level} value={level}>{level}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {entry.canTeach ? <span className="text-green-600 font-semibold">✓</span> : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={handleSaveEdit}
                                disabled={isSaving}
                                className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90 disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => { setEditingId(null); setEditingData(null); }}
                                disabled={isSaving}
                                className="px-2 py-1 bg-muted text-foreground rounded text-xs hover:bg-muted/80"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        // Normal View
                        <>
                          <td className="px-4 py-3 font-medium">{entry.gameName}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(entry.confidenceLevel)}`}>
                              {entry.confidenceLevel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {entry.canTeach ? <span className="text-green-600 font-semibold text-lg">✓</span> : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {canEditEntry(entry) && (
                              <div className="flex gap-1 justify-end">
                                <button
                                  onClick={() => handleEditEntry(entry)}
                                  disabled={isDeleting || isSaving}
                                  className="p-1 text-primary hover:bg-primary/10 rounded transition-colors disabled:opacity-50"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  disabled={isDeleting || isSaving}
                                  className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="block sm:hidden divide-y">
              {(paginatedData as StaffKnowledgeEntry[]).map((entry) => (
                <div key={entry.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm mb-2">{entry.gameName}</div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getConfidenceColor(entry.confidenceLevel)}`}>
                          {entry.confidenceLevel}
                        </span>
                        {entry.canTeach && <span className="text-green-600 font-semibold">✓ Can Teach</span>}
                      </div>
                    </div>
                    {canEditEntry(entry) && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditEntry(entry)}
                          className="p-2 text-primary hover:bg-primary/10 rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="p-2 text-destructive hover:bg-destructive/10 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GROUPED VIEW */}
        {!isLoading && !error && !isListView && paginatedData.length > 0 && (
          <div className="space-y-2">
            {(paginatedData as GroupedGame[]).map((group) => {
              const isExpanded = expandedGames.has(group.gameName);

              return (
                <div key={group.gameName} className="border border-border rounded-lg overflow-hidden bg-white">
                  {/* Collapsed Row */}
                  <div
                    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleGameExpansion(group.gameName)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button className="text-muted-foreground hover:text-foreground transition-colors">
                        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </button>
                      <div className="font-semibold text-sm truncate">{group.gameName}</div>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="px-2 py-1 bg-gray-100 rounded whitespace-nowrap">
                        {group.totalPeople} {group.totalPeople === 1 ? 'person' : 'people'}
                      </span>
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded whitespace-nowrap">
                        {group.canTeachCount} can teach
                      </span>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t divide-y bg-gray-50">
                      {group.entries.map((entry) => (
                        <div key={entry.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors">
                          <div className="flex items-center gap-3 flex-1">
                            <span className="text-sm text-muted-foreground w-32 truncate">
                              {normalizeName(entry.staffMember) === normalizeName(staffName) ? 'Myself' : entry.staffMember}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(entry.confidenceLevel)}`}>
                              {entry.confidenceLevel}
                            </span>
                            {entry.canTeach && <span className="text-green-600 font-semibold text-sm">✓</span>}
                          </div>
                          {canEditEntry(entry) && (
                            <div className="flex gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEditEntry(entry); }}
                                className="p-1 text-primary hover:bg-primary/10 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
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

        {/* Pagination */}
        {!isLoading && !error && paginatedData.length > 0 && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border rounded text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border rounded text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Zap className="w-8 h-8 mx-auto mb-2 animate-pulse text-blue-600" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <KnowledgePageContent />
    </Suspense>
  );
}

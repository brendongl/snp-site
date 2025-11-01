'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Zap, ChevronDown, ChevronRight, ChevronLeft, Trash2, Edit2, X } from 'lucide-react';
import { useAdminMode } from '@/lib/hooks/useAdminMode';
import { StaffMenu } from '@/components/features/staff/StaffMenu';

interface StaffKnowledgeEntry {
  id: string;
  staffMember: string;
  gameName: string;
  confidenceLevel: string;
  taughtBy: string | null;
  notes: string;
  canTeach: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface GroupedGame {
  gameName: string;
  entries: StaffKnowledgeEntry[];
  beginnerIntermediateCount: number;
  expertInstructorCount: number;
}

const RECORDS_PER_PAGE = 50;
const CONFIDENCE_LEVELS = ['Beginner', 'Intermediate', 'Expert', 'Instructor'];

export default function KnowledgePage() {
  const router = useRouter();
  const isAdmin = useAdminMode();
  const [staffName, setStaffName] = useState<string | null>(null);
  const [allKnowledge, setAllKnowledge] = useState<StaffKnowledgeEntry[]>([]);
  const [allGames, setAllGames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConfidenceLevels, setSelectedConfidenceLevels] = useState<Set<string>>(new Set());
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [gameNameSearch, setGameNameSearch] = useState<string>('');
  const [showKnowledgeGaps, setShowKnowledgeGaps] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<{ confidenceLevel: string; notes: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedGames, setExpandedGames] = useState<Set<string>>(new Set());

  // Check authentication and set default filter
  useEffect(() => {
    const name = localStorage.getItem('staff_name');
    if (!name) {
      router.push('/auth/signin');
      return;
    }
    setStaffName(name);

    // Only set default filter to logged-in user if NOT coming from add page
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const fromAdd = urlParams.get('fromAdd');
      if (fromAdd !== 'true') {
        // Set default filter to logged-in user's knowledge
        setSelectedStaff(name);
      }
    }
  }, [router]);

  // Fetch staff knowledge data and all games
  useEffect(() => {
    if (!staffName) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch knowledge data (force refresh if coming from add page)
        const timestamp = new Date().getTime();
        const cacheParam = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('fromAdd') === 'true'
          ? `?t=${timestamp}`
          : '';

        const knowledgeResponse = await fetch(`/api/staff-knowledge${cacheParam}`);
        if (!knowledgeResponse.ok) {
          throw new Error(`Failed to fetch knowledge: ${knowledgeResponse.statusText}`);
        }
        const knowledgeData = await knowledgeResponse.json();
        setAllKnowledge(knowledgeData.knowledge || []);

        // Fetch all games for knowledge gap analysis
        const gamesResponse = await fetch('/api/staff-knowledge?allGames=true');
        if (gamesResponse.ok) {
          const gamesData = await gamesResponse.json();
          setAllGames(gamesData.games || []);
        }

        // Restore scroll position if returning from add page
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const fromAdd = urlParams.get('fromAdd');
          if (fromAdd === 'true') {
            const savedScrollY = sessionStorage.getItem('knowledgeScrollPosition');
            if (savedScrollY) {
              setTimeout(() => {
                window.scrollTo({ top: parseInt(savedScrollY, 10), behavior: 'smooth' });
                sessionStorage.removeItem('knowledgeScrollPosition');
              }, 100);
            }
            // Clean up URL parameter
            window.history.replaceState({}, '', '/staff/knowledge');
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setAllKnowledge([]);
        setAllGames([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [staffName]);

  // Removed scroll listener to fix mobile jitter - using CSS-only sticky positioning now

  // Normalize name for comparison (must be before useMemo that uses it)
  const normalizeName = (name: string | null | undefined): string => {
    if (!name) return '';
    return name.toLowerCase().trim().replace(/[\s\-–—]+/g, '');
  };

  // Get unique staff members for dropdown (including current user)
  const uniqueStaff = useMemo(() => {
    const staffSet = new Set(allKnowledge.map(k => k.staffMember));
    const staffArray = Array.from(staffSet).sort();
    return staffArray;
  }, [allKnowledge]);

  // Get all unique game names for dropdown
  const uniqueGameNames = useMemo(() => {
    return [...allGames].sort();
  }, [allGames]);

  // Determine view mode (calculate here for external use, don't include in useMemo deps)
  const isListView = selectedStaff !== null && selectedStaff !== '';

  // Filter and prepare data
  const processedData = useMemo(() => {
    // Use the same logic to determine view mode
    const listViewMode = selectedStaff !== null && selectedStaff !== '';

    let filtered = allKnowledge;

    // Filter by search
    if (gameNameSearch) {
      filtered = filtered.filter(k =>
        k.gameName.toLowerCase().includes(gameNameSearch.toLowerCase())
      );
    }

    // Filter by confidence level(s)
    if (selectedConfidenceLevels.size > 0) {
      filtered = filtered.filter(k => selectedConfidenceLevels.has(k.confidenceLevel));
    }

    // List view: Filter by specific staff
    if (listViewMode) {
      if (selectedStaff) {
        filtered = filtered.filter(k => k.staffMember === selectedStaff);
      }

      // Sort by latest record (createdAt descending) for list view
      return filtered.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA; // Descending order (newest first)
      });
    }


    // Grouped view: Group by game name
    const grouped = filtered.reduce((acc, entry) => {
      if (!acc[entry.gameName]) {
        acc[entry.gameName] = [];
      }
      acc[entry.gameName].push(entry);
      return acc;
    }, {} as Record<string, StaffKnowledgeEntry[]>);

    // Apply Knowledge Gaps filter if enabled
    if (showKnowledgeGaps) {
      // Find games with no knowledge entries
      const gamesWithKnowledge = new Set(allKnowledge.map(k => k.gameName));
      const gapsOnly: Record<string, StaffKnowledgeEntry[]> = {};

      allGames.forEach(gameName => {
        if (!gamesWithKnowledge.has(gameName)) {
          // Include games with no knowledge entries
          gapsOnly[gameName] = [];
        }
      });

      // Replace grouped with ONLY gaps (clear existing)
      Object.keys(grouped).forEach(key => delete grouped[key]);
      Object.assign(grouped, gapsOnly);
    }

    // Convert to array and calculate counts
    let groupedArray: GroupedGame[] = Object.entries(grouped).map(([gameName, entries]) => ({
      gameName,
      entries: entries.sort((a, b) => a.staffMember.localeCompare(b.staffMember)),
      beginnerIntermediateCount: entries.filter(e =>
        e.confidenceLevel === 'Beginner' || e.confidenceLevel === 'Intermediate'
      ).length,
      expertInstructorCount: entries.filter(e =>
        e.confidenceLevel === 'Expert' || e.confidenceLevel === 'Instructor'
      ).length,
    }));

    // Sort by game name
    return groupedArray.sort((a, b) => a.gameName.localeCompare(b.gameName));
  }, [allKnowledge, allGames, gameNameSearch, selectedConfidenceLevels, selectedStaff, showKnowledgeGaps]);

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
  }, [selectedConfidenceLevels, selectedStaff, gameNameSearch, showKnowledgeGaps]);

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

  const toggleConfidenceLevel = (level: string) => {
    setSelectedConfidenceLevels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(level)) {
        newSet.delete(level);
      } else {
        newSet.add(level);
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
      {/* Back to Games - Always visible */}
      <div className="border-b border-border bg-card sticky top-0 z-[100]">
        <div className="container mx-auto px-4 py-3 max-w-6xl flex items-center justify-between">
          <Link href="/games" className="inline-flex items-center gap-2 text-primary hover:text-primary/80">
            <ArrowLeft className="w-4 h-4" />
            Back to Games
          </Link>
          <StaffMenu />
        </div>
      </div>

      {/* Main Header - Hides when scrolling */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <div>
            <h1 className="text-3xl font-bold">Staff Game Knowledge</h1>
            <p className="text-muted-foreground mt-2">
              {staffName && `Logged in as ${staffName}`}
            </p>
          </div>
        </div>
      </div>

      {/* Sticky Filters Header */}
      <div className="sticky top-[52px] bg-card border-b border-border z-[90]">
        <div className="container mx-auto px-4 py-2 max-w-6xl space-y-2">
          {/* Row 1: Game Search + Staff Filter */}
          <div className="flex gap-2">
            <input
              type="text"
              value={gameNameSearch}
              onChange={(e) => setGameNameSearch(e.target.value)}
              placeholder="Search games..."
              className="w-1/2 px-2 py-1.5 rounded-lg text-xs sm:text-sm border border-border bg-background text-foreground hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <select
              value={selectedStaff || ''}
              onChange={(e) => {
                setSelectedStaff(e.target.value || null);
                // Turn off knowledge gaps when switching staff members
                if (showKnowledgeGaps) {
                  setShowKnowledgeGaps(false);
                }
              }}
              className="w-1/2 px-2 py-1.5 rounded-lg text-xs sm:text-sm border border-border bg-background text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <option value="">All Staff</option>
              {uniqueStaff.map(staff => (
                <option key={staff} value={staff}>{staff}</option>
              ))}
            </select>
          </div>

          {/* Row 2: Confidence Levels */}
          <div className="flex gap-2">
            {CONFIDENCE_LEVELS.map(level => (
              <button
                key={level}
                onClick={() => toggleConfidenceLevel(level)}
                className={`flex-1 px-2 py-1 rounded-lg text-xs border transition-all ${
                  selectedConfidenceLevels.has(level)
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                }`}
              >
                {level}
              </button>
            ))}
          </div>

          {/* Row 3: Special Filters */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                const newValue = !showKnowledgeGaps;
                setShowKnowledgeGaps(newValue);
                if (newValue) {
                  // Clear other filters and set to All Staff
                  setSelectedStaff(null);
                  setSelectedConfidenceLevels(new Set());
                  setGameNameSearch('');
                }
              }}
              className={`flex-1 px-3 py-1 rounded-lg text-xs border transition-all ${
                showKnowledgeGaps
                  ? 'border-red-500 bg-red-50 text-red-700 font-medium'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
              }`}
            >
              📚 Knowledge Gaps
            </button>
            <Link
              href="/staff/learning-opportunities"
              className="flex-1 px-3 py-1 rounded-lg text-xs border border-border bg-background text-muted-foreground hover:bg-muted/50 transition-all text-center"
            >
              🎯 Learning Opportunities
            </Link>
          </div>

          {/* Small info text */}
          <div className="text-center">
            <span className="text-[10px] text-muted-foreground italic">* Experts & Instructors can teach</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 max-w-6xl pt-4">

        {/* Results Count */}
        <div className="mb-6 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {isListView ? (
              <p>
                {(paginatedData as StaffKnowledgeEntry[]).length} record{(paginatedData as StaffKnowledgeEntry[]).length !== 1 ? 's' : ''} — Page {currentPage} of {totalPages || 1}
              </p>
            ) : (
              <div>
                <p>
                  {(paginatedData as GroupedGame[]).length} game{(paginatedData as GroupedGame[]).length !== 1 ? 's' : ''} — Page {currentPage} of {totalPages || 1}
                </p>
                {!gameNameSearch && !showKnowledgeGaps && selectedConfidenceLevels.size === 0 && (
                  <p className="text-xs mt-1">
                    📊 Known: {new Set(allKnowledge.map(k => k.gameName)).size} out of {allGames.length} games
                    {' • '}
                    Can teach: {new Set(allKnowledge.filter(k => k.confidenceLevel === 'Expert' || k.confidenceLevel === 'Instructor').map(k => k.gameName)).size} games
                  </p>
                )}
              </div>
            )}
          </div>
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
            <p className="text-muted-foreground">No knowledge entries found</p>
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
                      </div>
                    </div>
                    {canEditEntry(entry) && (
                      <div className="flex gap-2 relative z-50">
                        <button
                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleEditEntry(entry); }}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-primary hover:bg-primary/10 rounded-lg touch-manipulation active:scale-95 transition-transform"
                          title="Edit"
                          type="button"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDeleteEntry(entry.id); }}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-destructive hover:bg-destructive/10 rounded-lg touch-manipulation active:scale-95 transition-transform"
                          title="Delete"
                          type="button"
                        >
                          <Trash2 className="w-5 h-5" />
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
                        👨‍👩‍👧‍👦 {group.beginnerIntermediateCount}
                      </span>
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded whitespace-nowrap">
                        🧙‍♂️ {group.expertInstructorCount}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t bg-gray-50">
                      {/* Game Gallery Link */}
                      <div className="px-4 py-2 border-b bg-gray-100">
                        <Link
                          href="/games"
                          className="text-xs text-primary hover:text-primary/80 underline inline-flex items-center gap-1"
                          title={`View ${group.gameName} in Game Gallery`}
                        >
                          View in Game Gallery →
                        </Link>
                      </div>

                      {/* Staff Knowledge Entries */}
                      <div className="divide-y">
                        {group.entries.map((entry) => (
                          <div key={entry.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors">
                            <div className="flex items-center gap-3 flex-1">
                              <span className="text-sm text-muted-foreground">
                                {normalizeName(entry.staffMember) === normalizeName(staffName) ? 'Myself' : entry.staffMember}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(entry.confidenceLevel)}`}>
                                {entry.confidenceLevel}
                              </span>
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

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Zap, ChevronLeft, ChevronRight, Trash2, Edit2 } from 'lucide-react';
import { useAdminMode } from '@/lib/hooks/useAdminMode';

interface StaffKnowledgeEntry {
  id: string;
  staffMember: string;
  gameName: string;
  confidenceLevel: string;
  taughtBy: string | null;
  notes: string;
  canTeach: boolean;
}

const RECORDS_PER_PAGE = 20;
const CONFIDENCE_LEVELS = ['Beginner', 'Intermediate', 'Expert', 'Instructor'];

export default function KnowledgePage() {
  const router = useRouter();
  const isAdmin = useAdminMode();
  const [staffName, setStaffName] = useState<string | null>(null);
  const [allKnowledge, setAllKnowledge] = useState<StaffKnowledgeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConfidence, setSelectedConfidence] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [gameNameSearch, setGameNameSearch] = useState<string>('');
  const [showMyKnowledgeOnly, setShowMyKnowledgeOnly] = useState(true); // Default to true
  const [currentPage, setCurrentPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<{ confidenceLevel: string; notes: string } | null>(null);
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

  // Get unique staff members for dropdown
  const uniqueStaff = Array.from(new Set(allKnowledge.map(k => k.staffMember))).sort();

  // Normalize name for comparison (case-insensitive, remove all spaces and hyphens)
  const normalizeName = (name: string | null | undefined): string => {
    if (!name) return '';
    return name.toLowerCase().trim().replace(/[\s\-–—]+/g, '');
  };

  // Filter and sort knowledge
  const filteredAndSortedKnowledge = (() => {
    let filtered = allKnowledge;

    // Filter to current user if toggle is on
    if (showMyKnowledgeOnly && staffName) {
      const normalizedStaffName = normalizeName(staffName);
      filtered = filtered.filter(k => normalizeName(k.staffMember) === normalizedStaffName);
    }

    // Filter by selected staff member
    if (selectedStaff) {
      filtered = filtered.filter(k => k.staffMember === selectedStaff);
    }

    // Filter by game name search (partial match, case-insensitive)
    if (gameNameSearch) {
      filtered = filtered.filter(k =>
        k.gameName.toLowerCase().includes(gameNameSearch.toLowerCase())
      );
    }

    // Filter by selected confidence level
    if (selectedConfidence) {
      filtered = filtered.filter(k => k.confidenceLevel === selectedConfidence);
    }

    // Default sort by game name
    const sorted = [...filtered].sort((a, b) => {
      return (a.gameName || '').localeCompare(b.gameName || '');
    });

    return sorted;
  })();

  // Calculate pagination
  const totalPages = Math.ceil(filteredAndSortedKnowledge.length / RECORDS_PER_PAGE);
  const startIndex = (currentPage - 1) * RECORDS_PER_PAGE;
  const paginatedKnowledge = filteredAndSortedKnowledge.slice(startIndex, startIndex + RECORDS_PER_PAGE);

  // Reset to page 1 when filtering changes
  useEffect(() => {
    setCurrentPage(1);
  }, [showMyKnowledgeOnly, selectedConfidence, selectedStaff, gameNameSearch]);

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
        {/* Controls */}
        <div className="mb-6 space-y-4">
          {/* Filters and Sort */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Game Name Search Input */}
            <input
              type="text"
              value={gameNameSearch}
              onChange={(e) => setGameNameSearch(e.target.value)}
              placeholder="Search games..."
              className="px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />

            {/* Staff Filter Dropdown */}
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

            {/* Confidence Level Filter Dropdown */}
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
            <label className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="checkbox"
                checked={showMyKnowledgeOnly}
                onChange={(e) => setShowMyKnowledgeOnly(e.target.checked)}
                className="w-4 h-4 rounded cursor-pointer"
              />
              My Knowledge Only
            </label>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredAndSortedKnowledge.length} record{filteredAndSortedKnowledge.length !== 1 ? 's' : ''}
            {showMyKnowledgeOnly ? ' of your knowledge' : ''} — Showing page {currentPage} of {totalPages || 1}
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
        {!isLoading && !error && filteredAndSortedKnowledge.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {showMyKnowledgeOnly ? 'No knowledge entries for you' : 'No knowledge entries found'}
            </p>
          </div>
        )}

        {/* Knowledge Table */}
        {!isLoading && !error && filteredAndSortedKnowledge.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 bg-muted px-4 py-3 gap-4 font-semibold text-sm sticky top-0">
              <div className="col-span-2">Game</div>
              <div className="col-span-2">Staff Member</div>
              <div className="col-span-2">Confidence Level</div>
              <div className="col-span-2">Was Taught By</div>
              <div className="col-span-1">Can Teach</div>
              <div className="col-span-1">Notes</div>
              <div className="col-span-1">Actions</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-border">
              {paginatedKnowledge.map((entry, idx) => (
                <div key={entry.id}>
                  {editingId === entry.id ? (
                    // Edit Mode
                    <div className={`grid grid-cols-12 px-4 py-3 gap-4 text-sm items-center ${
                      idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'
                    }`}>
                      <div className="col-span-2 text-sm">{entry.gameName}</div>
                      <div className="col-span-2 text-sm">{normalizeName(entry.staffMember) === normalizeName(staffName) ? 'Myself' : entry.staffMember}</div>
                      <select
                        value={editingData?.confidenceLevel || ''}
                        onChange={(e) => setEditingData(prev => prev ? {
                          ...prev,
                          confidenceLevel: e.target.value
                        } : null)}
                        className="col-span-2 px-2 py-1 border border-border rounded text-xs bg-background"
                        disabled={isSaving}
                      >
                        {CONFIDENCE_LEVELS.map(level => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                      <div className="col-span-2 text-sm">{entry.taughtBy || '—'}</div>
                      <div className="col-span-1">
                        {entry.canTeach ? (
                          <span className="text-green-600 font-semibold">✓</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                      <textarea
                        value={editingData?.notes || ''}
                        onChange={(e) => setEditingData(prev => prev ? {
                          ...prev,
                          notes: e.target.value
                        } : null)}
                        className="col-span-1 px-2 py-1 border border-border rounded text-xs bg-background"
                        rows={2}
                        disabled={isSaving}
                      />
                      <div className="col-span-1 flex gap-1">
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
                      className={`grid grid-cols-12 px-4 py-3 gap-4 text-sm items-center hover:bg-accent transition-colors ${
                        idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'
                      }`}
                    >
                      <div className="col-span-2 font-medium truncate" title={entry.gameName}>
                        {entry.gameName}
                      </div>
                      <div className="col-span-2 text-muted-foreground">
                        {normalizeName(entry.staffMember) === normalizeName(staffName) ? 'Myself' : entry.staffMember}
                      </div>
                      <div className="col-span-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(entry.confidenceLevel)}`}>
                          {entry.confidenceLevel}
                        </span>
                      </div>
                      <div className="col-span-2 text-muted-foreground truncate" title={entry.taughtBy || 'Not specified'}>
                        {entry.taughtBy || '—'}
                      </div>
                      <div className="col-span-1">
                        {entry.canTeach ? (
                          <span className="text-green-600 font-semibold">✓</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                      <div className="col-span-1 text-muted-foreground truncate" title={entry.notes}>
                        {entry.notes || '—'}
                      </div>
                      <div className="col-span-1 flex gap-1">
                        {(isAdmin || entry.staffMember === staffName) ? (
                          <>
                            <button
                              onClick={() => handleEditEntry(entry)}
                              disabled={isDeleting || isSaving}
                              className="p-1 text-primary hover:bg-primary/10 rounded transition-colors disabled:opacity-50"
                              title="Edit entry"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteEntry(entry.id)}
                              disabled={isDeleting || isSaving}
                              className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
                              title="Delete entry"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-4 border-t border-border bg-muted/30">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/50 transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

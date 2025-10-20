'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Zap, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [staffName, setStaffName] = useState<string | null>(null);
  const [allKnowledge, setAllKnowledge] = useState<StaffKnowledgeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'staff' | 'confidence'>('staff');
  const [selectedConfidence, setSelectedConfidence] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [selectedGameName, setSelectedGameName] = useState<string | null>(null);
  const [showMyKnowledgeOnly, setShowMyKnowledgeOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

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

  // Get unique staff members and game names for dropdowns
  const uniqueStaff = Array.from(new Set(allKnowledge.map(k => k.staffMember))).sort();
  const uniqueGameNames = Array.from(new Set(allKnowledge.map(k => k.gameName))).sort();

  // Filter and sort knowledge
  const filteredAndSortedKnowledge = (() => {
    let filtered = allKnowledge;

    // Filter to current user if toggle is on
    if (showMyKnowledgeOnly && staffName) {
      filtered = filtered.filter(k => k.staffMember === staffName);
    }

    // Filter by selected staff member
    if (selectedStaff) {
      filtered = filtered.filter(k => k.staffMember === selectedStaff);
    }

    // Filter by selected game name
    if (selectedGameName) {
      filtered = filtered.filter(k => k.gameName === selectedGameName);
    }

    // Filter by selected confidence level (not removed, just moving to filtering not sorting)
    if (selectedConfidence) {
      filtered = filtered.filter(k => k.confidenceLevel === selectedConfidence);
    }

    // Sort based on selected sort option
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'confidence') {
        const confidenceOrder = { 'Beginner': 0, 'Intermediate': 1, 'Expert': 2, 'Instructor': 3 };
        return (confidenceOrder[a.confidenceLevel as keyof typeof confidenceOrder] || 0) -
               (confidenceOrder[b.confidenceLevel as keyof typeof confidenceOrder] || 0);
      }
      // Default: sort by staff member
      return (a.staffMember || '').localeCompare(b.staffMember || '');
    });

    return sorted;
  })();

  // Calculate pagination
  const totalPages = Math.ceil(filteredAndSortedKnowledge.length / RECORDS_PER_PAGE);
  const startIndex = (currentPage - 1) * RECORDS_PER_PAGE;
  const paginatedKnowledge = filteredAndSortedKnowledge.slice(startIndex, startIndex + RECORDS_PER_PAGE);

  // Reset to page 1 when filtering or sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, showMyKnowledgeOnly, selectedConfidence, selectedStaff, selectedGameName]);

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
            <Link href="/games?staff=true" className="inline-flex items-center gap-2 text-primary hover:text-primary/80">
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
            {/* Game Name Filter Dropdown */}
            <select
              value={selectedGameName || ''}
              onChange={(e) => setSelectedGameName(e.target.value || null)}
              className="px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <option value="">All Games</option>
              {uniqueGameNames.map(game => (
                <option key={game} value={game}>{game}</option>
              ))}
            </select>

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

            {/* Sort By Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'staff' | 'confidence')}
              className="px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <option value="staff">Sort by Staff</option>
              <option value="confidence">Sort by Level</option>
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
              <div className="col-span-3">Notes</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-border">
              {paginatedKnowledge.map((entry, idx) => (
                <div
                  key={entry.id}
                  className={`grid grid-cols-12 px-4 py-3 gap-4 text-sm items-center hover:bg-accent transition-colors ${
                    idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'
                  }`}
                >
                  <div className="col-span-2 font-medium truncate" title={entry.gameName}>
                    {entry.gameName}
                  </div>
                  <div className="col-span-2 text-muted-foreground">
                    {entry.staffMember}
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
                  <div className="col-span-3 text-muted-foreground truncate" title={entry.notes}>
                    {entry.notes || '—'}
                  </div>
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

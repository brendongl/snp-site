'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Zap, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { useAdminMode } from '@/lib/hooks/useAdminMode';
import { EditContentCheckDialog } from '@/components/features/content-check/EditContentCheckDialog';
import { Button } from '@/components/ui/button';
import type { ContentCheck } from '@/types';

interface ContentCheckEntry {
  id: string;
  gameId: string;
  gameName: string;
  checkDate: string;
  inspector: string;
  status: string;
  notes: string;
  boxCondition?: string | null;
  cardCondition?: string | null;
  missingPieces?: boolean;
  sleeved?: boolean;
  boxWrapped?: boolean;
  isFake?: boolean;
}

const RECORDS_PER_PAGE = 20;
const STATUSES = ['Perfect Condition', 'Minor Issues', 'Major Issues', 'Unplayable'];

export default function CheckHistoryPage() {
  const router = useRouter();
  const isAdmin = useAdminMode();
  const [staffName, setStaffName] = useState<string | null>(null);
  const [allChecks, setAllChecks] = useState<ContentCheckEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'staff'>('recent');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [showMyChecksOnly, setShowMyChecksOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingCheck, setEditingCheck] = useState<ContentCheck | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Check authentication
  useEffect(() => {
    const name = localStorage.getItem('staff_name');
    if (!name) {
      router.push('/auth/signin');
      return;
    }
    setStaffName(name);
  }, [router]);

  // Fetch content check data
  useEffect(() => {
    if (!staffName) return;

    const fetchChecks = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/content-checks-detailed');

        if (!response.ok) {
          throw new Error(`Failed to fetch content checks: ${response.statusText}`);
        }

        const data = await response.json();
        setAllChecks(data.checks || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load content checks');
        setAllChecks([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChecks();
  }, [staffName]);

  // Get unique staff members for dropdown
  const uniqueStaff = Array.from(new Set(allChecks.map(c => c.inspector))).sort();

  // Filter and sort checks
  const filteredAndSortedChecks = (() => {
    let filtered = allChecks;

    // Filter to current user if toggle is on
    if (showMyChecksOnly && staffName) {
      filtered = filtered.filter(check => check.inspector === staffName);
    }

    // Filter by selected staff member
    if (selectedStaff) {
      filtered = filtered.filter(check => check.inspector === selectedStaff);
    }

    // Filter by selected status
    if (selectedStatus) {
      filtered = filtered.filter(check => check.status === selectedStatus);
    }

    // Sort based on selected option
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.checkDate).getTime() - new Date(a.checkDate).getTime();
      } else if (sortBy === 'staff') {
        return (a.inspector || '').localeCompare(b.inspector || '');
      }
      return 0;
    });

    return sorted;
  })();

  // Calculate pagination
  const totalPages = Math.ceil(filteredAndSortedChecks.length / RECORDS_PER_PAGE);
  const startIndex = (currentPage - 1) * RECORDS_PER_PAGE;
  const paginatedChecks = filteredAndSortedChecks.slice(startIndex, startIndex + RECORDS_PER_PAGE);

  // Reset to page 1 when filtering or sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, showMyChecksOnly, selectedStatus, selectedStaff]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Perfect Condition':
        return 'text-green-700 bg-green-50';
      case 'Minor Issues':
        return 'text-yellow-700 bg-yellow-50';
      case 'Major Issues':
        return 'text-orange-700 bg-orange-50';
      case 'Unplayable':
        return 'text-red-700 bg-red-50';
      default:
        return 'text-gray-700 bg-gray-50';
    }
  };

  const formatDate = (date: string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleEdit = (check: ContentCheckEntry) => {
    // Convert ContentCheckEntry to ContentCheck format for the dialog
    const contentCheck: ContentCheck = {
      id: check.id,
      fields: {
        'Record ID': check.id,
        'Board Game': [check.gameId],
        'Inspector': [check.inspector],
        'Check Date': check.checkDate,
        'Status': check.status as 'Perfect Condition' | 'Minor Issues' | 'Major Issues' | 'Unplayable',
        'Notes': check.notes,
        'Box Condition': (check.boxCondition as 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Damaged' | undefined) || undefined,
        'Card Condition': (check.cardCondition as 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Damaged' | undefined) || undefined,
        'Missing Pieces': check.missingPieces ? 'Yes' : undefined,
        'Sleeved At Check': check.sleeved || false,
        'Box Wrapped At Check': check.boxWrapped || false,
      },
    };
    setEditingCheck(contentCheck);
    setShowEditDialog(true);
  };

  const handleDelete = async (checkId: string) => {
    if (!confirm('Are you sure you want to delete this content check? This action cannot be undone.')) {
      return;
    }

    setDeletingId(checkId);
    try {
      const response = await fetch(`/api/content-checks/${checkId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete content check');
      }

      // Refresh the checks list
      const refreshResponse = await fetch('/api/content-checks-detailed');
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        setAllChecks(data.checks || []);
      }
    } catch (error) {
      console.error('Error deleting content check:', error);
      alert('Failed to delete content check. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditSuccess = async () => {
    // Refresh the checks list after successful edit
    try {
      const response = await fetch('/api/content-checks-detailed');
      if (response.ok) {
        const data = await response.json();
        setAllChecks(data.checks || []);
      }
    } catch (error) {
      console.error('Error refreshing checks:', error);
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
            <h1 className="text-3xl font-bold">Content Check History</h1>
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
          {/* Sort Options */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Sort by Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('recent')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sortBy === 'recent'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Most Recent
              </button>
              <button
                onClick={() => setSortBy('staff')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sortBy === 'staff'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Sort by Staff
              </button>
            </div>

            {/* Staff Dropdown */}
            {sortBy === 'staff' && (
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
            )}

            {/* Status Filter Dropdown */}
            <select
              value={selectedStatus || ''}
              onChange={(e) => setSelectedStatus(e.target.value || null)}
              className="px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <option value="">All Status</option>
              {STATUSES.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>

            {/* My Checks Only Checkbox */}
            <label className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="checkbox"
                checked={showMyChecksOnly}
                onChange={(e) => setShowMyChecksOnly(e.target.checked)}
                className="w-4 h-4 rounded cursor-pointer"
              />
              My Checks Only
            </label>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredAndSortedChecks.length} check{filteredAndSortedChecks.length !== 1 ? 's' : ''}
            {showMyChecksOnly ? ' by you' : ''} — Showing page {currentPage} of {totalPages || 1}
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-2">
              <Zap className="w-5 h-5 animate-spin" />
              <span>Loading checks...</span>
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
        {!isLoading && !error && filteredAndSortedChecks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {showMyChecksOnly ? 'No checks by you' : 'No content checks found'}
            </p>
          </div>
        )}

        {/* Content Checks Table */}
        {!isLoading && !error && filteredAndSortedChecks.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 bg-muted px-4 py-3 gap-4 font-semibold text-sm sticky top-0">
              <div className="col-span-3">Game</div>
              <div className="col-span-1.5">Date</div>
              <div className="col-span-2">Inspector</div>
              <div className="col-span-1.5">Status</div>
              <div className={isAdmin ? "col-span-3" : "col-span-4"}>Notes</div>
              {isAdmin && <div className="col-span-1">Actions</div>}
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-border">
              {paginatedChecks.map((check, idx) => (
                <div
                  key={check.id}
                  className={`grid grid-cols-12 px-4 py-3 gap-4 text-sm items-center hover:bg-accent transition-colors ${
                    idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'
                  }`}
                >
                  <div className="col-span-3 font-medium truncate" title={check.gameName}>
                    {check.gameName}
                  </div>
                  <div className="col-span-1.5 text-muted-foreground">
                    {formatDate(check.checkDate)}
                  </div>
                  <div className="col-span-2 text-muted-foreground">
                    {check.inspector}
                  </div>
                  <div className="col-span-1.5">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(check.status)}`}>
                      {check.status}
                    </span>
                  </div>
                  <div className={`${isAdmin ? 'col-span-3' : 'col-span-4'} text-muted-foreground truncate`} title={check.notes}>
                    {check.notes || '—'}
                  </div>
                  {isAdmin && (
                    <div className="col-span-1 flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(check)}
                        className="h-8 w-8 p-0"
                        title="Edit check"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(check.id)}
                        disabled={deletingId === check.id}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        title="Delete check"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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

      {/* Edit Dialog */}
      {editingCheck && (
        <EditContentCheckDialog
          open={showEditDialog}
          onClose={() => {
            setShowEditDialog(false);
            setEditingCheck(null);
          }}
          check={editingCheck}
          gameName={allChecks.find(c => c.id === editingCheck.id)?.gameName || 'Unknown Game'}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}

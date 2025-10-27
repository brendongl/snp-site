'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, User, Phone, AlertTriangle, Calendar, Zap, Search } from 'lucide-react';

interface DirectoryStats {
  totalKnowledge: number;
  totalPlayLogs: number;
  totalContentChecks: number;
}

interface DirectoryEntry {
  staffId: string;
  name: string;
  nickname: string;
  contactPh: string;
  emergencyContactName: string;
  emergencyContactPh: string;
  dateOfHire: string;
  stats: DirectoryStats;
}

export default function StaffDirectoryPage() {
  const router = useRouter();
  const [staffName, setStaffName] = useState<string | null>(null);
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter/Sort state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'knowledge' | 'playLogs' | 'checks' | 'hireDate'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Check authentication
  useEffect(() => {
    const name = localStorage.getItem('staff_name');
    if (!name) {
      router.push('/auth/signin');
      return;
    }
    setStaffName(name);
  }, [router]);

  // Fetch staff directory data
  useEffect(() => {
    if (!staffName) return;

    const fetchDirectory = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/staff/directory');

        if (!response.ok) {
          throw new Error(`Failed to fetch staff directory: ${response.statusText}`);
        }

        const data = await response.json();
        setDirectory(Array.isArray(data.staff) ? data.staff : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load staff directory');
        setDirectory([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDirectory();
  }, [staffName]);

  // Filter and sort staff
  const filteredAndSortedStaff = useMemo(() => {
    let filtered = [...directory];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(staff =>
        staff.name.toLowerCase().includes(query) ||
        staff.nickname.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'knowledge':
          comparison = a.stats.totalKnowledge - b.stats.totalKnowledge;
          break;
        case 'playLogs':
          comparison = a.stats.totalPlayLogs - b.stats.totalPlayLogs;
          break;
        case 'checks':
          comparison = a.stats.totalContentChecks - b.stats.totalContentChecks;
          break;
        case 'hireDate':
          comparison = new Date(a.dateOfHire).getTime() - new Date(b.dateOfHire).getTime();
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [directory, searchQuery, sortBy, sortOrder]);

  // Format date to readable format (MMM YYYY)
  const formatHireDate = (dateStr: string): string => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  // Toggle sort order or change sort field
  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      // Toggle order if clicking same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to descending for stats, ascending for name
      setSortBy(field);
      setSortOrder(field === 'name' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/games" className="inline-flex items-center gap-2 text-primary hover:text-primary/80">
              <ArrowLeft className="w-4 h-4" />
              Back to Games
            </Link>
          </div>
          <div>
            <h1 className="text-3xl font-bold">Staff Directory</h1>
            <p className="text-muted-foreground mt-2">
              Contact information and activity stats for all staff members
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Search and Sort Controls */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or nickname..."
              className="w-full pl-10 pr-4 py-2 rounded-lg text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => handleSort(e.target.value as typeof sortBy)}
            className="px-4 py-2 rounded-lg text-sm border border-border bg-background text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <option value="name">Sort by Name</option>
            <option value="knowledge">Sort by Games Known</option>
            <option value="playLogs">Sort by Play Logs</option>
            <option value="checks">Sort by Content Checks</option>
            <option value="hireDate">Sort by Hire Date</option>
          </select>

          {/* Sort Order Toggle */}
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="px-4 py-2 rounded-lg text-sm border border-border bg-background text-foreground hover:bg-muted/50 transition-colors whitespace-nowrap"
          >
            {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
          </button>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">
            {filteredAndSortedStaff.length} staff member{filteredAndSortedStaff.length !== 1 ? 's' : ''}
            {searchQuery && ` (filtered from ${directory.length} total)`}
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-2">
              <Zap className="w-5 h-5 animate-spin" />
              <span>Loading staff directory...</span>
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
        {!isLoading && !error && filteredAndSortedStaff.length === 0 && (
          <div className="text-center py-12">
            <User className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? 'No staff members found matching your search' : 'No staff members found'}
            </p>
          </div>
        )}

        {/* Staff Cards Grid */}
        {!isLoading && !error && filteredAndSortedStaff.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedStaff.map((staff) => (
              <div
                key={staff.staffId}
                className="border border-border rounded-lg bg-white hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Card Header */}
                <div className="bg-primary/5 px-4 py-3 border-b border-border">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg text-foreground truncate">
                        {staff.name}
                      </h3>
                      {staff.nickname && staff.nickname !== staff.name && (
                        <p className="text-sm text-muted-foreground">
                          &quot;{staff.nickname}&quot;
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="px-4 py-4 space-y-3">
                  {/* Contact Information */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-foreground">{staff.contactPh || 'N/A'}</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-muted-foreground text-xs">Emergency Contact</div>
                        <div className="text-foreground font-medium">
                          {staff.emergencyContactName || 'N/A'}
                        </div>
                        <div className="text-foreground">{staff.emergencyContactPh || 'N/A'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <span className="text-muted-foreground text-xs">Hired: </span>
                        <span className="text-foreground">{formatHireDate(staff.dateOfHire)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stats Badges */}
                  <div className="pt-3 border-t border-border">
                    <div className="text-xs text-muted-foreground mb-2">Activity Stats</div>
                    <div className="flex flex-wrap gap-2">
                      <div className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                        {staff.stats.totalKnowledge} games
                      </div>
                      <div className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-medium">
                        {staff.stats.totalPlayLogs} plays
                      </div>
                      <div className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs font-medium">
                        {staff.stats.totalContentChecks} checks
                      </div>
                    </div>
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

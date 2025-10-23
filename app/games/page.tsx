'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { SearchBar } from '@/components/features/games/SearchBar';
import { GameFilters } from '@/components/features/games/GameFilters';
import { AdvancedFilters } from '@/components/features/games/AdvancedFilters';
import { GameCard } from '@/components/features/games/GameCard';
import { GameDetailModal } from '@/components/features/games/GameDetailModal';
import { SpinnerWheel } from '@/components/features/games/SpinnerWheel';
import { AddGameDialog } from '@/components/features/games/AddGameDialog';
import { StaffLoginDialog } from '@/components/features/staff/StaffLoginDialog';
import { BoardGame, GameFilters as FilterType, SortOption } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Shuffle, Loader2, RefreshCw, Plus, ChevronDown, ChevronUp, Images } from 'lucide-react';
import { VERSION, BUILD_DATE } from '@/lib/version';
import { useStaffMode } from '@/lib/hooks/useStaffMode';
import { useAdminMode } from '@/lib/hooks/useAdminMode';
import { ScrollToTopButton } from '@/components/ui/scroll-to-top-button';
import { StaffMenu } from '@/components/features/staff/StaffMenu';
import { trackGameViewed, trackAdvancedFiltersSelected, trackSpecialFilterCount } from '@/lib/analytics/mixpanel';

function GamesPageContent() {
  const isStaff = useStaffMode();
  const isAdmin = useAdminMode();
  const [games, setGames] = useState<BoardGame[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<BoardGame | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('dateAcquired');
  const [showSpinner, setShowSpinner] = useState(false);
  const [spinnerGames, setSpinnerGames] = useState<BoardGame[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showAddGameDialog, setShowAddGameDialog] = useState(false);
  const [showStaffLogin, setShowStaffLogin] = useState(false);
  const [staffSortOption, setStaffSortOption] = useState<SortOption | null>(null);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [picturesOnlyMode, setPicturesOnlyMode] = useState(false);
  const [staffKnowledge, setStaffKnowledge] = useState<Map<string, string>>(new Map());

  const [filters, setFilters] = useState<FilterType>({
    search: '',
    quickFilter: undefined,
  });

  // Load collapse preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('headerCollapsed');
    if (saved !== null) {
      setIsHeaderCollapsed(saved === 'true');
    }
  }, []);

  // Handle login success - refresh page to show staff mode
  const handleLoginSuccess = () => {
    // Trigger page refresh to pick up the new localStorage values
    window.location.reload();
  };

  // Fetch games from API (cached server-side)
  const fetchGames = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/games');

      if (!response.ok) {
        throw new Error('Failed to fetch games');
      }

      const data = await response.json();
      setGames(data.games);
      setCategories(data.categories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Fetch staff knowledge (extracted for manual refresh)
  const fetchStaffKnowledge = async () => {
    if (!isStaff) return;

    try {
      const staffName = localStorage.getItem('staff_name');
      if (!staffName) return;

      const response = await fetch('/api/staff-knowledge');
      if (!response.ok) return;

      const data = await response.json();
      const knowledge = data.knowledge || [];

      // Create a map of gameId -> confidence level for current staff member
      const knowledgeMap = new Map<string, string>();
      knowledge
        .filter((k: any) => k.staffMember === staffName)
        .forEach((k: any) => {
          const matchingGame = games.find(g => g.fields['Game Name'] === k.gameName);
          if (matchingGame) {
            knowledgeMap.set(matchingGame.id, k.confidenceLevel);
          }
        });

      setStaffKnowledge(knowledgeMap);
    } catch (err) {
      console.error('Error fetching staff knowledge:', err);
    }
  };

  // Combined refresh function (for modal callbacks)
  const handleRefresh = async () => {
    await fetchGames();
    await fetchStaffKnowledge();
  };

  useEffect(() => {
    fetchGames();
  }, []);

  // Fetch staff knowledge for current user (staff mode only)
  useEffect(() => {
    if (!isStaff) {
      setStaffKnowledge(new Map());
      return;
    }

    if (games.length > 0) {
      fetchStaffKnowledge();
    }
  }, [isStaff, games]);

  // Toggle header collapse and save preference
  const toggleHeaderCollapse = () => {
    const newValue = !isHeaderCollapsed;
    setIsHeaderCollapsed(newValue);
    localStorage.setItem('headerCollapsed', String(newValue));
  };

  // Client-side filtering and sorting
  const filteredAndSortedGames = useMemo(() => {
    // Filter out expansions - they will only show within their base game
    let filtered = games.filter(game => !game.fields.Expansion);

    // Search filter - only search game name, not description
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(game =>
        game.fields['Game Name']?.toLowerCase().includes(searchLower)
      );
    }

    // Category filter with AND/OR mode
    if (filters.categories && filters.categories.length > 0) {
      const matchMode = filters.categoryMatchMode || 'OR';
      filtered = filtered.filter(game => {
        const gameCategories = game.fields['Categories'] || [];
        if (matchMode === 'AND') {
          // ALL selected categories must be present
          return filters.categories!.every(cat => gameCategories.includes(cat));
        } else {
          // ANY selected category must be present (OR mode)
          return filters.categories!.some(cat => gameCategories.includes(cat));
        }
      });
    }

    // Player count filter
    // Min/Max Players are string fields in Airtable, so we need to convert them
    if (filters.playerCount?.min || filters.playerCount?.max) {
      filtered = filtered.filter(game => {
        const minPlayersStr = game.fields['Min Players'];
        const maxPlayersStr = game.fields['Max. Players'];

        // Skip games without player count data
        if (!minPlayersStr || !maxPlayersStr) return false;

        // Handle "No Limit" as a very high number
        const minPlayers = parseInt(minPlayersStr);
        const maxPlayers = maxPlayersStr === 'No Limit' ? 999 : parseInt(maxPlayersStr);

        // Filter to show games whose entire player range fits within the selected range
        // If user selects min=6 max=6, show games where min=6 AND max=6
        // If user selects min=5 max=10, show games where min>=5 AND max<=10
        if (filters.playerCount?.min && minPlayers < filters.playerCount.min) {
          return false;
        }

        if (filters.playerCount?.max && maxPlayers > filters.playerCount.max) {
          return false;
        }

        return true;
      });
    }

    // Year range filter
    if (filters.yearRange?.min) {
      filtered = filtered.filter(game =>
        (game.fields['Year Released'] || 0) >= filters.yearRange!.min!
      );
    }
    if (filters.yearRange?.max) {
      filtered = filtered.filter(game =>
        (game.fields['Year Released'] || 0) <= filters.yearRange!.max!
      );
    }

    // Complexity filter
    if (filters.complexity?.min) {
      filtered = filtered.filter(game =>
        (game.fields['Complexity'] || 0) >= filters.complexity!.min!
      );
    }
    if (filters.complexity?.max) {
      filtered = filtered.filter(game =>
        (game.fields['Complexity'] || 0) <= filters.complexity!.max!
      );
    }

    // Best Player Count filter
    if (filters.bestPlayerCount) {
      filtered = filtered.filter(game => {
        const bestPlayerAmount = game.fields['Best Player Amount'];
        if (!bestPlayerAmount) return false;
        return bestPlayerAmount === filters.bestPlayerCount!.toString();
      });
    }

    // Quick filters
    if (filters.quickFilter === 'sixPlus') {
      filtered = filtered.filter(game => {
        const maxPlayersStr = game.fields['Max. Players'];
        if (!maxPlayersStr) return false;

        const maxPlayers = maxPlayersStr === 'No Limit' ? 999 : parseInt(maxPlayersStr);

        // Min can be any amount, max must be at least 6
        return maxPlayers >= 6;
      });
    } else if (filters.quickFilter === 'couples') {
      // Show games that are exactly 2 players (min=2, max=2) OR where best player count is 2
      filtered = filtered.filter(game => {
        const minPlayersStr = game.fields['Min Players'];
        const maxPlayersStr = game.fields['Max. Players'];
        const bestPlayerAmount = game.fields['Best Player Amount'];

        // Check if it's exactly a 2-player game
        const isExactlyTwoPlayers = minPlayersStr === '2' && maxPlayersStr === '2';

        // Check if best player count is 2
        const isBestForTwo = bestPlayerAmount === '2';

        return isExactlyTwoPlayers || isBestForTwo;
      });
    } else if (filters.quickFilter === 'social') {
      filtered = filtered.filter(game => {
        const minPlayersStr = game.fields['Min Players'];
        const categories = game.fields['Categories'] || [];

        if (!minPlayersStr) return false;

        const minPlayers = parseInt(minPlayersStr);

        // Min must be at least 2, any max, and must have ANY of: Party, Deduction, or Social categories
        const hasSocialCategory = categories.some(cat =>
          cat === 'Party' || cat === 'Deduction' || cat === 'Social'
        );

        return minPlayers >= 2 && hasSocialCategory;
      });
    } else if (filters.quickFilter === 'noChecks') {
      filtered = filtered.filter(game => {
        const totalChecks = game.fields['Total Checks'];
        // Show games with no checks (undefined, 0, or null)
        return !totalChecks || totalChecks === 0;
      });
    }

    // Sorting - use staff sort if set, otherwise regular sort
    const activeSortOption = staffSortOption || sortOption;

    filtered.sort((a, b) => {
      const nameA = a.fields['Game Name'] || '';
      const nameB = b.fields['Game Name'] || '';

      switch (activeSortOption) {
        case 'alphabetical':
          // Use localeCompare with numeric option to handle numbers properly
          return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
        case 'alphabeticalDesc':
          return nameB.localeCompare(nameA, undefined, { numeric: true, sensitivity: 'base' });
        case 'year':
          return (b.fields['Year Released'] || 0) - (a.fields['Year Released'] || 0);
        case 'maxPlayers': {
          const maxA = a.fields['Max. Players'] === 'No Limit' ? 999 : parseInt(a.fields['Max. Players'] || '0');
          const maxB = b.fields['Max. Players'] === 'No Limit' ? 999 : parseInt(b.fields['Max. Players'] || '0');
          return maxB - maxA;
        }
        case 'complexity':
          return (a.fields['Complexity'] || 0) - (b.fields['Complexity'] || 0);
        case 'lastChecked':
          return (b.fields['Latest Check Date'] || '').localeCompare(a.fields['Latest Check Date'] || '');
        case 'lastCheckedDesc':
          return (a.fields['Latest Check Date'] || '').localeCompare(b.fields['Latest Check Date'] || '');
        case 'totalChecks':
          return (b.fields['Total Checks'] || 0) - (a.fields['Total Checks'] || 0);
        case 'totalChecksDesc':
          return (a.fields['Total Checks'] || 0) - (b.fields['Total Checks'] || 0);
        case 'dateAcquired':
        default:
          return (b.fields['Date of Aquisition'] || '').localeCompare(a.fields['Date of Aquisition'] || '');
      }
    });

    return filtered;
  }, [games, filters, sortOption, staffSortOption]);

  // Calculate active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.categories && filters.categories.length > 0) count++;
    if (filters.playerCount?.min || filters.playerCount?.max) count++;
    if (filters.yearRange?.min || filters.yearRange?.max) count++;
    if (filters.complexity?.min || filters.complexity?.max) count++;
    if (filters.bestPlayerCount) count++;
    return count;
  }, [filters]);

  // Handle search
  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
  };

  // Handle quick filter
  const handleQuickFilter = (filter: 'sixPlus' | 'couples' | 'social' | 'noChecks' | null) => {
    setFilters(prev => ({ ...prev, quickFilter: filter || undefined }));
  };

  // Handle advanced filters with tracking
  const handleApplyAdvancedFilters = (newFilters: FilterType) => {
    setFilters(newFilters);

    // Track advanced filters applied
    trackAdvancedFiltersSelected({
      search: newFilters.search,
      categories: newFilters.categories || [],
      playerCount: newFilters.playerCount,
      yearRange: newFilters.yearRange,
      complexity: newFilters.complexity,
      bestPlayerCount: newFilters.bestPlayerCount,
      categoryMatchMode: newFilters.categoryMatchMode,
    });

    // Track special filter count (number of active filters)
    const activeFilters: string[] = [];
    if (newFilters.search) activeFilters.push('search');
    if (newFilters.categories?.length) activeFilters.push('categories');
    if (newFilters.playerCount?.min || newFilters.playerCount?.max) activeFilters.push('playerCount');
    if (newFilters.yearRange?.min || newFilters.yearRange?.max) activeFilters.push('yearRange');
    if (newFilters.complexity?.min || newFilters.complexity?.max) activeFilters.push('complexity');
    if (newFilters.bestPlayerCount) activeFilters.push('bestPlayerCount');

    if (activeFilters.length > 0) {
      trackSpecialFilterCount(activeFilters.length, activeFilters);
    }
  };

  // Handle clear all filters
  const handleClearAll = () => {
    setFilters({
      search: '',
      quickFilter: undefined,
      categories: undefined,
      playerCount: undefined,
      yearRange: undefined,
      complexity: undefined,
      bestPlayerCount: undefined,
    });
  };

  // Check if any filters are active
  const hasAnyFilters = useMemo(() => {
    return !!(
      filters.search ||
      filters.quickFilter ||
      (filters.categories && filters.categories.length > 0) ||
      filters.playerCount?.min ||
      filters.playerCount?.max ||
      filters.yearRange?.min ||
      filters.yearRange?.max ||
      filters.complexity?.min ||
      filters.complexity?.max ||
      filters.bestPlayerCount
    );
  }, [filters]);

  // Handle random game with spinner wheel
  const handleRandomGame = () => {
    setSpinnerGames(filteredAndSortedGames);
    setShowSpinner(true);
  };

  const handleSpinnerComplete = (game: BoardGame) => {
    setShowSpinner(false);
    setSelectedGame(game);
    // Track game view
    trackGameViewed(game.id, game.fields['Game Name'] || 'Unknown');
  };

  const handleGameCardClick = (game: BoardGame) => {
    setSelectedGame(game);
    // Track game view
    trackGameViewed(game.id, game.fields['Game Name'] || 'Unknown');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => fetchGames()}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Unified Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="container mx-auto px-3 py-2 max-w-full">
          {/* Top Row - Title, Version, Buttons */}
          <div className="flex items-center justify-between gap-2">
            {/* Left side - Title and version (hidden when collapsed) */}
            {!isHeaderCollapsed && (
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold truncate">Board Game Collection</h1>
                <div
                  className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-full text-xs font-medium text-primary cursor-help whitespace-nowrap"
                  title={`Build date: ${BUILD_DATE}`}
                >
                  v{VERSION}
                </div>
              </div>
            )}

            {/* Collapsed view - Just version */}
            {isHeaderCollapsed && (
              <div className="flex items-center gap-2">
                <div
                  className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-full text-xs font-medium text-primary cursor-help whitespace-nowrap"
                  title={`Build date: ${BUILD_DATE}`}
                >
                  v{VERSION}
                </div>
              </div>
            )}

            {/* Right side - Action buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {!isStaff && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStaffLogin(true)}
                  className="whitespace-nowrap h-8 text-xs"
                >
                  <span className="hidden sm:inline">🔐 Staff Login</span>
                  <span className="sm:hidden">🔐</span>
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowAddGameDialog(true)}
                  className="whitespace-nowrap h-8 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  <span className="hidden sm:inline ml-1.5">Add Game</span>
                </Button>
              )}
              {isStaff && <StaffMenu />}
            </div>
          </div>

          {/* Search and Filters Row - Part of unified header */}
          <div className="mt-2">
        {isHeaderCollapsed ? (
          // Collapsed view - slim bar with active filters
          <div className="flex items-center justify-between gap-2 py-2 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                {filteredAndSortedGames.length} {filteredAndSortedGames.length === 1 ? 'game' : 'games'}
              </p>
              {hasAnyFilters && (
                <div className="flex items-center gap-1 flex-wrap">
                  {filters.search && (
                    <span className="text-[10px] sm:text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded whitespace-nowrap">
                      🔍 {filters.search.length > 8 ? filters.search.substring(0, 8) + '...' : filters.search}
                    </span>
                  )}
                  {filters.quickFilter && (
                    <span className="text-[10px] sm:text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded whitespace-nowrap">
                      {filters.quickFilter === 'sixPlus' && '👥 6+'}
                      {filters.quickFilter === 'couples' && '💑'}
                      {filters.quickFilter === 'social' && '🎉'}
                    </span>
                  )}
                  {filters.categories && filters.categories.length > 0 && (
                    <span className="text-[10px] sm:text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded whitespace-nowrap">
                      📁 {filters.categories.length}
                    </span>
                  )}
                  {(filters.playerCount?.min || filters.playerCount?.max) && (
                    <span className="text-[10px] sm:text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded whitespace-nowrap">
                      🎲 {filters.playerCount?.min || '?'}-{filters.playerCount?.max || '?'}
                    </span>
                  )}
                  {(filters.yearRange?.min || filters.yearRange?.max) && (
                    <span className="text-[10px] sm:text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded whitespace-nowrap">
                      📅 {filters.yearRange?.min || '?'}-{filters.yearRange?.max || '?'}
                    </span>
                  )}
                  {(filters.complexity?.min || filters.complexity?.max) && (
                    <span className="text-[10px] sm:text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded whitespace-nowrap">
                      🧠 {filters.complexity?.min || '?'}-{filters.complexity?.max || '?'}
                    </span>
                  )}
                  {filters.bestPlayerCount && (
                    <span className="text-[10px] sm:text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded whitespace-nowrap">
                      ⭐ {filters.bestPlayerCount}
                    </span>
                  )}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleHeaderCollapse}
              title="Expand filters"
              className="h-7 w-7 p-0 flex-shrink-0"
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          // Expanded view - full header
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <SearchBar
                  value={filters.search || ''}
                  onChange={handleSearch}
                  placeholder="Search by game title"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleHeaderCollapse}
                title="Collapse filters"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-4 items-center justify-between">
              <GameFilters
                filters={filters}
                onQuickFilter={handleQuickFilter}
                onOpenAdvancedFilter={() => setShowAdvancedFilters(true)}
                onClearAll={handleClearAll}
                activeFiltersCount={activeFiltersCount}
                hasAnyFilters={hasAnyFilters}
                isStaff={isStaff}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  variant={picturesOnlyMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPicturesOnlyMode(!picturesOnlyMode)}
                >
                  <Images className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Gallery Mode</span>
                  <span className="sm:hidden">Gallery</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRandomGame}
                  disabled={filteredAndSortedGames.length === 0}
                >
                  <Shuffle className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Random Pick</span>
                  <span className="sm:hidden">Random</span>
                </Button>

                <Select
                  value={sortOption}
                  onValueChange={(value: SortOption) => {
                    setSortOption(value);
                    setStaffSortOption(null); // Clear staff sort when regular sort is changed
                  }}
                >
                  <SelectTrigger className="w-[130px] sm:w-[180px]">
                    <SelectValue placeholder="Sort by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dateAcquired">Date Acquired</SelectItem>
                    <SelectItem value="alphabetical">A-Z</SelectItem>
                    <SelectItem value="alphabeticalDesc">Z-A</SelectItem>
                    <SelectItem value="year">Year Released</SelectItem>
                    <SelectItem value="maxPlayers">Max Players</SelectItem>
                    <SelectItem value="complexity">Complexity</SelectItem>
                  </SelectContent>
                </Select>

                {isStaff && (
                  <Select
                    value={staffSortOption || 'none'}
                    onValueChange={(value: string) => {
                      if (value === 'none') {
                        setStaffSortOption(null);
                      } else {
                        setStaffSortOption(value as SortOption);
                      }
                    }}
                  >
                    <SelectTrigger className="w-[200px] sm:w-[240px]">
                      <SelectValue placeholder="Sort by Checks" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sort by Checks</SelectItem>
                      <SelectItem value="lastChecked">Last Checked (Recent)</SelectItem>
                      <SelectItem value="lastCheckedDesc">Last Checked (Oldest)</SelectItem>
                      <SelectItem value="totalChecks">Total Checks (Most)</SelectItem>
                      <SelectItem value="totalChecksDesc">Total Checks (Least)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Results count - reduced margin */}
            <p className="text-xs text-muted-foreground mt-2">
              Showing {filteredAndSortedGames.length} {filteredAndSortedGames.length === 1 ? 'game' : 'games'}
            </p>
          </div>
        )}
          </div>
        </div>
      </div>

      {/* Games Grid - reduced top padding */}
      <div className="container mx-auto px-4 py-4 max-w-full">
      {picturesOnlyMode ? (
        // Pictures Only Mode - 3 column grid with just images
        <div className="grid grid-cols-3 gap-2 pt-4">
          {filteredAndSortedGames.map((game) => {
            // Check both PostgreSQL structure (game.images) and Airtable structure (game.fields.Images)
            const firstImage = game.images?.[0] || game.fields.Images?.[0];
            const originalImageUrl = firstImage?.url ||
              (firstImage && 'thumbnails' in firstImage ? firstImage.thumbnails?.large?.url : undefined);

            // Use hash-based route for PostgreSQL images, fallback to proxy for Airtable
            const imageHash = firstImage && 'hash' in firstImage ? firstImage.hash : null;
            const imageUrl = imageHash
              ? `/api/images/${imageHash}`
              : originalImageUrl
                ? `/api/images/proxy?url=${encodeURIComponent(originalImageUrl)}`
                : undefined;

            return (
              <div
                key={game.id}
                className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity group"
                onClick={() => {
                  setPicturesOnlyMode(false);
                  setSelectedGame(game);
                }}
              >
                {imageUrl ? (
                  <>
                    {/* Blurred background */}
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `url(${imageUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'blur(10px)',
                        zIndex: 0
                      }}
                    />
                    {/* Sharp image */}
                    <img
                      src={imageUrl}
                      alt={game.fields['Game Name']}
                      className="w-full h-full object-contain relative z-10"
                    />
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <span className="text-xs text-muted-foreground">No image</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // Normal Mode - 5 column grid with cards
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 pt-4">
          {filteredAndSortedGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onClick={() => handleGameCardClick(game)}
              isStaff={isStaff}
              picturesOnlyMode={picturesOnlyMode}
              staffKnowledgeLevel={staffKnowledge.get(game.id)}
            />
          ))}
        </div>
      )}

      {/* No results */}
      {filteredAndSortedGames.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No games found matching your criteria</p>
        </div>
      )}
      </div>

      {/* Advanced Filters */}
      <AdvancedFilters
        open={showAdvancedFilters}
        onClose={() => setShowAdvancedFilters(false)}
        filters={filters}
        onApplyFilters={handleApplyAdvancedFilters}
        availableCategories={categories}
      />

      {/* Spinner Wheel */}
      <SpinnerWheel
        games={spinnerGames}
        open={showSpinner}
        onClose={() => setShowSpinner(false)}
        onComplete={handleSpinnerComplete}
      />

      {/* Game Detail Modal */}
      <GameDetailModal
        game={selectedGame}
        open={!!selectedGame}
        onClose={() => setSelectedGame(null)}
        onRefresh={handleRefresh}
      />

      {/* Add Game Dialog (Staff Only) */}
      {isStaff && (
        <AddGameDialog
          open={showAddGameDialog}
          onClose={() => setShowAddGameDialog(false)}
          onSuccess={() => fetchGames()}
        />
      )}

      {/* Staff Login Dialog */}
      <StaffLoginDialog
        isOpen={showStaffLogin}
        onClose={() => setShowStaffLogin(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Floating Back to Top Button */}
      <ScrollToTopButton />
    </div>
  );
}

export default function GamesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <GamesPageContent />
    </Suspense>
  );
}

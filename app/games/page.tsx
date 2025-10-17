'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { SearchBar } from '@/components/features/games/SearchBar';
import { GameFilters } from '@/components/features/games/GameFilters';
import { AdvancedFilters } from '@/components/features/games/AdvancedFilters';
import { GameCard } from '@/components/features/games/GameCard';
import { GameDetailModal } from '@/components/features/games/GameDetailModal';
import { SpinnerWheel } from '@/components/features/games/SpinnerWheel';
import { AddGameDialog } from '@/components/features/games/AddGameDialog';
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
import { ScrollToTopButton } from '@/components/ui/scroll-to-top-button';

function GamesPageContent() {
  const isStaff = useStaffMode();
  const [games, setGames] = useState<BoardGame[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hardRefreshing, setHardRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<BoardGame | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('dateAcquired');
  const [showSpinner, setShowSpinner] = useState(false);
  const [spinnerGames, setSpinnerGames] = useState<BoardGame[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showAddGameDialog, setShowAddGameDialog] = useState(false);
  const [staffSortOption, setStaffSortOption] = useState<SortOption | null>(null);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [picturesOnlyMode, setPicturesOnlyMode] = useState(false);

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

  // Refresh cache from Airtable
  const handleRefresh = async (isHardRefresh = false) => {
    try {
      if (isHardRefresh) {
        setHardRefreshing(true);
      } else {
        setRefreshing(true);
      }

      const url = isHardRefresh
        ? '/api/games/refresh?full=true'
        : '/api/games/refresh';

      const response = await fetch(url, { method: 'POST' });

      if (!response.ok) {
        throw new Error('Failed to refresh cache');
      }

      // Fetch updated games
      await fetchGames();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setRefreshing(false);
      setHardRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

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
  const handleQuickFilter = (filter: 'sixPlus' | 'couples' | 'social' | null) => {
    setFilters(prev => ({ ...prev, quickFilter: filter || undefined }));
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
    <div className="container mx-auto px-4 py-8 max-w-full">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl md:text-4xl font-bold">Board Game Collection</h1>
            <div
              className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs font-medium text-primary cursor-help"
              title={`Build date: ${BUILD_DATE}`}
            >
              v{VERSION}
            </div>
          </div>
          <p className="text-muted-foreground">
            Browse our collection of {games.length} board games
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isStaff && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowAddGameDialog(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Add Boardgame</span>
              <span className="sm:hidden">Add</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRefresh(false)}
            disabled={refreshing || hardRefreshing}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            <span className="hidden sm:inline">Refresh Data</span>
            <span className="sm:hidden">Refresh</span>
          </Button>
          {isStaff && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRefresh(true)}
              disabled={hardRefreshing || refreshing}
            >
              {hardRefreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              <span className="hidden sm:inline">Hard Refresh</span>
              <span className="sm:hidden">Hard</span>
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters - Collapsible */}
      <div className="sticky top-0 z-50 bg-background pb-4 mb-6 -mx-4 px-4 shadow-sm border-b transition-all duration-300">
        {isHeaderCollapsed ? (
          // Collapsed view - slim bar with active filters
          <div className="flex items-center justify-between gap-2 py-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <p className="text-sm text-muted-foreground whitespace-nowrap">
                Showing {filteredAndSortedGames.length} {filteredAndSortedGames.length === 1 ? 'game' : 'games'}
              </p>
              {hasAnyFilters && (
                <div className="flex items-center gap-2 flex-wrap">
                  {filters.search && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded whitespace-nowrap">
                      🔍 {filters.search}
                    </span>
                  )}
                  {filters.quickFilter && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded whitespace-nowrap">
                      {filters.quickFilter === 'sixPlus' && '👥 6+ Players'}
                      {filters.quickFilter === 'couples' && '💑 Couples'}
                      {filters.quickFilter === 'social' && '🎉 Social'}
                    </span>
                  )}
                  {filters.categories && filters.categories.length > 0 && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded whitespace-nowrap">
                      📁 {filters.categories.length} categor{filters.categories.length === 1 ? 'y' : 'ies'}
                    </span>
                  )}
                  {(filters.playerCount?.min || filters.playerCount?.max) && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded whitespace-nowrap">
                      🎲 Players: {filters.playerCount?.min || '?'}-{filters.playerCount?.max || '?'}
                    </span>
                  )}
                  {(filters.yearRange?.min || filters.yearRange?.max) && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded whitespace-nowrap">
                      📅 {filters.yearRange?.min || '?'}-{filters.yearRange?.max || '?'}
                    </span>
                  )}
                  {(filters.complexity?.min || filters.complexity?.max) && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded whitespace-nowrap">
                      🧠 Complexity: {filters.complexity?.min || '?'}-{filters.complexity?.max || '?'}
                    </span>
                  )}
                  {filters.bestPlayerCount && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded whitespace-nowrap">
                      ⭐ Best: {filters.bestPlayerCount}
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
            >
              <ChevronDown className="h-4 w-4" />
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
                  <span className="hidden sm:inline">Pictures Only</span>
                  <span className="sm:hidden">Pictures</span>
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
                    <SelectTrigger className="w-[130px] sm:w-[180px]">
                      <SelectValue placeholder="Staff Sort..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Staff Sort</SelectItem>
                      <SelectItem value="lastChecked">Last Checked ↓</SelectItem>
                      <SelectItem value="lastCheckedDesc">Last Checked ↑</SelectItem>
                      <SelectItem value="totalChecks">Total Checks ↓</SelectItem>
                      <SelectItem value="totalChecksDesc">Total Checks ↑</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Results count */}
            <p className="text-sm text-muted-foreground">
              Showing {filteredAndSortedGames.length} {filteredAndSortedGames.length === 1 ? 'game' : 'games'}
            </p>
          </div>
        )}
      </div>

      {/* Games Grid */}
      {picturesOnlyMode ? (
        // Pictures Only Mode - 3 column grid with just images
        <div className="grid grid-cols-3 gap-2 pt-4">
          {filteredAndSortedGames.map((game) => {
            const firstImage = game.fields.Images?.[0];
            const originalImageUrl = firstImage?.thumbnails?.large?.url || firstImage?.url;
            const imageUrl = originalImageUrl
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
              onClick={() => setSelectedGame(game)}
              isStaff={isStaff}
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

      {/* Advanced Filters */}
      <AdvancedFilters
        open={showAdvancedFilters}
        onClose={() => setShowAdvancedFilters(false)}
        filters={filters}
        onApplyFilters={setFilters}
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
      />

      {/* Add Game Dialog (Staff Only) */}
      {isStaff && (
        <AddGameDialog
          open={showAddGameDialog}
          onClose={() => setShowAddGameDialog(false)}
          onSuccess={() => handleRefresh(false)}
        />
      )}

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

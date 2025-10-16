'use client';

import { useEffect, useState, useCallback } from 'react';
import { SearchBar } from '@/components/features/games/SearchBar';
import { GameFilters } from '@/components/features/games/GameFilters';
import { GameCard } from '@/components/features/games/GameCard';
import { GameDetailModal } from '@/components/features/games/GameDetailModal';
import { BoardGame, GameFilters as FilterType, SortOption } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Shuffle, Loader2 } from 'lucide-react';

export default function GamesPage() {
  const [games, setGames] = useState<BoardGame[]>([]);
  const [filteredGames, setFilteredGames] = useState<BoardGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<BoardGame | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('dateAcquired');
  const [randomizing, setRandomizing] = useState(false);

  const [filters, setFilters] = useState<FilterType>({
    search: '',
    quickFilter: undefined,
  });

  // Fetch games from API
  const fetchGames = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (filters.search) params.set('search', filters.search);
      if (filters.quickFilter) params.set('quickFilter', filters.quickFilter);
      params.set('sort', sortOption);

      const response = await fetch(`/api/games?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch games');
      }

      const data = await response.json();
      setGames(data.games);
      setFilteredGames(data.games);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [filters, sortOption]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // Handle search
  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
  };

  // Handle quick filter
  const handleQuickFilter = (filter: 'sixPlus' | 'couples' | 'party' | null) => {
    setFilters(prev => ({ ...prev, quickFilter: filter || undefined }));
  };

  // Handle random game
  const handleRandomGame = async () => {
    setRandomizing(true);

    // Simulate spinning animation
    const randomGames = [...filteredGames].sort(() => Math.random() - 0.5);
    let index = 0;

    const interval = setInterval(() => {
      setSelectedGame(randomGames[index % randomGames.length]);
      index++;
    }, 100);

    setTimeout(() => {
      clearInterval(interval);

      // Fetch actual random game from API
      fetch('/api/games/random')
        .then(res => res.json())
        .then(game => {
          setSelectedGame(game);
          setRandomizing(false);
        })
        .catch(() => {
          setRandomizing(false);
        });
    }, 2000);
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
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Board Game Collection</h1>
        <p className="text-muted-foreground">
          Browse our collection of {games.length} board games
        </p>
      </div>

      {/* Search and Filters */}
      <div className="sticky top-0 z-10 bg-background pb-4 space-y-4 mb-6">
        <SearchBar
          value={filters.search || ''}
          onChange={handleSearch}
          placeholder="Search games by name or description..."
        />

        <div className="flex flex-wrap gap-4 items-center justify-between">
          <GameFilters
            filters={filters}
            onQuickFilter={handleQuickFilter}
            onOpenAdvancedFilter={() => {
              // TODO: Implement advanced filter sheet
              console.log('Open advanced filters');
            }}
            activeFiltersCount={0}
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRandomGame}
              disabled={randomizing || filteredGames.length === 0}
            >
              {randomizing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Shuffle className="mr-2 h-4 w-4" />
              )}
              Random Pick
            </Button>

            <Select
              value={sortOption}
              onValueChange={(value: SortOption) => setSortOption(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dateAcquired">Date Acquired</SelectItem>
                <SelectItem value="alphabetical">Alphabetical</SelectItem>
                <SelectItem value="year">Year Released</SelectItem>
                <SelectItem value="maxPlayers">Max Players</SelectItem>
                <SelectItem value="complexity">Complexity</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground">
          Showing {filteredGames.length} {filteredGames.length === 1 ? 'game' : 'games'}
        </p>
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredGames.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            onClick={() => setSelectedGame(game)}
          />
        ))}
      </div>

      {/* No results */}
      {filteredGames.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No games found matching your criteria</p>
        </div>
      )}

      {/* Game Detail Modal */}
      <GameDetailModal
        game={selectedGame}
        open={!!selectedGame && !randomizing}
        onClose={() => setSelectedGame(null)}
      />
    </div>
  );
}
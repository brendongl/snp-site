'use client';

import { useState, useEffect, useMemo } from 'react';
import { VideoGame } from '@/types';
import VideoGameCard from '@/components/features/video-games/VideoGameCard';
import VideoGameModal from '@/components/features/video-games/VideoGameModal';
import VideoGameFilters from '@/components/features/video-games/VideoGameFilters';
import { LayoutGrid, LayoutList, Grid3x3 } from 'lucide-react';

type ViewMode = 'grid' | 'list' | 'icon';

export default function VideoGamesPage() {
  const [games, setGames] = useState<VideoGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<VideoGame | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [filters, setFilters] = useState<{
    locatedOn: string[];
    category: string[];
    ageRating: number[];
  }>({
    locatedOn: [],
    category: [],
    ageRating: [],
  });

  // Fetch games
  useEffect(() => {
    async function fetchGames() {
      try {
        setLoading(true);
        const response = await fetch('/api/video-games');
        if (!response.ok) throw new Error('Failed to fetch games');
        const data = await response.json();
        setGames(data.games || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchGames();
  }, []);

  // Get unique locations and categories
  const availableLocations = useMemo(() => {
    const locations = new Set<string>();
    games.forEach(game => {
      game.located_on?.forEach(loc => locations.add(loc));
    });
    return Array.from(locations).sort();
  }, [games]);

  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    games.forEach(game => {
      game.category?.forEach(cat => categories.add(cat));
    });
    return Array.from(categories).sort();
  }, [games]);

  // Filter and search games
  const filteredGames = useMemo(() => {
    return games.filter(game => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = game.name.toLowerCase().includes(query);
        const publisherMatch = game.publisher?.toLowerCase().includes(query);
        if (!nameMatch && !publisherMatch) return false;
      }

      // Location filter (OR logic - game on ANY selected console)
      if (filters.locatedOn.length > 0) {
        const hasLocation = game.located_on?.some(loc =>
          filters.locatedOn.includes(loc)
        );
        if (!hasLocation) return false;
      }

      // Category filter (OR logic - game has ANY selected genre)
      if (filters.category.length > 0) {
        const hasCategory = game.category?.some(cat =>
          filters.category.includes(cat)
        );
        if (!hasCategory) return false;
      }

      // Age Rating filter (OR logic - game has ANY selected age rating)
      if (filters.ageRating.length > 0) {
        if (!game.age_rating || !filters.ageRating.includes(game.age_rating)) {
          return false;
        }
      }

      return true;
    });
  }, [games, searchQuery, filters]);

  // Paginate filtered games
  const paginatedGames = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredGames.slice(startIndex, endIndex);
  }, [filteredGames, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredGames.length / itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, searchQuery]);

  // Get grid column classes based on view mode
  const getGridClasses = () => {
    if (viewMode === 'icon') {
      return 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2';
    }
    return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <h1 className="text-4xl font-bold mb-8">Video Games Library</h1>

      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name or publisher..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>

      {/* Filters */}
      <VideoGameFilters
        onFilterChange={setFilters}
        availableLocations={availableLocations}
        availableCategories={availableCategories}
      />

      {/* Controls Row: View Toggle + Game Count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-600 dark:text-gray-400">
          {loading ? 'Loading...' : `Showing ${paginatedGames.length} of ${filteredGames.length} games (page ${currentPage}/${totalPages})`}
        </p>

        {/* View Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'grid'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
            title="Grid view (landscape images)"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('icon')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'icon'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
            title="Icon view (compact, portrait images)"
          >
            <Grid3x3 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">
          Error: {error}
        </div>
      )}

      {/* Games Grid */}
      {paginatedGames.length === 0 && !loading ? (
        <div className="text-center py-12">
          <p className="text-xl text-gray-500">No games found</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilters({ locatedOn: [], category: [], ageRating: [] });
            }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <div className={getGridClasses()}>
            {paginatedGames.map((game) => (
              <VideoGameCard
                key={game.id}
                game={game}
                onClick={() => setSelectedGame(game)}
                viewMode={viewMode}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-gray-700 dark:text-gray-300 px-4">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {selectedGame && (
        <VideoGameModal
          game={selectedGame}
          isOpen={!!selectedGame}
          onClose={() => setSelectedGame(null)}
        />
      )}
    </div>
  );
}

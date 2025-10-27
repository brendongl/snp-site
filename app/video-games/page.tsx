'use client';

import { useState, useEffect, useMemo } from 'react';
import { VideoGame } from '@/types';
import VideoGameCard from '@/components/features/video-games/VideoGameCard';
import VideoGameModal from '@/components/features/video-games/VideoGameModal';
import VideoGameFilters from '@/components/features/video-games/VideoGameFilters';

export default function VideoGamesPage() {
  const [games, setGames] = useState<VideoGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<VideoGame | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<{
    locatedOn: string[];
    category: string[];
  }>({
    locatedOn: [],
    category: [],
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

      return true;
    });
  }, [games, searchQuery, filters]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-xl">Loading video games...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-600">
          <p className="text-xl">Error: {error}</p>
        </div>
      </div>
    );
  }

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

      {/* Game Count */}
      <div className="mb-4">
        <p className="text-gray-600 dark:text-gray-400">
          Showing {filteredGames.length} of {games.length} games
        </p>
      </div>

      {/* Games Grid */}
      {filteredGames.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xl text-gray-500">No games found</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilters({ locatedOn: [], category: [] });
            }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredGames.map((game) => (
            <VideoGameCard
              key={game.id}
              game={game}
              onClick={() => setSelectedGame(game)}
            />
          ))}
        </div>
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

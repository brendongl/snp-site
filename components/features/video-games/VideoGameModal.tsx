'use client';

import { VideoGame } from '@/types';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useMemo } from 'react';

interface VideoGameModalProps {
  game: VideoGame;
  isOpen: boolean;
  onClose: () => void;
  allGames?: VideoGame[];
  onSelectGame?: (game: VideoGame) => void;
}

export default function VideoGameModal({ game, isOpen, onClose, allGames = [], onSelectGame }: VideoGameModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const getRatingLabel = (rating: number | undefined) => {
    if (!rating) return null;
    const labels: { [key: number]: string } = {
      6: 'E (Everyone 6+)',
      10: 'E10+ (Everyone 10+)',
      13: 'T (Teen 13+)',
      17: 'M (Mature 17+)'
    };
    return labels[rating];
  };

  // Find similar games based on genres and player count
  const similarGames = useMemo(() => {
    if (!allGames || allGames.length === 0) return [];

    const currentGenres = game.category || [];
    const currentPlayers = game.number_of_players;

    // Helper to count matching genres
    const countMatchingGenres = (otherGame: VideoGame) => {
      const otherGenres = otherGame.category || [];
      return currentGenres.filter(genre => otherGenres.includes(genre)).length;
    };

    // Filter out current game
    const otherGames = allGames.filter(g => g.id !== game.id);

    // Try 1: At least 2 matching genres AND same player count
    let matches = otherGames.filter(g => {
      const matchingGenres = countMatchingGenres(g);
      const samePlayers = g.number_of_players === currentPlayers;
      return matchingGenres >= 2 && samePlayers;
    });

    // Try 2: At least 2 matching genres AND player count within ±2
    if (matches.length < 3 && currentPlayers) {
      matches = otherGames.filter(g => {
        const matchingGenres = countMatchingGenres(g);
        const playerDiff = g.number_of_players ? Math.abs(g.number_of_players - currentPlayers) : Infinity;
        return matchingGenres >= 2 && playerDiff <= 2;
      });
    }

    // Try 3: At least 1 matching genre AND same player count
    if (matches.length < 3) {
      matches = otherGames.filter(g => {
        const matchingGenres = countMatchingGenres(g);
        const samePlayers = g.number_of_players === currentPlayers;
        return matchingGenres >= 1 && samePlayers;
      });
    }

    // Try 4: At least 1 matching genre (any player count)
    if (matches.length < 3) {
      matches = otherGames.filter(g => countMatchingGenres(g) >= 1);
    }

    // Try 5: Same player count (any genre)
    if (matches.length < 3 && currentPlayers) {
      matches = otherGames.filter(g => g.number_of_players === currentPlayers);
    }

    // Sort by relevance and return top 3
    return matches
      .sort((a, b) => {
        const aGenres = countMatchingGenres(a);
        const bGenres = countMatchingGenres(b);
        const aPlayerDiff = a.number_of_players && currentPlayers ? Math.abs(a.number_of_players - currentPlayers) : Infinity;
        const bPlayerDiff = b.number_of_players && currentPlayers ? Math.abs(b.number_of_players - currentPlayers) : Infinity;

        if (aGenres !== bGenres) return bGenres - aGenres; // More genre matches first
        return aPlayerDiff - bPlayerDiff; // Closer player count second
      })
      .slice(0, 3);
  }, [game, allGames]);

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
        >
          <X size={24} />
        </button>

        {/* Large Landscape Image */}
        <div className="relative w-full h-64 md:h-96">
          <Image
            src={game.image_landscape_url || '/placeholder-game.jpg'}
            alt={game.name}
            fill
            className="object-cover"
          />
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Title and Publisher */}
          <h2 className="text-3xl font-bold mb-2">{game.name}</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {game.publisher || 'Unknown Publisher'}
          </p>

          {/* Compact Info Section */}
          <div className="space-y-4 mb-6">
            {/* Players */}
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Players</p>
              <p className="font-semibold text-lg">
                {game.number_of_players ? `Up to ${game.number_of_players} players` : 'Unknown'}
              </p>
            </div>

            {/* Screenshot */}
            {game.image_screenshot_url && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">In-Game Screenshot</p>
                <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700">
                  <Image
                    src={game.image_screenshot_url}
                    alt={`${game.name} gameplay`}
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            )}

            {/* Genres */}
            {game.category && game.category.length > 0 && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Genres</p>
                <div className="flex flex-wrap gap-2">
                  {game.category.map((genre) => (
                    <span
                      key={genre}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Age Rating */}
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Age Rating</p>
              <p className="font-semibold text-lg">{getRatingLabel(game.age_rating) || 'Not Rated'}</p>
            </div>

            {/* Platform */}
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Platform</p>
              <p className="font-semibold text-lg capitalize">{game.platform}</p>
            </div>

            {/* Available On */}
            {game.located_on && game.located_on.length > 0 && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Available On</p>
                <div className="flex flex-wrap gap-2">
                  {game.located_on.map((console) => (
                    <span
                      key={console}
                      className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm font-semibold"
                    >
                      {console}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* You May Also Like Section */}
          {similarGames.length > 0 && (
            <div className="mb-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold mb-4">You may also like...</h3>
              <div className="grid grid-cols-3 gap-3">
                {similarGames.map((similarGame) => (
                  <button
                    key={similarGame.id}
                    onClick={() => {
                      if (onSelectGame) {
                        onSelectGame(similarGame);
                      }
                    }}
                    className="group relative aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all"
                  >
                    <Image
                      src={similarGame.image_portrait_url || similarGame.image_landscape_url || '/placeholder-game.jpg'}
                      alt={similarGame.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-2">
                      <p className="text-white text-xs font-semibold line-clamp-2">{similarGame.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* View Full Details Button */}
          <button
            onClick={() => router.push(`/video-games/${game.id}`)}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            View Full Details
          </button>
        </div>
      </div>
    </div>
  );
}

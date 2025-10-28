'use client';

import { VideoGame } from '@/types';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

interface VideoGameModalProps {
  game: VideoGame;
  isOpen: boolean;
  onClose: () => void;
}

export default function VideoGameModal({ game, isOpen, onClose }: VideoGameModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const formatDate = (date: number | undefined) => {
    if (!date) return 'Unknown';
    const dateStr = date.toString();
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

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
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {game.publisher || 'Unknown Publisher'}
          </p>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Release Date</p>
              <p className="font-semibold">{formatDate(game.release_date)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Players</p>
              <p className="font-semibold">
                {game.number_of_players ? `Up to ${game.number_of_players}` : 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Platform</p>
              <p className="font-semibold capitalize">{game.platform}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Age Rating</p>
              <p className="font-semibold">{getRatingLabel(game.age_rating) || 'Not Rated'}</p>
            </div>
          </div>

          {/* Screenshot Image */}
          {game.image_screenshot_url && (
            <div className="mb-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Gameplay Screenshot</p>
              <div className="relative w-full h-64 md:h-96 rounded-lg overflow-hidden">
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
            <div className="mb-4">
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

          {/* Rating Content */}
          {game.rating_content && game.rating_content.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Rating Content</p>
              <div className="flex flex-wrap gap-2">
                {game.rating_content.map((rating) => (
                  <span
                    key={rating}
                    className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full text-sm"
                  >
                    {rating}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Location Badges */}
          {game.located_on && game.located_on.length > 0 && (
            <div className="mb-4">
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

          {/* Description */}
          {game.description && (
            <div className="mb-6">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {game.description}
              </p>
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

'use client';

import { VideoGame } from '@/types';
import Image from 'next/image';

interface VideoGameCardProps {
  game: VideoGame;
  onClick: () => void;
  viewMode?: 'grid' | 'list' | 'icon' | 'screenshot';
}

export default function VideoGameCard({ game, onClick, viewMode = 'grid' }: VideoGameCardProps) {
  const imageUrl = viewMode === 'icon'
    ? game.image_portrait_url
    : viewMode === 'screenshot'
      ? game.image_screenshot_url
      : game.image_landscape_url;
  const hasImage = imageUrl && imageUrl !== '/placeholder-game.jpg';

  // Map age rating to ESRB label
  const getRatingLabel = (rating: number | undefined) => {
    if (!rating) return null;
    const labels: { [key: number]: string } = {
      6: 'E',
      10: 'E10+',
      13: 'T',
      17: 'M'
    };
    return labels[rating];
  };

  const ratingLabel = getRatingLabel(game.age_rating);

  // Icon view: Square portrait image (1:1)
  if (viewMode === 'icon') {
    return (
      <div
        onClick={onClick}
        className="cursor-pointer group relative overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 bg-gray-900"
      >
        <div className="relative w-full pb-[100%]"> {/* 100% = 1:1 square ratio */}
          {hasImage ? (
            <Image
              src={imageUrl!}
              alt={game.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 flex items-center justify-center">
              <div className="text-4xl">🎮</div>
            </div>
          )}

          {/* Age Rating Badge - removed per user request */}
        </div>
      </div>
    );
  }

  // Grid view: Landscape image (16:9), no text overlays
  return (
    <div
      onClick={onClick}
      className="cursor-pointer group relative overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 bg-gray-900"
    >
      <div className="relative w-full pb-[56.25%]"> {/* 56.25% = 9/16 for 16:9 ratio */}
        {hasImage ? (
          <Image
            src={imageUrl}
            alt={game.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 flex items-center justify-center">
            <div className="text-center p-6">
              <div className="text-6xl mb-4">🎮</div>
              <h3 className="text-white font-bold text-lg line-clamp-2">
                {game.name}
              </h3>
            </div>
          </div>
        )}

        {/* Age Rating Badge - removed per user request */}
      </div>
    </div>
  );
}

'use client';

import { VideoGame } from '@/types';
import Image from 'next/image';

interface VideoGameCardProps {
  game: VideoGame;
  onClick: () => void;
}

export default function VideoGameCard({ game, onClick }: VideoGameCardProps) {
  const imageUrl = game.image_landscape_url || '/placeholder-game.jpg';

  // Format release date from YYYYMMDD to readable format
  const formatDate = (date: number | undefined) => {
    if (!date) return 'Unknown';
    const dateStr = date.toString();
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${month}/${day}/${year}`;
  };

  return (
    <div
      onClick={onClick}
      className="cursor-pointer group relative overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 bg-gray-900"
    >
      {/* 16:9 Aspect Ratio Container */}
      <div className="relative w-full pb-[56.25%]"> {/* 56.25% = 9/16 for 16:9 ratio */}
        <Image
          src={imageUrl}
          alt={game.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />

        {/* Bottom Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Game Name */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-white font-bold text-lg line-clamp-2">
            {game.name}
          </h3>
          <p className="text-gray-300 text-sm mt-1">
            {game.publisher || 'Unknown Publisher'}
          </p>
        </div>
      </div>

      {/* Genre Badges */}
      {game.category && game.category.length > 0 && (
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {game.category.slice(0, 2).map((genre) => (
            <span
              key={genre}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded-full"
            >
              {genre}
            </span>
          ))}
        </div>
      )}

      {/* Rating Badge (if has rating content) */}
      {game.rating_content && game.rating_content.length > 0 && (
        <div className="absolute top-2 right-2">
          <span className="px-2 py-1 text-xs bg-yellow-600 text-white rounded-full">
            {game.rating_content[0]}
          </span>
        </div>
      )}
    </div>
  );
}

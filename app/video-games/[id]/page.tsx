import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import videoGamesDbService from '@/lib/services/video-games-db-service';

async function getGame(id: string) {
  try {
    const game = await videoGamesDbService.getGameById(id, 'switch');
    return game;
  } catch (error) {
    console.error('Error fetching game:', error);
    return null;
  }
}

export default async function VideoGameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGame(id);

  if (!game) {
    notFound();
  }

  const formatDate = (date: number | undefined) => {
    if (!date) return 'Unknown';
    const dateStr = date.toString();
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Button */}
      <Link
        href="/video-games"
        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
      >
        <ArrowLeft size={20} />
        Back to Gallery
      </Link>

      {/* Images Section */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Landscape Image */}
        <div className="relative w-full h-64 md:h-96 rounded-lg overflow-hidden">
          <Image
            src={game.image_landscape_url || '/placeholder-game.jpg'}
            alt={`${game.name} - Landscape`}
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Portrait Image */}
        {game.image_portrait_url && (
          <div className="relative w-full h-64 md:h-96 rounded-lg overflow-hidden">
            <Image
              src={game.image_portrait_url}
              alt={`${game.name} - Box Art`}
              fill
              className="object-contain bg-gray-100 dark:bg-gray-800"
            />
          </div>
        )}
      </div>

      {/* Game Info */}
      <div className="space-y-6">
        {/* Title and Publisher */}
        <div>
          <h1 className="text-4xl font-bold mb-2">{game.name}</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            {game.publisher || 'Unknown Publisher'}
          </p>
          {game.developer && game.developer !== game.publisher && (
            <p className="text-gray-500 dark:text-gray-500">
              Developed by {game.developer}
            </p>
          )}
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Release Date</p>
            <p className="font-semibold">{formatDate(game.release_date)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Players</p>
            <p className="font-semibold">
              {game.number_of_players ? `Up to ${game.number_of_players}` : 'Unknown'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Platform</p>
            <p className="font-semibold capitalize">{game.platform}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">TitleID</p>
            <p className="font-mono text-sm">{game.id}</p>
          </div>
        </div>

        {/* Genres */}
        {game.category && game.category.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-3">Genres</h2>
            <div className="flex flex-wrap gap-2">
              {game.category.map((genre: string) => (
                <span
                  key={genre}
                  className="px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full font-medium"
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Rating Content */}
        {game.rating_content && game.rating_content.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-3">Rating Content</h2>
            <div className="flex flex-wrap gap-2">
              {game.rating_content.map((rating: string) => (
                <span
                  key={rating}
                  className="px-4 py-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full font-medium"
                >
                  {rating}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Console Locations */}
        {game.located_on && game.located_on.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-3">Available On</h2>
            <div className="flex flex-wrap gap-2">
              {game.located_on.map((console: string) => (
                <span
                  key={console}
                  className="px-4 py-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full font-bold"
                >
                  {console}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Languages */}
        {game.languages && game.languages.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-3">
              Supported Languages ({game.languages.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {game.languages.map((lang: string) => (
                <span
                  key={lang}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded text-sm"
                >
                  {lang.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {game.description && (
          <div>
            <h2 className="text-xl font-semibold mb-3">Description</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {game.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

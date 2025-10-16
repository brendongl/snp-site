'use client';

import Image from 'next/image';
import { BoardGame } from '@/types';
import { Users, Calendar, Brain } from 'lucide-react';

interface GameCardProps {
  game: BoardGame;
  onClick: () => void;
}

export function GameCard({ game, onClick }: GameCardProps) {
  const firstImage = game.fields.Images?.[0];
  const imageUrl = firstImage?.thumbnails?.large?.url || firstImage?.url;

  return (
    <div
      className="group cursor-pointer rounded-lg border bg-card text-card-foreground shadow-sm transition-all hover:shadow-lg"
      onClick={onClick}
    >
      <div className="aspect-square relative overflow-hidden rounded-t-lg bg-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={game.fields['Game Name']}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <span className="text-sm">No image</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-sm line-clamp-2 mb-2">
          {game.fields['Game Name']}
        </h3>

        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          {game.fields['Max. Players (BG)'] && (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>
                {game.fields['Min Players (BG)'] || 1}-{game.fields['Max. Players (BG)']} players
              </span>
            </div>
          )}

          {game.fields['Year Released'] && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{game.fields['Year Released']}</span>
            </div>
          )}

          {game.fields['Complexity / Difficulty'] && (
            <div className="flex items-center gap-1">
              <Brain className="h-3 w-3" />
              <span>Complexity: {game.fields['Complexity / Difficulty']}/5</span>
            </div>
          )}
        </div>

        {game.fields.Categories && game.fields.Categories.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {game.fields.Categories.slice(0, 2).map((category) => (
              <span
                key={category}
                className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs"
              >
                {category}
              </span>
            ))}
            {game.fields.Categories.length > 2 && (
              <span className="text-xs text-muted-foreground">
                +{game.fields.Categories.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { BoardGame } from '@/types';
import { Users, Calendar, Brain, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';

interface GameCardProps {
  game: BoardGame;
  onClick: () => void;
  isStaff?: boolean;
}

export function GameCard({ game, onClick, isStaff = false }: GameCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Reset image loaded state when game changes
  useEffect(() => {
    setImageLoaded(false);
  }, [game.id]);

  const firstImage = game.fields.Images?.[0];
  const originalImageUrl = firstImage?.thumbnails?.large?.url || firstImage?.url;
  // Use cached image proxy if URL exists
  // The /api/images/[hash] endpoint accepts a url query parameter for direct proxying
  const imageUrl = originalImageUrl
    ? `/api/images/proxy?url=${encodeURIComponent(originalImageUrl)}`
    : undefined;

  return (
    <div
      className="group cursor-pointer rounded-lg border bg-card text-card-foreground shadow-sm transition-all hover:shadow-lg"
      onClick={onClick}
    >
      <div className="aspect-square relative overflow-hidden rounded-t-lg bg-muted">
        {imageUrl ? (
          <>
            {/* Blurred background layer - only show after image loads to fill gaps from aspect ratio differences */}
            {imageLoaded && (
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
            )}

            {/* Sharp image layer on top - uses object-contain to fit entire image without cropping */}
            <Image
              src={imageUrl}
              alt={game.fields['Game Name']}
              fill
              className="object-contain transition-transform group-hover:scale-105 relative z-10"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
              onLoad={() => setImageLoaded(true)}
            />

            {/* Year badge - top right overlay */}
            {game.fields['Year Released'] && (
              <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded text-xs text-white font-medium z-20">
                {game.fields['Year Released']}
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <span className="text-sm">No image</span>
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="font-semibold text-sm line-clamp-2 mb-2">
          {game.fields['Game Name']}
        </h3>

        {/* Categories */}
        {game.fields.Categories && game.fields.Categories.length > 0 && (
          <div className="mb-2 text-xs text-muted-foreground">
            {game.fields.Categories.join(', ')}
          </div>
        )}

        {/* Compact horizontal info row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {game.fields['Max. Players'] && (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{game.fields['Min Players'] || 1}-{game.fields['Max. Players']}</span>
            </div>
          )}

          {game.fields['Complexity'] && (
            <div className="flex items-center gap-1">
              <Brain className="h-3 w-3" />
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={i < game.fields['Complexity']! ? 'text-primary' : 'text-muted'}>
                    ●
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Staff-only check info */}
        {isStaff && (
          <div className="mt-3 pt-3 border-t text-xs space-y-1">
            {game.fields['Latest Check Status'] && game.fields['Latest Check Status'].length > 0 && (
              <div className="flex items-center gap-1.5">
                {game.fields['Latest Check Status'][0] === 'Complete' && (
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                )}
                {game.fields['Latest Check Status'][0] === 'Issues Found' && (
                  <AlertCircle className="h-3 w-3 text-yellow-600" />
                )}
                {game.fields['Latest Check Status'][0] === 'Missing' && (
                  <XCircle className="h-3 w-3 text-red-600" />
                )}
                <span className="text-muted-foreground">
                  {game.fields['Latest Check Status'][0]}
                </span>
              </div>
            )}
            {game.fields['Latest Check Date'] && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                <span className="text-muted-foreground">
                  {new Date(game.fields['Latest Check Date']).toLocaleDateString()}
                </span>
              </div>
            )}
            {game.fields['Total Checks'] !== undefined && (
              <div className="text-muted-foreground">
                Checks: {game.fields['Total Checks']}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
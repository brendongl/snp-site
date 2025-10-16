'use client';

import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { BoardGame } from '@/types';
import { Users, Calendar, Brain, Clock } from 'lucide-react';

interface GameDetailModalProps {
  game: BoardGame | null;
  open: boolean;
  onClose: () => void;
}

export function GameDetailModal({ game, open, onClose }: GameDetailModalProps) {
  if (!game) return null;

  const images = game.fields.Images || [];
  const mainImage = images[0];
  const secondaryImage = images[1];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {game.fields['Game Name']}
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Images Section */}
          <div className="space-y-4">
            {mainImage && (
              <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                <Image
                  src={mainImage.url}
                  alt={game.fields['Game Name']}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            )}
            {secondaryImage && (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                <Image
                  src={secondaryImage.url}
                  alt={`${game.fields['Game Name']} - Gameplay`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            )}
          </div>

          {/* Details Section */}
          <div className="space-y-4">
            {/* Quick Info */}
            <div className="grid grid-cols-2 gap-4">
              {game.fields['Min Players (BG)'] && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Players</p>
                    <p className="font-medium">
                      {game.fields['Min Players (BG)']} - {game.fields['Max. Players (BG)']}
                    </p>
                  </div>
                </div>
              )}

              {game.fields['Year Released'] && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Released</p>
                    <p className="font-medium">{game.fields['Year Released']}</p>
                  </div>
                </div>
              )}

              {game.fields['Complexity / Difficulty'] && (
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Complexity</p>
                    <p className="font-medium">
                      {game.fields['Complexity / Difficulty']}/5
                    </p>
                  </div>
                </div>
              )}

              {game.fields['Date of Acquisition'] && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Acquired</p>
                    <p className="font-medium">
                      {new Date(game.fields['Date of Acquisition']).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Categories */}
            {game.fields.Categories && game.fields.Categories.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {game.fields.Categories.map((category) => (
                    <Badge key={category} variant="secondary">
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {game.fields.Description && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Description</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {game.fields.Description}
                </p>
              </div>
            )}

            {/* Complexity Stars */}
            {game.fields['Complexity / Difficulty'] && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Difficulty Rating</h3>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-6 w-6 rounded-full ${
                        i < game.fields['Complexity / Difficulty']!
                          ? 'bg-primary'
                          : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
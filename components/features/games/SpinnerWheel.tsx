'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { BoardGame } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown, Play } from 'lucide-react';

interface SpinnerWheelProps {
  games: BoardGame[];
  open: boolean;
  onClose: () => void;
  onComplete: (game: BoardGame) => void;
}

const ICON_HEIGHT = 120;
const VISIBLE_ICONS = 3;
const TIME_PER_ICON = 100;

export function SpinnerWheel({ games, open, onClose, onComplete }: SpinnerWheelProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedGame, setSelectedGame] = useState<BoardGame | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const reelRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Create tripled game array for infinite scroll effect
  const tripledGames = [...games, ...games, ...games];

  // Reset when opening - start at middle section
  useEffect(() => {
    if (open && games.length > 0) {
      setSelectedGame(null);
      setIsSpinning(false);
      setCurrentIndex(0);
      // Position at middle section minus half viewport to center some images
      const startOffset = -(games.length * ICON_HEIGHT - ICON_HEIGHT * 1.5);
      setTranslateY(startOffset);
    }
  }, [open, games.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const roll = () => {
    if (isSpinning || games.length === 0) return;

    setIsSpinning(true);
    setSelectedGame(null);

    const reel = reelRef.current;
    if (!reel) return;

    // Random duration between 3-5 seconds
    const duration = 3000 + Math.random() * 2000; // 3000-5000ms

    // Calculate spin parameters - spin 3-6 full rounds
    const minRounds = 3;
    const maxRounds = 6;
    const rounds = minRounds + Math.random() * (maxRounds - minRounds);
    const extraSlots = Math.floor(Math.random() * games.length);
    const totalSlots = Math.round(rounds * games.length) + extraSlots;

    // Calculate spin distance
    const spinDistance = totalSlots * ICON_HEIGHT;

    // Get current position (could be initial or from previous spin)
    const currentPosition = Math.abs(translateY);
    const targetPosition = currentPosition + spinDistance;

    // Apply animation with ease-out for slow-down effect
    reel.style.transition = `transform ${duration}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
    setTranslateY(-targetPosition);

    // After animation completes
    timeoutRef.current = setTimeout(() => {
      // Calculate final position within middle section of tripled array
      const middleSectionStart = games.length * ICON_HEIGHT;
      const positionInSection = targetPosition % (games.length * ICON_HEIGHT);
      const normalizedPosition = middleSectionStart + positionInSection;
      const finalIndex = Math.round(positionInSection / ICON_HEIGHT) % games.length;

      // Reset to normalized position without animation
      reel.style.transition = 'none';
      setTranslateY(-normalizedPosition);

      // Set selected game
      setCurrentIndex(finalIndex);
      setSelectedGame(games[finalIndex]);
      setIsSpinning(false);
    }, duration);
  };

  const handleYes = () => {
    if (selectedGame) {
      onComplete(selectedGame);
      onClose();
    }
  };

  const handleNo = () => {
    roll();
  };

  const handleClose = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsSpinning(false);
    setSelectedGame(null);
    onClose();
  };

  if (games.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold">
            {isSpinning ? '🎰 Spinning...' : selectedGame ? '🎉 You Got!' : 'Random Game Picker'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-6 gap-6">
          {/* Slot Machine Container */}
          <div className="relative">
            {/* Slot frame with gradient borders */}
            <div
              className="relative w-[280px] h-[360px] p-4 rounded-lg shadow-2xl"
              style={{
                background: 'linear-gradient(45deg, #666 0%, #ccc 100%)',
                borderTop: '1px solid rgba(255, 255, 255, 0.6)',
                borderRight: '1px solid rgba(255, 255, 255, 0.6)',
                borderLeft: '1px solid rgba(0, 0, 0, 0.4)',
                borderBottom: '1px solid rgba(0, 0, 0, 0.4)',
                boxShadow: '-2px 2px 3px rgba(0, 0, 0, 0.3)'
              }}
            >
              {/* Center highlight line */}
              <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-[120px] border-y-4 border-yellow-400 pointer-events-none z-10 rounded-md"
                style={{
                  background: 'rgba(255, 215, 0, 0.1)'
                }}
              />

              {/* Reel container */}
              <div className="relative w-full h-full rounded-md overflow-hidden border border-black/30 bg-gray-800">
                {/* Reel with game images - using transform for animation */}
                <div
                  ref={reelRef}
                  className="absolute w-full"
                  style={{
                    transform: `translateY(${translateY}px)`,
                    transition: 'none',
                  }}
                >
                  {/* Create tripled stacked game images for infinite scroll */}
                  {tripledGames.map((game, index) => {
                    const imageUrl = game.fields.Images?.[0]?.thumbnails?.large?.url ||
                                     game.fields.Images?.[0]?.url;
                    return (
                      <div
                        key={`${game.id}-${index}`}
                        className="w-full flex items-center justify-center"
                        style={{
                          height: ICON_HEIGHT,
                        }}
                      >
                        <div className="relative w-24 h-24 rounded-lg overflow-hidden">
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={game.fields['Game Name']}
                              fill
                              className="object-cover"
                              sizes="96px"
                              priority={index < games.length * 2} // Preload first two sets
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-700 text-gray-400 text-xs">
                              No Image
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Gradient overlay for depth effect */}
                <div
                  className="absolute inset-0 pointer-events-none z-20"
                  style={{
                    background: 'linear-gradient(rgba(0,0,0,0.4) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.4) 100%)',
                    boxShadow: 'inset 0 0 6px 2px rgba(0, 0, 0, 0.3)'
                  }}
                />
              </div>
            </div>

            {/* Win animation */}
            {selectedGame && (
              <div
                className="absolute inset-0 rounded-lg pointer-events-none animate-pulse"
                style={{
                  background: 'linear-gradient(45deg, rgba(255, 165, 0, 0.3) 0%, rgba(255, 255, 0, 0.3) 100%)',
                  boxShadow: '0 0 80px rgba(255, 165, 0, 0.5)',
                  animation: 'pulse 500ms ease-in-out 3'
                }}
              />
            )}
          </div>

          {/* Selected game display */}
          {selectedGame && (
            <div className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="text-xl font-bold text-foreground">
                {selectedGame.fields['Game Name']}
              </h3>
              <p className="text-sm text-muted-foreground">
                {selectedGame.fields['Min Players']}-{selectedGame.fields['Max. Players']} Players
                {selectedGame.fields['Complexity'] && ` • Complexity: ${selectedGame.fields['Complexity']}`}
              </p>
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex flex-col gap-3 w-full">
            {selectedGame ? (
              <div className="flex gap-3">
                <Button
                  onClick={handleNo}
                  variant="outline"
                  size="lg"
                  className="flex-1 gap-2 bg-red-50 border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800 hover:border-red-400"
                >
                  <ThumbsDown className="w-5 h-5" />
                  No - Spin Again
                </Button>
                <Button
                  onClick={handleYes}
                  size="lg"
                  className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  <ThumbsUp className="w-5 h-5" />
                  Yes - Play This!
                </Button>
              </div>
            ) : (
              <Button
                onClick={roll}
                disabled={isSpinning}
                size="lg"
                className="w-full gap-2"
              >
                <Play className="w-5 h-5" />
                {isSpinning ? 'Spinning...' : 'Spin!'}
              </Button>
            )}
          </div>

          {/* Game count indicator */}
          <p className="text-sm text-muted-foreground">
            Selecting from {games.length} games
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

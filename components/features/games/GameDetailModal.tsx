'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BoardGame } from '@/types';
import { Users, Calendar, Brain, Clock, History, ClipboardCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { ContentCheckBadge } from '@/components/features/content-check/ContentCheckBadge';
import { ContentCheckHistory } from '@/components/features/content-check/ContentCheckHistory';
import { ContentCheckDialog } from '@/components/features/content-check/ContentCheckDialog';
import { AddGameKnowledgeDialog } from '@/components/features/staff/AddGameKnowledgeDialog';
import { useStaffMode } from '@/lib/hooks/useStaffMode';

interface GameDetailModalProps {
  game: BoardGame | null;
  open: boolean;
  onClose: () => void;
}

export function GameDetailModal({ game, open, onClose }: GameDetailModalProps) {
  const isStaff = useStaffMode();
  const [showHistory, setShowHistory] = useState(false);
  const [showContentCheck, setShowContentCheck] = useState(false);
  const [showAddKnowledge, setShowAddKnowledge] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState<Record<string, boolean>>({});
  const [expansions, setExpansions] = useState<BoardGame[]>([]);
  const [loadingExpansions, setLoadingExpansions] = useState(false);
  const [selectedExpansion, setSelectedExpansion] = useState<BoardGame | null>(null);
  const [showExpansionModal, setShowExpansionModal] = useState(false);

  // Reset loaded images when modal closes
  useEffect(() => {
    if (!open) {
      setImageLoaded({});
      setExpansions([]);
      setSelectedExpansion(null);
      setShowExpansionModal(false);
    }
  }, [open]);

  const handleExpansionClick = (expansion: BoardGame) => {
    setSelectedExpansion(expansion);
    setShowExpansionModal(true);
  };

  const handleExpansionModalClose = () => {
    setShowExpansionModal(false);
    setSelectedExpansion(null);
  };

  // Fetch expansions when modal opens
  useEffect(() => {
    const fetchExpansions = async () => {
      if (!open || !game || !game.fields['Game Expansions Link'] || game.fields['Game Expansions Link'].length === 0) {
        return;
      }

      setLoadingExpansions(true);
      try {
        const response = await fetch('/api/games');
        const data = await response.json();

        // Filter to get only the expansion games linked to this base game
        const expansionGames = data.games.filter((g: BoardGame) =>
          game.fields['Game Expansions Link']!.includes(g.id)
        );

        setExpansions(expansionGames);
      } catch (error) {
        console.error('Failed to fetch expansions:', error);
      } finally {
        setLoadingExpansions(false);
      }
    };

    fetchExpansions();
  }, [open, game]);

  // Scroll to 2nd image by default when modal opens
  useEffect(() => {
    if (open && game && scrollContainerRef.current && game.fields.Images && game.fields.Images.length > 1) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        if (scrollContainerRef.current) {
          const scrollAmount = scrollContainerRef.current.clientWidth;
          scrollContainerRef.current.scrollTo({
            left: scrollAmount,
            behavior: 'auto'
          });
        }
      }, 100);
    }
  }, [open, game]);

  if (!game) return null;

  const images = game.fields.Images || [];

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.clientWidth;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-4xl max-h-[90vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {game.fields['Game Name']}
          </DialogTitle>
        </DialogHeader>

        {/* Staff Section - Top (Staff Only) */}
        {isStaff && (
          <div className="border rounded-lg p-4 bg-muted/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <h3 className="text-sm font-semibold">Staff Section</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowAddKnowledge(true)}
                  className="gap-2 w-full sm:w-auto"
                >
                  <Brain className="w-4 h-4" />
                  Add Knowledge
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowContentCheck(true)}
                  className="gap-2 w-full sm:w-auto"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  Do Content Check
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHistory(true)}
                  className="gap-2 w-full sm:w-auto"
                >
                  <History className="w-4 h-4" />
                  View History
                </Button>
              </div>
            </div>

            <ContentCheckBadge
              status={game.fields['Latest Check Status']}
              sleeved={game.fields.Sleeved}
              boxWrapped={game.fields['Box Wrapped']}
              className="mb-3"
            />

            {game.fields['Latest Check Date'] && (
              <div className="text-xs text-muted-foreground mb-2">
                Last checked: {new Date(game.fields['Latest Check Date']).toLocaleDateString()}
                {game.fields['Total Checks'] && ` (${game.fields['Total Checks']} total checks)`}
              </div>
            )}

            {game.fields['Latest Check Notes'] && (
              <div className="p-3 bg-background rounded-md">
                <p className="text-xs font-medium mb-1">Latest Notes:</p>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {game.fields['Latest Check Notes'][0]}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 min-w-0">
          {/* Images Section - Scrollable Carousel */}
          <div className="relative min-w-0">
            {images.length > 0 && (
              <>
                <div
                  ref={scrollContainerRef}
                  className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-hide min-w-0"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {images.map((image, index) => (
                    <div
                      key={image.id}
                      className="flex-shrink-0 w-full snap-center min-w-0 max-w-full"
                      style={{
                        scrollSnapAlign: index === 1 ? 'start' : 'center'
                      }}
                    >
                      <div className="relative w-full rounded-lg overflow-hidden bg-muted max-h-[400px] md:max-h-[500px] max-w-full flex items-center justify-center">
                        {/* Skeleton placeholder */}
                        {!imageLoaded[image.id] && (
                          <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
                            <div className="text-muted-foreground/50">Loading...</div>
                          </div>
                        )}
                        {/* Actual image */}
                        <Image
                          src={image.url}
                          alt={`${game.fields['Game Name']} - Image ${index + 1}`}
                          width={800}
                          height={800}
                          className="w-auto h-auto max-h-[400px] md:max-h-[500px] max-w-full object-contain"
                          style={{ display: imageLoaded[image.id] ? 'block' : 'none' }}
                          onLoad={() => setImageLoaded(prev => ({ ...prev, [image.id]: true }))}
                          priority={index < 2}
                          loading={index < 2 ? undefined : 'lazy'}
                          unoptimized
                          sizes="(max-width: 768px) calc(100vw - 2rem), 50vw"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Scroll buttons - Positioned inside the carousel container */}
                {images.length > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm z-10 h-8 w-8"
                      onClick={() => scroll('left')}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm z-10 h-8 w-8"
                      onClick={() => scroll('right')}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </>
            )}
          </div>

          {/* Details Section */}
          <div className="space-y-4">
            {/* Quick Info */}
            <div className="grid grid-cols-2 gap-4">
              {game.fields['Min Players'] && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Players</p>
                    <p className="font-medium">
                      {game.fields['Min Players']} - {game.fields['Max. Players']}
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

              {game.fields['Complexity'] && (
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Complexity</p>
                    <p className="font-medium">
                      {game.fields['Complexity']}/5
                    </p>
                  </div>
                </div>
              )}

              {game.fields['Date of Aquisition'] && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Acquired</p>
                    <p className="font-medium">
                      {new Date(game.fields['Date of Aquisition']).toLocaleDateString()}
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
            {game.fields['Complexity'] && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Difficulty Rating</h3>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-6 w-6 rounded-full ${
                        i < game.fields['Complexity']!
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

        {/* Expansions Section */}
        {game.fields['Game Expansions Link'] && game.fields['Game Expansions Link'].length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-lg font-semibold mb-4">Expansions</h3>
            {loadingExpansions ? (
              <div className="text-sm text-muted-foreground">Loading expansions...</div>
            ) : expansions.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {expansions.map((expansion) => (
                  <div
                    key={expansion.id}
                    className="border rounded-lg p-3 hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => handleExpansionClick(expansion)}
                  >
                    {expansion.fields.Images && expansion.fields.Images[0] && (
                      <div className="relative w-full h-32 mb-2 rounded overflow-hidden bg-muted">
                        <Image
                          src={expansion.fields.Images[0].url}
                          alt={expansion.fields['Game Name']}
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                    )}
                    <h4 className="font-medium text-sm mb-1">{expansion.fields['Game Name']}</h4>
                    {expansion.fields['Year Released'] && (
                      <p className="text-xs text-muted-foreground">
                        Released: {expansion.fields['Year Released']}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No expansions found.</div>
            )}
          </div>
        )}

        {/* Content Check History Modal */}
        {isStaff && (
          <ContentCheckHistory
            open={showHistory}
            onClose={() => setShowHistory(false)}
            gameId={game.id}
            gameName={game.fields['Game Name']}
          />
        )}

        {/* Content Check Dialog */}
        {isStaff && (
          <ContentCheckDialog
            open={showContentCheck}
            onClose={() => setShowContentCheck(false)}
            game={game}
            onSuccess={() => {
              // Optionally refresh the game data here
              // For now, just close the dialog
            }}
          />
        )}

        {/* Add Game Knowledge Dialog */}
        {isStaff && (
          <AddGameKnowledgeDialog
            isOpen={showAddKnowledge}
            onClose={() => setShowAddKnowledge(false)}
            gameId={game.id}
            gameName={game.fields['Game Name']}
          />
        )}
      </DialogContent>

      {/* Nested Modal for Expansion Details */}
      {selectedExpansion && (
        <GameDetailModal
          game={selectedExpansion}
          open={showExpansionModal}
          onClose={handleExpansionModalClose}
        />
      )}
    </Dialog>
  );
}
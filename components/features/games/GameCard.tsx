'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { BoardGame } from '@/types';
import { Users, Calendar, Brain, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import { PlayLogDialog } from '@/components/features/staff/PlayLogDialog';
import { ContentCheckOrIssueDialog } from '@/components/features/content-check/ContentCheckOrIssueDialog';
import { IssueReportDialog } from '@/components/features/games/IssueReportDialog';
import { useToast } from '@/lib/context/toast-context';

interface GameCardProps {
  game: BoardGame;
  onClick: () => void;
  isStaff?: boolean;
  picturesOnlyMode?: boolean;
  staffKnowledgeLevel?: string;
  onKnowledgeBadgeClick?: () => void; // v1.2.0: Callback for knowledge badge click
  unresolvedIssueCount?: number; // v1.5.0: Number of unresolved issues for this game
  onIssueBadgeClick?: () => void; // v1.5.0: Callback for issue badge click
  staffId?: string; // v1.5.0: Staff ID for issue reporting
}

export function GameCard({ game, onClick, isStaff = false, picturesOnlyMode = false, staffKnowledgeLevel, onKnowledgeBadgeClick, unresolvedIssueCount = 0, onIssueBadgeClick, staffId }: GameCardProps) {
  const { addToast } = useToast();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showPlayLogDialog, setShowPlayLogDialog] = useState(false);
  const [showContentCheckOrIssueDialog, setShowContentCheckOrIssueDialog] = useState(false);
  const [showIssueReportDialog, setShowIssueReportDialog] = useState(false);

  // Reset image loaded state when game changes
  useEffect(() => {
    setImageLoaded(false);
  }, [game.id]);

  const handlePlayLogSuccess = (gameName: string) => {
    addToast(`✓ Successfully logged ${gameName}`, 'success', 3000);
  };

  // Check both PostgreSQL structure (game.images) and Airtable structure (game.fields.Images)
  const firstImage = game.images?.[0] || game.fields.Images?.[0];
  const originalImageUrl = firstImage?.url ||
    (firstImage && 'thumbnails' in firstImage ? firstImage.thumbnails?.large?.url : undefined);

  // Use hash-based route for PostgreSQL images, fallback to proxy for Airtable
  const imageHash = firstImage && 'hash' in firstImage ? firstImage.hash : null;
  const imageUrl = imageHash
    ? `/api/images/${imageHash}`
    : originalImageUrl
      ? `/api/images/proxy?url=${encodeURIComponent(originalImageUrl)}`
      : undefined;

  // v1.2.0: Check if game has issues (for red outline in staff mode)
  const hasIssue = isStaff && (game as any).latestCheck?.hasIssue === true;

  return (
    <div
      className={`group cursor-pointer rounded-lg border bg-card text-card-foreground shadow-sm transition-all hover:shadow-lg ${
        hasIssue ? 'ring-2 ring-red-500' : ''
      }`}
      onClick={onClick}
    >
      <div className={`aspect-square relative overflow-hidden bg-muted ${picturesOnlyMode ? 'rounded-lg' : 'rounded-t-lg'}`}>
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

            {/* v1.5.0: Issue badge - top left overlay (staff mode only) */}
            {isStaff && unresolvedIssueCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onIssueBadgeClick) {
                    onIssueBadgeClick();
                  }
                }}
                className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-red-500/90 backdrop-blur-sm px-2 py-1 rounded hover:bg-red-600/90 transition-colors"
                title={`${unresolvedIssueCount} unresolved issue${unresolvedIssueCount > 1 ? 's' : ''} (Click to view)`}
              >
                <AlertCircle className="h-3 w-3 text-white" />
                <span className="text-xs text-white font-semibold">{unresolvedIssueCount}</span>
              </button>
            )}

            {/* v1.5.0: Content Check or Report Issue Button - bottom center overlay */}
            {isStaff && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowContentCheckOrIssueDialog(true);
                }}
                className="absolute bottom-3 left-1/2 transform -translate-x-1/2 z-20 flex items-center justify-center w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80 transition-colors"
                title="Content Check or Report Issue"
              >
                <span className="text-xl">📋</span>
              </button>
            )}

            {/* Staff Play Log Button - bottom right overlay (always visible on mobile) */}
            {isStaff && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPlayLogDialog(true);
                  }}
                  className="absolute bottom-3 right-3 z-20 flex items-center justify-center w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80 transition-colors"
                  title="Log game play"
                >
                  <span className="text-xl">📊</span>
                </button>
              </div>
            )}

            {/* Staff Knowledge Badge - bottom left overlay (v1.2.0: Clickable for edit/delete) */}
            {isStaff && staffKnowledgeLevel && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onKnowledgeBadgeClick) {
                    onKnowledgeBadgeClick();
                  }
                }}
                className="absolute bottom-2 left-2 z-20"
                title={`Knowledge: ${staffKnowledgeLevel} (Click to edit/delete)`}
                aria-label={`Edit or delete knowledge for ${game.fields['Game Name']}`}
              >
                {(staffKnowledgeLevel === 'Expert' || staffKnowledgeLevel === 'Instructor') ? (
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500 shadow-lg cursor-pointer hover:bg-green-600 transition-colors"
                    style={{ WebkitTransform: 'translateZ(0)' }}
                  >
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-500 shadow-lg cursor-pointer hover:bg-yellow-600 transition-colors"
                    style={{ WebkitTransform: 'translateZ(0)' }}
                  >
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <span className="text-sm">No image</span>
          </div>
        )}
      </div>

      {/* Game details - hidden in gallery mode */}
      {!picturesOnlyMode && (
        <div className={isStaff ? 'p-2' : 'p-3'}>
          <h3 className={`font-semibold ${isStaff ? 'text-xs' : 'text-sm'} line-clamp-2 mb-1`}>
            {game.fields['Game Name']}
          </h3>

          {/* v1.2.0: Issue text replaces categories in staff mode */}
          {isStaff && hasIssue && (game as any).latestCheck?.missingPieces && (
            <div className="mb-2 text-xs text-red-600 font-medium">
              ⚠️ {(game as any).latestCheck.missingPieces}
            </div>
          )}

          {/* Categories - HIDDEN in staff mode */}
          {!isStaff && game.fields.Categories && game.fields.Categories.length > 0 && (
            <div className="mb-2 text-xs text-muted-foreground">
              {game.fields.Categories.join(', ')}
            </div>
          )}

          {/* Two-line compact info layout */}
          <div className="space-y-1">
            {/* Line 1: Player count / Complexity */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {game.fields['Max. Players'] && (
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>
                    {game.fields['Min Players'] === game.fields['Max. Players']
                      ? game.fields['Max. Players']
                      : `${game.fields['Min Players'] || 1}-${game.fields['Max. Players']}`
                    }
                  </span>
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

            {/* Line 2: Playtime, Check count, Priority */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {(game.fields['Min Playtime'] || game.fields['Max Playtime']) && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>
                    {game.fields['Min Playtime'] === game.fields['Max Playtime']
                      ? `${game.fields['Min Playtime']}m`
                      : `${game.fields['Min Playtime'] || '?'}-${game.fields['Max Playtime'] || '?'}m`
                    }
                  </span>
                </div>
              )}

              {/* v1.3.0: Staff mode - show 📚 icon with check count + criterion color indicator */}
              {isStaff && (
                <div className="flex items-center gap-1">
                  <span>📚</span>
                  <span>{game.fields['Total Checks'] || 0}</span>
                  {(game as any).needsCheckingInfo?.needsChecking && (game as any).needsCheckingInfo?.criterionColor && (
                    <span className="ml-0.5">{(game as any).needsCheckingInfo.criterionColor}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Play Log Dialog */}
      <PlayLogDialog
        isOpen={showPlayLogDialog}
        onClose={() => setShowPlayLogDialog(false)}
        gameId={game.id}
        gameName={game.fields['Game Name']}
        onSuccess={handlePlayLogSuccess}
      />

      {/* v1.5.0: Content Check or Issue Dialog */}
      <ContentCheckOrIssueDialog
        game={game}
        isOpen={showContentCheckOrIssueDialog}
        onClose={() => setShowContentCheckOrIssueDialog(false)}
        onOpenContentCheck={() => {
          // Open existing content check dialog (to be implemented)
          addToast('Content check feature coming soon', 'info', 2000);
        }}
        onOpenIssueReport={() => {
          setShowIssueReportDialog(true);
        }}
      />

      {/* v1.5.0: Issue Report Dialog */}
      {staffId && (
        <IssueReportDialog
          isOpen={showIssueReportDialog}
          onClose={() => setShowIssueReportDialog(false)}
          gameId={game.id}
          gameName={game.fields['Game Name']}
          staffId={staffId}
          onSuccess={(message) => {
            addToast(message, 'success', 3000);
          }}
        />
      )}
    </div>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Zap, Check, LayoutGrid, List } from 'lucide-react';
import { StaffMenu } from '@/components/features/staff/StaffMenu';

interface Game {
  id: string;
  name: string;
  image: string;
  isExpansion?: boolean;
}

const CONFIDENCE_LEVELS = ['Beginner', 'Intermediate', 'Expert', 'Instructor'];
const GAMES_PER_PAGE = 100;

export default function AddKnowledgePage() {
  const router = useRouter();
  const [staffName, setStaffName] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [step, setStep] = useState<'select-level' | 'select-games'>('select-level');
  const [confidenceLevel, setConfidenceLevel] = useState<string | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [filteredGames, setFilteredGames] = useState<Game[]>([]);
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clearConfirmed, setClearConfirmed] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showLevelExplanation, setShowLevelExplanation] = useState(false);
  const [pendingLevel, setPendingLevel] = useState<string | null>(null);
  const [hideKnownGames, setHideKnownGames] = useState(true);
  const [knownGameIds, setKnownGameIds] = useState<Set<string>>(new Set());

  // Check authentication
  useEffect(() => {
    const name = localStorage.getItem('staff_name');
    // Use staff_record_id (StaffList table ID) instead of staff_id for database operations
    const id = localStorage.getItem('staff_record_id');
    if (!name || !id) {
      router.push('/auth/signin');
      return;
    }
    setStaffName(name);
    setStaffId(id);
  }, [router]);

  // Fetch games and filter out ones the staff member already knows
  useEffect(() => {
    const fetchGames = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/games-with-expansions');

        if (!response.ok) {
          throw new Error(`Failed to fetch games: ${response.statusText}`);
        }

        const data = await response.json();
        const gamesList = (data.games || []).map((game: any) => {
          let imageUrl = '/placeholder-game.png';

          // Check both PostgreSQL structure (game.images) and Airtable structure (game.fields.Images)
          const firstImage = game.images?.[0] || game.fields?.Images?.[0];
          if (firstImage) {
            // Use hash-based route for PostgreSQL images, fallback to proxy for Airtable
            const imageHash = firstImage.hash;
            if (imageHash) {
              imageUrl = `/api/images/${imageHash}`;
            } else {
              const originalUrl = firstImage.url || firstImage.thumbnails?.large?.url;
              if (originalUrl) {
                imageUrl = `/api/images/proxy?url=${encodeURIComponent(originalUrl)}`;
              }
            }
          }

          return {
            id: game.id,
            name: game.fields?.['Game Name'] || game.name || 'Unknown Game',
            image: imageUrl,
            isExpansion: game.isExpansion || false,
          };
        });

        // Fetch staff knowledge to filter out games the user already knows
        try {
          if (staffId) {
            // Fetch staff knowledge from PostgreSQL via our API
            const knowledgeResponse = await fetch('/api/staff-knowledge');

            if (knowledgeResponse.ok) {
              const knowledgeData = await knowledgeResponse.json();
              const knownIds = new Set<string>();

              // Filter for current staff member's knowledge
              knowledgeData.knowledge?.forEach((entry: any) => {
                if (entry.staffMember === staffName) {
                  // Get the game ID from the knowledge entry
                  // We need to look up the game ID by name
                  const matchingGame = gamesList.find((g: any) => {
                    // Remove expansion suffix for matching
                    const gameName = entry.gameName;
                    const cleanGameName = g.name.replace(/ \(Expansion for .*\)$/, '');
                    return cleanGameName === gameName || g.name === gameName;
                  });
                  if (matchingGame) {
                    knownIds.add(matchingGame.id);
                  }
                }
              });

              setKnownGameIds(knownIds);
            }
          }
        } catch (err) {
          console.error('Error fetching staff knowledge for filtering:', err);
          // Continue with all games if knowledge fetch fails
        }

        setGames(gamesList);
        // Apply filtering based on hideKnownGames state
        setFilteredGames(gamesList);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load games');
        setGames([]);
        setFilteredGames([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (step === 'select-games' && staffName) {
      fetchGames();
    }
  }, [step, staffName]);

  // Apply filtering based on hideKnownGames toggle
  useEffect(() => {
    if (games.length > 0) {
      if (hideKnownGames && knownGameIds.size > 0) {
        setFilteredGames(games.filter(game => !knownGameIds.has(game.id)));
      } else {
        setFilteredGames(games);
      }
    }
  }, [games, hideKnownGames, knownGameIds]);

  const getLevelExplanation = (level: string) => {
    switch (level) {
      case 'Beginner':
        return "You have played this game once or watched others play.\n\nYou CANNOT teach this game to customers.";
      case 'Intermediate':
        return "You have played this game several times.\n\nYou can teach the game, but you need to check the manual sometimes.";
      case 'Expert':
        return "You CAN TEACH this game to customers without the manual.\n\nYou only need the manual for rare or unusual rules.";
      case 'Instructor':
        return "You are a MASTER of this game.\n\nYou can teach ALL rules, including rare situations. No manual needed!";
      default:
        return "";
    }
  };

  const handleConfidenceLevelSelect = (level: string) => {
    setPendingLevel(level);
    setShowLevelExplanation(true);
  };

  const confirmLevelSelection = () => {
    if (pendingLevel) {
      setConfidenceLevel(pendingLevel);
      setStep('select-games');
      setCurrentPage(1);
      setSelectedGames(new Set());
      setClearConfirmed(false);
      setShowLevelExplanation(false);
      setPendingLevel(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const cancelLevelSelection = () => {
    setShowLevelExplanation(false);
    setPendingLevel(null);
  };

  const handleChangePage = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChangeLevel = () => {
    setStep('select-level');
    setSelectedGames(new Set());
    setClearConfirmed(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearAll = () => {
    if (!clearConfirmed) {
      setClearConfirmed(true);
      setTimeout(() => setClearConfirmed(false), 3000);
    } else {
      setSelectedGames(new Set());
      setClearConfirmed(false);
    }
  };

  const toggleGameSelection = (gameId: string) => {
    const newSelected = new Set(selectedGames);
    if (newSelected.has(gameId)) {
      newSelected.delete(gameId);
    } else {
      newSelected.add(gameId);
    }
    setSelectedGames(newSelected);
  };

  const handleAllDone = async () => {
    if (selectedGames.size === 0 || !confidenceLevel || !staffId || !staffName) {
      alert('Please select at least one game');
      return;
    }

    const confirmMessage = `I "${staffName}" hereby swear that the games i have marked i am a "${confidenceLevel}" in. Any false-information may have penalties.

Click OK to confirm or Cancel to go back.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await fetch('/api/staff-knowledge/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffMemberId: staffId,
          gameIds: Array.from(selectedGames),
          confidenceLevel: confidenceLevel,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create records');
      }

      const data = await response.json();
      alert(`Successfully created ${data.created} knowledge records!`);
      router.push('/staff/knowledge?fromAdd=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate pagination
  const totalPages = Math.ceil(filteredGames.length / GAMES_PER_PAGE);
  const startIndex = (currentPage - 1) * GAMES_PER_PAGE;
  const paginatedGames = filteredGames.slice(startIndex, startIndex + GAMES_PER_PAGE);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <div className="flex items-center justify-between gap-3 mb-4">
            <Link href="/staff/knowledge" className="inline-flex items-center gap-2 text-primary hover:text-primary/80">
              <ArrowLeft className="w-4 h-4" />
              Back to Knowledge
            </Link>
            <StaffMenu />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Bulk Knowledge Updater</h1>
            <p className="text-muted-foreground mt-2">
              {staffName && `Logged in as ${staffName}`}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Step 1: Select Confidence Level */}
        {step === 'select-level' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-card rounded-lg border border-border p-8 text-center">
              <h2 className="text-2xl font-bold mb-6">Select a confidence level for the games you are adding</h2>
              <div className="flex flex-wrap gap-4 justify-center">
                {CONFIDENCE_LEVELS.map(level => (
                  <button
                    key={level}
                    onClick={() => handleConfidenceLevelSelect(level)}
                    className="px-6 py-3 rounded-lg font-medium bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Select Games */}
        {step === 'select-games' && (
          <div>
            {/* Sticky Header with Controls */}
            <div className="sticky top-0 z-50 bg-background border-b border-border mb-6">
              <div className="p-4 space-y-3">
                {/* Header Info */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Select Games - {confidenceLevel}</h2>
                    <p className="text-muted-foreground mt-1">
                      Selected: {selectedGames.size} games — Page {currentPage} of {totalPages || 1}
                      {knownGameIds.size > 0 && hideKnownGames && (
                        <span className="text-primary"> — Hiding {knownGameIds.size} known games</span>
                      )}
                    </p>
                  </div>

                  {/* Toggle for hiding/showing known games */}
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hideKnownGames}
                        onChange={(e) => setHideKnownGames(e.target.checked)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-medium">Hide games I already know</span>
                    </label>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    onClick={handleChangeLevel}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                  >
                    Change Level
                  </button>

                  <button
                    onClick={handleClearAll}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      clearConfirmed
                        ? 'bg-red-500 text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {clearConfirmed ? '✓ Click again to clear all' : 'Clear All'}
                  </button>

                  {/* View Toggle Buttons */}
                  <div className="flex gap-1 border border-border rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                        viewMode === 'grid'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <LayoutGrid className="w-4 h-4" />
                      Images
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                        viewMode === 'list'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <List className="w-4 h-4" />
                      List
                    </button>
                  </div>

                  <button
                    onClick={handleAllDone}
                    disabled={selectedGames.size === 0 || isSubmitting}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-auto"
                  >
                    {isSubmitting ? 'Creating...' : `All Done (${selectedGames.size})`}
                  </button>
                </div>
              </div>
            </div>

            {/* Error State */}
            {error && (
              <div className="bg-destructive/10 text-destructive rounded-lg p-4 mb-6">
                <p className="font-medium">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="text-center py-12">
                <div className="inline-flex items-center gap-2">
                  <Zap className="w-5 h-5 animate-spin" />
                  <span>Loading games...</span>
                </div>
              </div>
            )}

            {/* Games Grid View */}
            {!isLoading && viewMode === 'grid' && (
              <>
                <div className="grid grid-cols-3 gap-6 mb-8">
                  {paginatedGames.map(game => (
                    <div
                      key={game.id}
                      className="relative cursor-pointer group"
                      onClick={() => toggleGameSelection(game.id)}
                    >
                      {/* Game Image */}
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                        <img
                          src={game.image}
                          alt={game.name}
                          className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder-game.png';
                          }}
                        />

                        {/* Checkbox Overlay */}
                        <div className="absolute bottom-2 right-2">
                          <div
                            className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                              selectedGames.has(game.id)
                                ? 'bg-green-500 border-green-600'
                                : 'bg-white/80 border-gray-300'
                            }`}
                          >
                            {selectedGames.has(game.id) && (
                              <Check className="w-4 h-4 text-white" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Game Name */}
                      <p className="mt-2 text-sm font-medium truncate" title={game.name}>
                        {game.name}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mb-8">
                    <button
                      onClick={() => handleChangePage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/50 transition-colors"
                    >
                      ← Previous
                    </button>
                    <div className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </div>
                    <button
                      onClick={() => handleChangePage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/50 transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Games List View */}
            {!isLoading && viewMode === 'list' && (
              <>
                <div className="border border-border rounded-lg overflow-hidden mb-8">
                  <div className="divide-y divide-border">
                    {paginatedGames.map(game => (
                      <div
                        key={game.id}
                        className="p-3 hover:bg-muted/50 transition-colors cursor-pointer flex items-center gap-3"
                        onClick={() => toggleGameSelection(game.id)}
                      >
                        {/* Checkbox */}
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            selectedGames.has(game.id)
                              ? 'bg-green-500 border-green-600'
                              : 'border-border bg-background'
                          }`}
                        >
                          {selectedGames.has(game.id) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>

                        {/* Game Name */}
                        <span className="text-sm font-medium flex-1">
                          {game.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mb-8">
                    <button
                      onClick={() => handleChangePage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/50 transition-colors"
                    >
                      ← Previous
                    </button>
                    <div className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </div>
                    <button
                      onClick={() => handleChangePage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/50 transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Level Explanation Dialog */}
      {showLevelExplanation && pendingLevel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 max-w-2xl w-full p-6">
            <h3 className="text-2xl font-bold mb-4">{pendingLevel} Level</h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6 whitespace-pre-line">
              {getLevelExplanation(pendingLevel)}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelLevelSelection}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={confirmLevelSelection}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                I Understand, Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

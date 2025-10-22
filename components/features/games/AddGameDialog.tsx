'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Loader2, Check, AlertCircle, HelpCircle, ChevronsUpDown } from 'lucide-react';
import { CreateGameInput, BGGGameData } from '@/types';
import { cn } from '@/lib/utils';

interface AddGameDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Game {
  id: string;
  name: string;
  year: number;
}

export function AddGameDialog({ open, onClose, onSuccess }: AddGameDialogProps) {
  const [bggId, setBggId] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [gameSize, setGameSize] = useState('');
  const [deposit, setDeposit] = useState('');
  const [dateOfAcquisition, setDateOfAcquisition] = useState(new Date().toISOString().split('T')[0]);
  const [isExpansion, setIsExpansion] = useState(false);
  const [baseGameId, setBaseGameId] = useState('');

  const [loading, setLoading] = useState(false);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<BGGGameData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Image selection state
  const [selectedBoxImage, setSelectedBoxImage] = useState<string | null>(null);
  const [selectedGameplayImage, setSelectedGameplayImage] = useState<string | null>(null);

  // Custom image URL state
  const [customImageUrls, setCustomImageUrls] = useState<string[]>(['']);
  const [useCustomImages, setUseCustomImages] = useState(false);

  // Base game selection state
  const [games, setGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);

  // Fetch games list when expansion checkbox is checked
  useEffect(() => {
    if (isExpansion && games.length === 0) {
      fetchGames();
    }
  }, [isExpansion]);

  const fetchGames = async () => {
    setLoadingGames(true);
    try {
      const response = await fetch('/api/games/list');
      if (response.ok) {
        const data = await response.json();
        setGames(data.games || []);
      }
    } catch (error) {
      console.error('Failed to fetch games:', error);
    } finally {
      setLoadingGames(false);
    }
  };

  const handleFetchPreview = async () => {
    const id = parseInt(bggId);
    if (isNaN(id) || id <= 0) {
      setError('Please enter a valid BGG ID');
      return;
    }

    setFetchingPreview(true);
    setError(null);
    setPreviewData(null);

    try {
      console.log('=== Starting BGG Preview Fetch ===');
      console.log('BGG ID:', id);

      // Build the full URL to ensure we're hitting the right endpoint
      const apiUrl = `${window.location.origin}/api/games/bgg/${id}`;
      console.log('Full API URL:', apiUrl);
      console.log('Window origin:', window.location.origin);
      console.log('Window href:', window.location.href);

      const response = await fetch(apiUrl);
      console.log('Response received:', response);
      console.log('Response status:', response.status);
      console.log('Response OK:', response.ok);

      const contentType = response.headers.get('content-type');
      console.log('Content-Type header:', contentType);

      if (!response.ok) {
        console.log('Response not OK, handling error...');
        // Try to parse as JSON, but handle if it's not JSON
        if (contentType && contentType.includes('application/json')) {
          console.log('Attempting to parse error response as JSON...');
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch game data');
        } else {
          console.log('Error response is not JSON, reading as text...');
          const text = await response.text();
          console.error('Non-JSON error response:', text);
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }

      // Check if response is JSON before parsing success response
      if (!contentType || !contentType.includes('application/json')) {
        console.error('SUCCESS response is not JSON! Content-Type:', contentType);
        const text = await response.text();
        console.error('Non-JSON response body:', text.substring(0, 500));
        throw new Error('Server returned non-JSON response. Please check server logs.');
      }

      console.log('Response is JSON, attempting to parse...');
      let data;
      try {
        data = await response.json();
        console.log('Successfully parsed JSON:', data);
      } catch (jsonError) {
        console.error('JSON PARSE ERROR:', jsonError);
        console.error('Failed to parse response as JSON');
        // Try to get the raw text to see what was returned
        const rawText = await response.text().catch(() => 'Could not read response text');
        console.error('Raw response that failed to parse:', rawText.substring(0, 500));
        throw new Error('Failed to parse server response as JSON');
      }
      setPreviewData(data.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching preview:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch game data');
      setPreviewData(null);
    } finally {
      setFetchingPreview(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const id = parseInt(bggId);
    if (isNaN(id) || id <= 0) {
      setError('Please enter a valid BGG ID');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const input: CreateGameInput = {
        bggId: id,
        isExpansion,
        dateOfAcquisition,
      };

      if (costPrice) input.costPrice = parseFloat(costPrice);
      if (gameSize) input.gameSize = gameSize;
      if (deposit) input.deposit = parseFloat(deposit);
      if (isExpansion && baseGameId) input.baseGameId = baseGameId;

      // Add selected images if both are chosen
      if (selectedBoxImage) {
        input.selectedImages = {
          boxImage: selectedBoxImage,
          gameplayImage: selectedGameplayImage || undefined,
        };
      }

      // Add custom image URLs if provided
      if (useCustomImages) {
        const validUrls = customImageUrls.filter(url => url.trim() !== '');
        if (validUrls.length > 0) {
          input.customImageUrls = validUrls;
        }
      }

      const response = await fetch('/api/games/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        // Try to parse as JSON, but handle if it's not JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create game');
        } else {
          const text = await response.text();
          console.error('Non-JSON error response:', text);
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error('Server returned non-JSON response. Please check server logs.');
      }

      const data = await response.json();
      console.log('Game created successfully:', data);

      setSuccess(true);
      setError(null);

      // Reset form after 2 seconds and close
      setTimeout(() => {
        handleClose();
        if (onSuccess) onSuccess();
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game');
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setBggId('');
    setCostPrice('');
    setGameSize('');
    setDeposit('');
    setDateOfAcquisition(new Date().toISOString().split('T')[0]);
    setIsExpansion(false);
    setBaseGameId('');
    setPreviewData(null);
    setError(null);
    setSuccess(false);
    setSelectedBoxImage(null);
    setSelectedGameplayImage(null);
    setCustomImageUrls(['']);
    setUseCustomImages(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Board Game</DialogTitle>
          <DialogDescription>
            Enter a BoardGameGeek ID to automatically import game details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* BGG ID Input */}
          <div className="space-y-2">
            <Label htmlFor="bggId">BoardGameGeek ID *</Label>
            <div className="flex gap-2">
              <Input
                id="bggId"
                type="number"
                value={bggId}
                onChange={(e) => setBggId(e.target.value)}
                placeholder="e.g., 13 for Catan"
                required
                disabled={loading || success}
              />
              <Button
                type="button"
                onClick={handleFetchPreview}
                disabled={!bggId || fetchingPreview || loading || success}
                variant="outline"
              >
                {fetchingPreview ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Preview'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Find the game ID from the URL on BoardGameGeek (e.g., boardgamegeek.com/boardgame/13/catan)
            </p>
          </div>

          {/* Preview Data */}
          {previewData && (
            <div className="border rounded-lg p-4 bg-muted/50 space-y-4">
              <h4 className="font-semibold">{previewData.name}</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Year:</span> {previewData.yearPublished}
                </div>
                <div>
                  <span className="text-muted-foreground">Players:</span> {previewData.minPlayers}-{previewData.maxPlayers}
                </div>
                <div>
                  <span className="text-muted-foreground">Complexity:</span> {previewData.complexity}/5
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span> {previewData.isExpansion ? 'Expansion' : 'Base Game'}
                </div>
              </div>

              {/* Image Selection */}
              {previewData.allImages && previewData.allImages.length > 0 && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-semibold">Select Box Image (1st image) *</Label>
                    <div className="grid grid-cols-5 gap-2 mt-2">
                      {previewData.allImages.slice(0, 10).map((url, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setSelectedBoxImage(url)}
                          className={`relative border-2 rounded-lg overflow-hidden transition-all ${
                            selectedBoxImage === url
                              ? 'border-primary ring-2 ring-primary ring-offset-2'
                              : 'border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          <img
                            src={url}
                            alt={`Option ${index + 1}`}
                            className="w-full h-20 object-cover"
                          />
                          {selectedBoxImage === url && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <Check className="h-6 w-6 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold">Select Gameplay Image (2nd image - optional)</Label>
                    <div className="grid grid-cols-5 gap-2 mt-2">
                      {previewData.allImages.slice(0, 10).map((url, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setSelectedGameplayImage(url)}
                          className={`relative border-2 rounded-lg overflow-hidden transition-all ${
                            selectedGameplayImage === url
                              ? 'border-green-500 ring-2 ring-green-500 ring-offset-2'
                              : 'border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          <img
                            src={url}
                            alt={`Option ${index + 1}`}
                            className="w-full h-20 object-cover"
                          />
                          {selectedGameplayImage === url && (
                            <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                              <Check className="h-6 w-6 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedGameplayImage(null)}
                      className="mt-2 text-xs"
                    >
                      Clear selection
                    </Button>
                  </div>

                  {/* Custom Image URLs Section */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center space-x-2 mb-3">
                      <input
                        type="checkbox"
                        id="useCustomImages"
                        checked={useCustomImages}
                        onChange={(e) => setUseCustomImages(e.target.checked)}
                        disabled={loading || success}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="useCustomImages" className="font-normal cursor-pointer text-sm">
                        Add custom image URLs (in addition to BGG images)
                      </Label>
                    </div>

                    {useCustomImages && (
                      <div className="space-y-2">
                        {customImageUrls.map((url, index) => (
                          <div key={index} className="flex gap-2">
                            <Input
                              type="url"
                              value={url}
                              onChange={(e) => {
                                const newUrls = [...customImageUrls];
                                newUrls[index] = e.target.value;
                                setCustomImageUrls(newUrls);
                              }}
                              placeholder="https://example.com/image.jpg"
                              disabled={loading || success}
                              className="flex-1"
                            />
                            {customImageUrls.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  setCustomImageUrls(customImageUrls.filter((_, i) => i !== index));
                                }}
                                disabled={loading || success}
                              >
                                ×
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCustomImageUrls([...customImageUrls, ''])}
                          disabled={loading || success}
                          className="w-full"
                        >
                          + Add Another Image URL
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Expansion Checkbox */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isExpansion"
              checked={isExpansion}
              onChange={(e) => setIsExpansion(e.target.checked)}
              disabled={loading || success}
              className="h-4 w-4"
            />
            <Label htmlFor="isExpansion" className="font-normal cursor-pointer">
              This is an expansion
            </Label>
          </div>

          {/* Base Game Selection (if expansion) */}
          {isExpansion && (
            <div className="space-y-2">
              <Label>Base Game (optional)</Label>
              <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboboxOpen}
                    className="w-full justify-between"
                    disabled={loading || success || loadingGames}
                  >
                    {loadingGames ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading games...
                      </>
                    ) : baseGameId ? (
                      games.find((game) => game.id === baseGameId)?.name || 'Select base game...'
                    ) : (
                      'Select base game...'
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Search games..." />
                    <CommandEmpty>No game found.</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      {games.map((game) => (
                        <CommandItem
                          key={game.id}
                          value={`${game.name} ${game.year}`}
                          onSelect={() => {
                            setBaseGameId(game.id);
                            setComboboxOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              baseGameId === game.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <div>
                            <div>{game.name}</div>
                            {game.year && (
                              <div className="text-xs text-muted-foreground">({game.year})</div>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Leave blank to link manually later
              </p>
            </div>
          )}

          {/* Cost Price */}
          <div className="space-y-2">
            <Label htmlFor="costPrice">Cost Price (optional)</Label>
            <Input
              id="costPrice"
              type="number"
              step="0.01"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              placeholder="0.00"
              disabled={loading || success}
            />
          </div>

          {/* Game Size */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="gameSize">Game Size (Rental) (optional)</Label>
              <div className="group relative">
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-popover text-popover-foreground text-xs rounded-md border shadow-md z-50">
                  1 = Smallest, 5 = Largest
                </div>
              </div>
            </div>
            <Select value={gameSize} onValueChange={setGameSize} disabled={loading || success}>
              <SelectTrigger id="gameSize" className="w-full">
                <SelectValue placeholder="Select size..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 (Smallest)</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5">5 (Largest)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Deposit */}
          <div className="space-y-2">
            <Label htmlFor="deposit">Deposit (optional)</Label>
            <Input
              id="deposit"
              type="number"
              step="0.01"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              placeholder="0.00"
              disabled={loading || success}
            />
          </div>

          {/* Date of Acquisition */}
          <div className="space-y-2">
            <Label htmlFor="dateOfAcquisition">Date of Acquisition</Label>
            <Input
              id="dateOfAcquisition"
              type="date"
              value={dateOfAcquisition}
              onChange={(e) => setDateOfAcquisition(e.target.value)}
              disabled={loading || success}
              required
            />
            <p className="text-xs text-muted-foreground">
              When was this game acquired by the cafe?
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md text-green-700">
              <Check className="h-4 w-4" />
              <p className="text-sm">Game added successfully! Refreshing...</p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading || success}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || success || !bggId || !!(previewData && !selectedBoxImage)}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Add Game'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

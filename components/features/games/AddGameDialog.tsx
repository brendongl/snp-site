'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Check, AlertCircle, HelpCircle, ChevronsUpDown, Upload, X } from 'lucide-react';
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
  // Mode toggle
  const [entryMode, setEntryMode] = useState<'bgg' | 'manual'>('bgg');

  // BGG Import fields
  const [bggId, setBggId] = useState('');
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<BGGGameData | null>(null);

  // Manual entry fields (all mandatory except categories/mechanisms/expansion)
  const [manualName, setManualName] = useState('');
  const [manualYear, setManualYear] = useState('');
  const [manualMinPlayers, setManualMinPlayers] = useState('');
  const [manualMaxPlayers, setManualMaxPlayers] = useState('');
  const [manualPlaytime, setManualPlaytime] = useState('');
  const [manualMinPlaytime, setManualMinPlaytime] = useState('');
  const [manualMaxPlaytime, setManualMaxPlaytime] = useState('');
  const [manualMinAge, setManualMinAge] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualComplexity, setManualComplexity] = useState('');
  const [manualBestPlayerCount, setManualBestPlayerCount] = useState('');
  const [manualCategories, setManualCategories] = useState('');
  const [manualMechanisms, setManualMechanisms] = useState('');

  // Shared fields
  const [costPrice, setCostPrice] = useState('');
  const [gameSize, setGameSize] = useState('');
  const [deposit, setDeposit] = useState('');
  const [dateOfAcquisition, setDateOfAcquisition] = useState(new Date().toISOString().split('T')[0]);
  const [isExpansion, setIsExpansion] = useState(false);
  const [baseGameId, setBaseGameId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Image selection state
  const [selectedBoxImage, setSelectedBoxImage] = useState<string | null>(null);
  const [selectedGameplayImage, setSelectedGameplayImage] = useState<string | null>(null);

  // Custom image URL state
  const [customImageUrls, setCustomImageUrls] = useState<string[]>(['']);
  const [useCustomImages, setUseCustomImages] = useState(false);

  // File upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setSelectedFiles(Array.from(files));

    // Clear input so same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
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
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch game data';

      // Add helpful context for BGG temporary blocks
      if (errorMessage.includes('temporarily unavailable')) {
        setError(errorMessage + ' BoardGameGeek may be rate limiting requests. Wait a few minutes and try again.');
      } else {
        setError(errorMessage);
      }
      setPreviewData(null);
    } finally {
      setFetchingPreview(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate mode-specific requirements
    if (entryMode === 'bgg') {
      const id = parseInt(bggId);
      if (isNaN(id) || id <= 0) {
        setError('Please enter a valid BGG ID');
        return;
      }
    } else {
      // Manual mode validation
      const totalImages = customImageUrls.filter(u => u.trim()).length + selectedFiles.length;
      if (totalImages < 2) {
        setError('Please provide at least 2 images');
        return;
      }
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      let input: CreateGameInput;

      if (entryMode === 'bgg') {
        // BGG Import mode
        const id = parseInt(bggId);
        input = {
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
      } else {
        // Manual Entry mode
        input = {
          manualEntry: {
            name: manualName,
            yearPublished: parseInt(manualYear),
            minPlayers: parseInt(manualMinPlayers),
            maxPlayers: parseInt(manualMaxPlayers),
            playingTime: parseInt(manualPlaytime),
            minPlaytime: parseInt(manualMinPlaytime),
            maxPlaytime: parseInt(manualMaxPlaytime),
            minAge: parseInt(manualMinAge),
            description: manualDescription,
            complexity: parseInt(manualComplexity),
            bestPlayerCount: parseInt(manualBestPlayerCount),
            categories: manualCategories ? manualCategories.split(',').map(c => c.trim()).filter(Boolean) : [],
            mechanisms: manualMechanisms ? manualMechanisms.split(',').map(m => m.trim()).filter(Boolean) : [],
          },
          isExpansion,
          dateOfAcquisition,
          costPrice: parseFloat(costPrice),
          gameSize,
          deposit: parseFloat(deposit),
        };

        if (isExpansion && baseGameId) input.baseGameId = baseGameId;

        // Add image URLs for manual entry
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
      const newGameId = data.gameId;

      // Upload selected files if any
      if (selectedFiles.length > 0 && newGameId) {
        const imageFormData = new FormData();
        imageFormData.append('gameId', newGameId);

        // Add staff info for changelog tracking
        const staffIdValue = localStorage.getItem('staff_record_id') || 'system';
        const staffNameValue = localStorage.getItem('staff_name') || 'System';
        imageFormData.append('staffId', staffIdValue);
        imageFormData.append('staffName', staffNameValue);

        selectedFiles.forEach((file) => {
          imageFormData.append('images', file);
        });

        const uploadResponse = await fetch(`/api/games/${newGameId}/images`, {
          method: 'POST',
          body: imageFormData,
        });

        if (!uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          console.warn('Failed to upload some images:', uploadData.error);
        } else {
          console.log('Successfully uploaded files');
        }
      }

      // Upload custom URL images if any
      if (useCustomImages && newGameId) {
        const validUrls = customImageUrls.filter(url => url.trim() !== '');
        if (validUrls.length > 0) {
          const staffIdValue = localStorage.getItem('staff_record_id') || 'system';
          const staffNameValue = localStorage.getItem('staff_name') || 'System';

          const urlResponse = await fetch(`/api/games/${newGameId}/images/from-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              urls: validUrls,
              staffId: staffIdValue,
              staffName: staffNameValue,
            }),
          });

          if (!urlResponse.ok) {
            const urlData = await urlResponse.json();
            console.warn('Failed to add some URL images:', urlData.error);
          } else {
            console.log('Successfully uploaded URL images');
          }
        }
      }

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
    // Reset BGG fields
    setBggId('');
    setPreviewData(null);

    // Reset manual entry fields
    setManualName('');
    setManualYear('');
    setManualMinPlayers('');
    setManualMaxPlayers('');
    setManualPlaytime('');
    setManualMinPlaytime('');
    setManualMaxPlaytime('');
    setManualMinAge('');
    setManualDescription('');
    setManualComplexity('');
    setManualBestPlayerCount('');
    setManualCategories('');
    setManualMechanisms('');

    // Reset shared fields
    setCostPrice('');
    setGameSize('');
    setDeposit('');
    setDateOfAcquisition(new Date().toISOString().split('T')[0]);
    setIsExpansion(false);
    setBaseGameId('');
    setError(null);
    setSuccess(false);
    setSelectedBoxImage(null);
    setSelectedGameplayImage(null);
    setCustomImageUrls(['']);
    setUseCustomImages(false);
    setSelectedFiles([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Board Game</DialogTitle>
          <DialogDescription>
            Import from BoardGameGeek or enter manually
          </DialogDescription>
        </DialogHeader>

        <Tabs value={entryMode} onValueChange={(value) => setEntryMode(value as 'bgg' | 'manual')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="bgg">Import from BGG</TabsTrigger>
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          </TabsList>

          <TabsContent value="bgg">
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

                  {/* File Upload Section */}
                  <div className="mt-4 pt-4 border-t">
                    <Label className="text-sm font-semibold mb-2 block">Upload Images from Device</Label>
                    <p className="text-xs text-muted-foreground mb-3">
                      Upload photos from your device or take a photo (mobile)
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading || success}
                      className="gap-2 w-full"
                    >
                      <Upload className="w-4 h-4" />
                      {selectedFiles.length > 0
                        ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected`
                        : 'Choose Files or Take Photo'}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      capture="environment"
                      onChange={handleFileUpload}
                      className="hidden"
                    />

                    {/* Preview selected files */}
                    {selectedFiles.length > 0 && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="relative group">
                            <div className="aspect-square rounded-lg overflow-hidden border border-primary bg-muted">
                              <img
                                src={URL.createObjectURL(file)}
                                alt={`Upload ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(index)}
                              className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-all shadow-lg"
                              disabled={loading || success}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
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
          </TabsContent>

          <TabsContent value="manual">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Manual Entry Form - All fields mandatory except categories/mechanisms/expansion */}

              {/* Game Name */}
              <div className="space-y-2">
                <Label htmlFor="manualName">Game Name *</Label>
                <Input
                  id="manualName"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g., Catan"
                  required
                  disabled={loading || success}
                />
              </div>

              {/* Year Published */}
              <div className="space-y-2">
                <Label htmlFor="manualYear">Year Published *</Label>
                <Input
                  id="manualYear"
                  type="number"
                  min="1900"
                  max="2100"
                  value={manualYear}
                  onChange={(e) => setManualYear(e.target.value)}
                  placeholder="e.g., 1995"
                  required
                  disabled={loading || success}
                />
              </div>

              {/* Players (Min and Max) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manualMinPlayers">Min Players *</Label>
                  <Input
                    id="manualMinPlayers"
                    type="number"
                    min="1"
                    max="100"
                    value={manualMinPlayers}
                    onChange={(e) => setManualMinPlayers(e.target.value)}
                    placeholder="e.g., 2"
                    required
                    disabled={loading || success}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manualMaxPlayers">Max Players *</Label>
                  <Input
                    id="manualMaxPlayers"
                    type="number"
                    min="1"
                    max="100"
                    value={manualMaxPlayers}
                    onChange={(e) => setManualMaxPlayers(e.target.value)}
                    placeholder="e.g., 4"
                    required
                    disabled={loading || success}
                  />
                </div>
              </div>

              {/* Playtime fields */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manualPlaytime">Playtime (min) *</Label>
                  <Input
                    id="manualPlaytime"
                    type="number"
                    min="1"
                    value={manualPlaytime}
                    onChange={(e) => setManualPlaytime(e.target.value)}
                    placeholder="60"
                    required
                    disabled={loading || success}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manualMinPlaytime">Min Playtime *</Label>
                  <Input
                    id="manualMinPlaytime"
                    type="number"
                    min="1"
                    value={manualMinPlaytime}
                    onChange={(e) => setManualMinPlaytime(e.target.value)}
                    placeholder="45"
                    required
                    disabled={loading || success}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manualMaxPlaytime">Max Playtime *</Label>
                  <Input
                    id="manualMaxPlaytime"
                    type="number"
                    min="1"
                    value={manualMaxPlaytime}
                    onChange={(e) => setManualMaxPlaytime(e.target.value)}
                    placeholder="90"
                    required
                    disabled={loading || success}
                  />
                </div>
              </div>

              {/* Min Age and Best Player Count */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manualMinAge">Minimum Age *</Label>
                  <Input
                    id="manualMinAge"
                    type="number"
                    min="0"
                    max="99"
                    value={manualMinAge}
                    onChange={(e) => setManualMinAge(e.target.value)}
                    placeholder="e.g., 10"
                    required
                    disabled={loading || success}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manualBestPlayerCount">Best Player Count *</Label>
                  <Input
                    id="manualBestPlayerCount"
                    type="number"
                    min="1"
                    max="100"
                    value={manualBestPlayerCount}
                    onChange={(e) => setManualBestPlayerCount(e.target.value)}
                    placeholder="e.g., 3"
                    required
                    disabled={loading || success}
                  />
                </div>
              </div>

              {/* Complexity */}
              <div className="space-y-2">
                <Label htmlFor="manualComplexity">Complexity (1-5) *</Label>
                <Select value={manualComplexity} onValueChange={setManualComplexity} required disabled={loading || success}>
                  <SelectTrigger id="manualComplexity">
                    <SelectValue placeholder="Select complexity..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Very Light</SelectItem>
                    <SelectItem value="2">2 - Light</SelectItem>
                    <SelectItem value="3">3 - Medium</SelectItem>
                    <SelectItem value="4">4 - Medium Heavy</SelectItem>
                    <SelectItem value="5">5 - Heavy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="manualDescription">Description *</Label>
                <Textarea
                  id="manualDescription"
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  placeholder="Enter a detailed description of the game..."
                  rows={4}
                  required
                  disabled={loading || success}
                />
              </div>

              {/* Categories (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="manualCategories">Categories (optional, comma-separated)</Label>
                <Input
                  id="manualCategories"
                  value={manualCategories}
                  onChange={(e) => setManualCategories(e.target.value)}
                  placeholder="e.g., Strategy, Family, Card Game"
                  disabled={loading || success}
                />
              </div>

              {/* Mechanisms (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="manualMechanisms">Mechanisms (optional, comma-separated)</Label>
                <Input
                  id="manualMechanisms"
                  value={manualMechanisms}
                  onChange={(e) => setManualMechanisms(e.target.value)}
                  placeholder="e.g., Worker Placement, Deck Building"
                  disabled={loading || success}
                />
              </div>

              {/* Cost Price */}
              <div className="space-y-2">
                <Label htmlFor="costPrice">Cost Price *</Label>
                <Input
                  id="costPrice"
                  type="number"
                  step="0.01"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="0.00"
                  required
                  disabled={loading || success}
                />
              </div>

              {/* Game Size */}
              <div className="space-y-2">
                <Label htmlFor="gameSize">Game Size (Rental) *</Label>
                <Select value={gameSize} onValueChange={setGameSize} required disabled={loading || success}>
                  <SelectTrigger id="gameSize">
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
                <Label htmlFor="deposit">Deposit *</Label>
                <Input
                  id="deposit"
                  type="number"
                  step="0.01"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  placeholder="0.00"
                  required
                  disabled={loading || success}
                />
              </div>

              {/* Date of Acquisition */}
              <div className="space-y-2">
                <Label htmlFor="dateOfAcquisition">Date of Acquisition *</Label>
                <Input
                  id="dateOfAcquisition"
                  type="date"
                  value={dateOfAcquisition}
                  onChange={(e) => setDateOfAcquisition(e.target.value)}
                  disabled={loading || success}
                  required
                />
              </div>

              {/* Is Expansion (Optional) */}
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

              {/* Base Game Selection (if expansion, Optional) */}
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
                </div>
              )}

              {/* Images Section - MINIMUM 2 REQUIRED */}
              <div className="border-t pt-4 mt-4">
                <Label className="text-sm font-semibold mb-3 block">Images (Minimum 2 required) *</Label>

                {/* Image URLs */}
                <div className="space-y-2 mb-4">
                  <Label className="text-sm">Image URLs</Label>
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
                          <X className="h-4 w-4" />
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

                {/* File Upload */}
                <div className="space-y-2">
                  <Label className="text-sm">Or Upload Files</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading || success}
                    className="gap-2 w-full"
                  >
                    <Upload className="w-4 h-4" />
                    {selectedFiles.length > 0
                      ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected`
                      : 'Choose Files or Take Photo'}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  {/* Preview selected files */}
                  {selectedFiles.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="relative group">
                          <div className="aspect-square rounded-lg overflow-hidden border border-primary bg-muted">
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`Upload ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(index)}
                            className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-all shadow-lg"
                            disabled={loading || success}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Image count validation message */}
                <p className="text-xs text-muted-foreground mt-2">
                  Total images: {(customImageUrls.filter(u => u.trim()).length + selectedFiles.length)}
                  {(customImageUrls.filter(u => u.trim()).length + selectedFiles.length) < 2 && (
                    <span className="text-destructive ml-1">(Need at least 2)</span>
                  )}
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
                  disabled={loading || success || (customImageUrls.filter(u => u.trim()).length + selectedFiles.length) < 2}
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

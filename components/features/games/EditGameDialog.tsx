'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BoardGame } from '@/types';
import { Loader2, Upload, Trash2, X } from 'lucide-react';

interface EditGameDialogProps {
  game: BoardGame | null;
  open: boolean;
  onClose: () => void;
  onSave?: () => void;
  staffMode?: boolean; // If true, only show photo upload (no editing or deleting)
}

export function EditGameDialog({ game, open, onClose, onSave, staffMode = false }: EditGameDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableGames, setAvailableGames] = useState<{ id: string; name: string }[]>([]);

  // Helper function to format date for input[type="date"]
  const formatDateForInput = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    try {
      // Extract just the date part (YYYY-MM-DD) from ISO timestamp
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const [formData, setFormData] = useState({
    gameName: game?.fields['Game Name'] || '',
    description: game?.fields['Description'] || '',
    yearReleased: game?.fields['Year Released'] || '',
    minPlayers: game?.fields['Min Players'] || '',
    maxPlayers: game?.fields['Max. Players'] || '',
    bestPlayerAmount: game?.fields['Best Player Amount'] || '',
    complexity: game?.fields['Complexity'] || 0,
    dateAcquired: formatDateForInput(game?.fields['Date of Aquisition']),
    categories: game?.fields.Categories || [],
    baseGameId: game?.fields['Base Game ID'] || '',
    deposit: game?.fields['Deposit'] ? Math.round(game.fields['Deposit']).toString() : '',
    costPrice: game?.fields['Cost Price'] ? Math.round(game.fields['Cost Price']).toString() : '',
    gameSize: game?.fields['Game Size']?.toString() || '',
  });

  // Image staging state - track pending uploads and deletions
  const [pendingUploads, setPendingUploads] = useState<File[]>([]);
  const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(new Set());

  // Get current images from the game
  const currentImages = game?.images || [];

  // Reset form data when game changes
  useEffect(() => {
    if (game) {
      setFormData({
        gameName: game.fields['Game Name'] || '',
        description: game.fields['Description'] || '',
        yearReleased: game.fields['Year Released'] || '',
        minPlayers: game.fields['Min Players'] || '',
        maxPlayers: game.fields['Max. Players'] || '',
        bestPlayerAmount: game.fields['Best Player Amount'] || '',
        complexity: game.fields['Complexity'] || 0,
        dateAcquired: formatDateForInput(game.fields['Date of Aquisition']),
        categories: game.fields.Categories || [],
        baseGameId: game.fields['Base Game ID'] || '',
        deposit: game.fields['Deposit'] ? Math.round(game.fields['Deposit']).toString() : '',
        costPrice: game.fields['Cost Price'] ? Math.round(game.fields['Cost Price']).toString() : '',
        gameSize: game.fields['Game Size']?.toString() || '',
      });
    }
  }, [game]);

  // Reset pending changes when dialog opens/closes
  useEffect(() => {
    if (open) {
      setPendingUploads([]);
      setPendingDeletions(new Set());
      setError(null);

      // Fetch all games to get unique categories and for base game dropdown
      fetch('/api/games')
        .then(res => res.json())
        .then(data => {
          const games = data.games || [];
          const categoriesSet = new Set<string>();
          const gamesList: { id: string; name: string }[] = [];

          games.forEach((g: BoardGame) => {
            if (g.fields.Categories) {
              g.fields.Categories.forEach((cat: string) => categoriesSet.add(cat));
            }
            // Add to games list (exclude current game to avoid circular reference)
            if (g.id !== game?.id) {
              gamesList.push({ id: g.id, name: g.fields['Game Name'] });
            }
          });

          setAvailableCategories(Array.from(categoriesSet).sort());
          setAvailableGames(gamesList.sort((a, b) => a.name.localeCompare(b.name)));
        })
        .catch(err => console.error('Failed to fetch categories and games:', err));
    }
  }, [open]);

  if (!game) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCategoryToggle = (category: string) => {
    setFormData(prev => {
      const currentCategories = Array.isArray(prev.categories) ? prev.categories : [];
      const isSelected = currentCategories.includes(category);

      return {
        ...prev,
        categories: isSelected
          ? currentCategories.filter(c => c !== category)
          : [...currentCategories, category],
      };
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Stage files for upload (don't upload immediately)
    const newFiles = Array.from(files);
    setPendingUploads(prev => [...prev, ...newFiles]);

    // Clear input so same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteImage = (imageHash: string) => {
    // Stage image for deletion (don't delete immediately)
    setPendingDeletions(prev => new Set(prev).add(imageHash));
  };

  const handleRemovePendingUpload = (index: number) => {
    // Remove a staged upload before it's been saved
    setPendingUploads(prev => prev.filter((_, i) => i !== index));
  };

  const handleUndoDelete = (imageHash: string) => {
    // Undo a pending deletion
    setPendingDeletions(prev => {
      const newSet = new Set(prev);
      newSet.delete(imageHash);
      return newSet;
    });
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Step 1: Process pending image deletions
      if (pendingDeletions.size > 0) {
        for (const imageHash of pendingDeletions) {
          const response = await fetch(`/api/games/${game.id}/images/${imageHash}`, {
            method: 'DELETE',
          });
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || `Failed to delete image ${imageHash}`);
          }
        }
      }

      // Step 2: Process pending image uploads
      if (pendingUploads.length > 0) {
        const imageFormData = new FormData();
        imageFormData.append('gameId', game.id);
        pendingUploads.forEach((file) => {
          imageFormData.append('images', file);
        });

        const uploadResponse = await fetch(`/api/games/${game.id}/images`, {
          method: 'POST',
          body: imageFormData,
        });

        if (!uploadResponse.ok) {
          const data = await uploadResponse.json();
          throw new Error(data.error || 'Failed to upload images');
        }
      }

      // Step 3: Save game metadata (only in admin mode)
      if (!staffMode) {
        const response = await fetch(`/api/games/${game.id}/edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameName: formData.gameName,
            description: formData.description,
            yearReleased: formData.yearReleased ? parseInt(formData.yearReleased as string) : null,
            minPlayers: formData.minPlayers,
            maxPlayers: formData.maxPlayers,
            bestPlayerAmount: formData.bestPlayerAmount,
            complexity: formData.complexity ? parseInt(String(formData.complexity)) : 0,
            dateAcquired: formData.dateAcquired,
            categories: formData.categories,
            baseGameId: formData.baseGameId || null,
            deposit: formData.deposit ? parseInt(formData.deposit) : null,
            costPrice: formData.costPrice ? parseInt(formData.costPrice) : null,
            gameSize: formData.gameSize || null,
            staffId: localStorage.getItem('staff_record_id') || 'system',
            staffName: localStorage.getItem('staff_name') || 'System',
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update game');
        }

        // Step 4: Verify changes were saved by fetching from database
        const verifyResponse = await fetch(`/api/games/${game.id}`);
        if (!verifyResponse.ok) {
          throw new Error('Failed to verify game update');
        }

        const verifiedData = await verifyResponse.json();
        const verifiedGame = verifiedData.game;

        // Debug logging
        console.log('Verification - Form Data:', {
          deposit: formData.deposit,
          costPrice: formData.costPrice,
          gameSize: formData.gameSize,
          bestPlayerAmount: formData.bestPlayerAmount,
        });
        console.log('Verification - Database Data:', {
          deposit: verifiedGame?.fields?.['Deposit'],
          costPrice: verifiedGame?.fields?.['Cost Price'],
          gameSize: verifiedGame?.fields?.['Game Size'],
          bestPlayerAmount: verifiedGame?.fields?.['Best Player Amount'],
        });

        // Check that at least some of the updated fields exist in the database
        // Handle type conversions carefully (string vs number comparisons)
        const depositMatches = !formData.deposit ||
          parseInt(formData.deposit) === verifiedGame?.fields?.['Deposit'];
        const costPriceMatches = !formData.costPrice ||
          parseInt(formData.costPrice) === verifiedGame?.fields?.['Cost Price'];
        const gameSizeMatches = !formData.gameSize ||
          formData.gameSize === verifiedGame?.fields?.['Game Size'];
        const bestPlayerMatches = !formData.bestPlayerAmount ||
          String(formData.bestPlayerAmount) === String(verifiedGame?.fields?.['Best Player Amount']);

        console.log('Verification - Matches:', {
          depositMatches,
          costPriceMatches,
          gameSizeMatches,
          bestPlayerMatches,
        });

        const changesVerified = depositMatches && costPriceMatches && gameSizeMatches && bestPlayerMatches;

        if (!changesVerified) {
          throw new Error('Game update could not be verified in database. Check console for details.');
        }

        // Show success notification
        alert('✅ Game data updated successfully!');
      }

      // Clear pending changes
      setPendingUploads([]);
      setPendingDeletions(new Set());

      onSave?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    const gameName = game.fields['Game Name'];

    const confirmed = confirm(
      `⚠️ WARNING: This will permanently delete "${gameName}" and all associated data.\n\n` +
      `Are you sure you want to continue?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/games/${game.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete game');
      }

      // Refresh parent and close
      onSave?.();
      onClose();

      alert(`Successfully deleted "${gameName}"`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete game');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {staffMode ? `Add Photos: ${game.fields['Game Name']}` : `Edit Game: ${game.fields['Game Name']}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Edit Fields - Admin Only */}
          {!staffMode && (
          <>
          {/* Game Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Game Name</label>
            <input
              type="text"
              name="gameName"
              value={formData.gameName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              disabled={isLoading}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              disabled={isLoading}
            />
          </div>

          {/* Categories */}
          <div>
            <label className="block text-sm font-medium mb-2">Categories</label>
            <div className="border border-border rounded-lg p-3 bg-background max-h-48 overflow-y-auto">
              {availableCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">Loading categories...</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {availableCategories.map((category) => {
                    const currentCategories = Array.isArray(formData.categories) ? formData.categories : [];
                    const isSelected = currentCategories.includes(category);

                    return (
                      <label
                        key={category}
                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleCategoryToggle(category)}
                          disabled={isLoading}
                          className="w-4 h-4 rounded cursor-pointer"
                        />
                        <span className="text-sm">{category}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {Array.isArray(formData.categories) && formData.categories.length > 0
                ? `${formData.categories.length} ${formData.categories.length === 1 ? 'category' : 'categories'} selected`
                : 'No categories selected'}
            </p>
          </div>

          {/* Date Acquired */}
          <div>
            <label className="block text-sm font-medium mb-2">Date Acquired</label>
            <input
              type="date"
              name="dateAcquired"
              value={formData.dateAcquired}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              disabled={isLoading}
            />
          </div>

          {/* Grid Layout for numeric fields */}
          <div className="grid grid-cols-2 gap-4">
            {/* Year Released */}
            <div>
              <label className="block text-sm font-medium mb-2">Year Released</label>
              <input
                type="number"
                name="yearReleased"
                value={formData.yearReleased}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={isLoading}
              />
            </div>

            {/* Complexity */}
            <div>
              <label className="block text-sm font-medium mb-2">Complexity (1-5)</label>
              <select
                name="complexity"
                value={formData.complexity}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={isLoading}
              >
                <option value="0">0 - Not Set</option>
                <option value="1">1 - Very Simple</option>
                <option value="2">2 - Simple</option>
                <option value="3">3 - Medium</option>
                <option value="4">4 - Complex</option>
                <option value="5">5 - Very Complex</option>
              </select>
            </div>
          </div>

          {/* Player counts */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Min Players</label>
              <input
                type="text"
                name="minPlayers"
                value={formData.minPlayers}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Max Players</label>
              <input
                type="text"
                name="maxPlayers"
                value={formData.maxPlayers}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Best Player Count</label>
              <input
                type="text"
                name="bestPlayerAmount"
                value={formData.bestPlayerAmount}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Base Game (for expansions) */}
          <div>
            <label className="block text-sm font-medium mb-2">Base Game (if expansion)</label>
            <select
              name="baseGameId"
              value={formData.baseGameId}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              disabled={isLoading}
            >
              <option value="">Not an expansion</option>
              {availableGames.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* Financial & Size Fields */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Deposit (VND)</label>
              <input
                type="number"
                name="deposit"
                value={formData.deposit}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={isLoading}
                placeholder="1000000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Cost Price (VND)</label>
              <input
                type="number"
                name="costPrice"
                value={formData.costPrice}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={isLoading}
                placeholder="1000000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Game Size</label>
              <select
                name="gameSize"
                value={formData.gameSize}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={isLoading}
              >
                <option value="">Select size</option>
                <option value="1">1 - Very Small</option>
                <option value="2">2 - Small</option>
                <option value="3">3 - Medium</option>
                <option value="4">4 - Large</option>
                <option value="5">5 - Very Large</option>
              </select>
            </div>
          </div>
          </>
          )}

          {/* Image Management */}
          <div className={staffMode ? "" : "border-t pt-4 mt-6"}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Game Images</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage || isLoading}
                className="gap-2"
              >
                {uploadingImage ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload Images
                  </>
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            {/* Current and Pending Images */}
            {currentImages.length > 0 || pendingUploads.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {/* Existing Images */}
                {currentImages.map((image, index) => {
                  const isMarkedForDeletion = pendingDeletions.has(image.hash);
                  return (
                    <div key={image.hash} className="relative group">
                      <div className={`aspect-square rounded-lg overflow-hidden border ${
                        isMarkedForDeletion ? 'border-destructive opacity-50' : 'border-border'
                      } bg-muted`}>
                        <img
                          src={`/api/images/${image.hash}`}
                          alt={`Game image ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {isMarkedForDeletion && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                            <span className="text-white font-medium">Will be deleted</span>
                          </div>
                        )}
                      </div>
                      {!staffMode && (
                        <button
                          type="button"
                          onClick={() => isMarkedForDeletion ? handleUndoDelete(image.hash) : handleDeleteImage(image.hash)}
                          className={`absolute top-2 right-2 p-1.5 rounded-md transition-all shadow-lg z-10 ${
                            isMarkedForDeletion
                              ? 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
                              : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                          }`}
                          disabled={isLoading}
                          title={isMarkedForDeletion ? "Undo delete" : "Delete image"}
                        >
                          {isMarkedForDeletion ? <X className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      )}
                      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
                        #{index + 1}
                      </div>
                    </div>
                  );
                })}

                {/* Pending Uploads */}
                {pendingUploads.map((file, index) => (
                  <div key={`pending-${index}`} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden border border-primary bg-muted">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`New upload ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                        <span className="text-primary-foreground font-medium bg-primary px-2 py-1 rounded text-xs">
                          New
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePendingUpload(index)}
                      className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-all shadow-lg z-10"
                      disabled={isLoading}
                      title="Remove upload"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
                      New #{index + 1}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No images yet. Click "Upload Images" to add photos.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className={staffMode ? "" : "flex justify-between items-center"}>
          {!staffMode && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading || uploadingImage}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Game
            </Button>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading || uploadingImage}
            >
              {staffMode ? 'Close' : 'Cancel'}
            </Button>
            {/* Show Save Changes for admin always, or for staff when there are pending image changes */}
            {(!staffMode || pendingUploads.length > 0 || pendingDeletions.size > 0) && (
              <Button
                onClick={handleSave}
                disabled={isLoading}
                className="gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

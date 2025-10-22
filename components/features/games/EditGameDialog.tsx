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

  const [formData, setFormData] = useState({
    gameName: game?.fields['Game Name'] || '',
    description: game?.fields['Description'] || '',
    yearReleased: game?.fields['Year Released'] || '',
    minPlayers: game?.fields['Min Players'] || '',
    maxPlayers: game?.fields['Max. Players'] || '',
    complexity: game?.fields['Complexity'] || 0,
    dateAcquired: game?.fields['Date of Aquisition'] || '',
    categories: game?.fields.Categories?.join(', ') || '',
  });

  // Image staging state - track pending uploads and deletions
  const [pendingUploads, setPendingUploads] = useState<File[]>([]);
  const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(new Set());

  // Get current images from the game
  const currentImages = game?.images || [];

  // Reset pending changes when dialog opens/closes
  useEffect(() => {
    if (open) {
      setPendingUploads([]);
      setPendingDeletions(new Set());
      setError(null);
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
            complexity: formData.complexity ? parseInt(String(formData.complexity)) : 0,
            dateAcquired: formData.dateAcquired,
            categories: formData.categories.split(',').map(c => c.trim()).filter(c => c.length > 0),
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update game');
        }
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
            <input
              type="text"
              name="categories"
              value={formData.categories}
              onChange={handleInputChange}
              placeholder="e.g., Strategy, Family, Card Game (comma-separated)"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Separate multiple categories with commas
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
          <div className="grid grid-cols-2 gap-4">
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

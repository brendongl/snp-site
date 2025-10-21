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
}

export function EditGameDialog({ game, open, onClose, onSave }: EditGameDialogProps) {
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

  // Get current images from the game
  const currentImages = game?.images || [];

  if (!game) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('gameId', game.id);

      // Add all selected files
      Array.from(files).forEach((file) => {
        formData.append('images', file);
      });

      const response = await fetch(`/api/games/${game.id}/images`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload images');
      }

      // Refresh the game data and close dialog
      onSave?.();
      onClose(); // Close dialog to show refreshed data when reopened
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload images');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteImage = async (imageHash: string) => {
    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }

    setError(null);

    try {
      const response = await fetch(`/api/games/${game.id}/images/${imageHash}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete image');
      }

      // Refresh the game data and close dialog
      onSave?.();
      onClose(); // Close dialog to show refreshed data when reopened
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image');
    }
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      setError(null);

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

      onSave?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save game');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    const gameName = game.fields['Game Name'];
    const confirmText = `DELETE ${gameName}`;

    const userInput = prompt(
      `⚠️ WARNING: This will permanently delete "${gameName}" and all associated data.\n\n` +
      `Type exactly: ${confirmText}\n\nto confirm deletion:`
    );

    if (userInput !== confirmText) {
      if (userInput !== null) {
        alert('Deletion cancelled - text did not match');
      }
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
          <DialogTitle>Edit Game: {game.fields['Game Name']}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}

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

          {/* Image Management */}
          <div className="border-t pt-4 mt-6">
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

            {/* Current Images */}
            {currentImages.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {currentImages.map((image, index) => (
                  <div key={image.hash} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                      <img
                        src={`/api/images/${image.hash}`}
                        alt={`Game image ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(image.hash)}
                      className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      disabled={isLoading || uploadingImage}
                      title="Delete image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
                      #{index + 1}
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

        <DialogFooter className="flex justify-between items-center">
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading || uploadingImage}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete Game
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
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
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

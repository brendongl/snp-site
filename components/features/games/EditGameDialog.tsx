'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BoardGame } from '@/types';
import { Loader2 } from 'lucide-react';

interface EditGameDialogProps {
  game: BoardGame | null;
  open: boolean;
  onClose: () => void;
  onSave?: () => void;
}

export function EditGameDialog({ game, open, onClose, onSave }: EditGameDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    gameName: game?.fields['Game Name'] || '',
    description: game?.fields['Description'] || '',
    yearReleased: game?.fields['Year Released'] || '',
    minPlayers: game?.fields['Min Players'] || '',
    maxPlayers: game?.fields['Max. Players'] || '',
    complexity: game?.fields['Complexity'] || 0,
  });

  if (!game) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
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
          yearReleased: parseInt(formData.yearReleased) || null,
          minPlayers: formData.minPlayers,
          maxPlayers: formData.maxPlayers,
          complexity: parseInt(formData.complexity.toString()) || 0,
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

          <div className="text-xs text-muted-foreground">
            Note: Image editing coming soon. Edit images directly in Airtable for now.
          </div>
        </div>

        <DialogFooter className="flex gap-2">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

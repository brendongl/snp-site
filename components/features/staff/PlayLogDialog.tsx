'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, AlertCircle, Loader2, Star } from 'lucide-react';

interface PlayLogDialogProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  gameName: string;
  onSuccess?: (gameName: string) => void;
}

export function PlayLogDialog({
  isOpen,
  onClose,
  gameId,
  gameName,
  onSuccess,
}: PlayLogDialogProps) {
  const router = useRouter();
  const [sessionDate, setSessionDate] = useState<string>(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playLogPoints, setPlayLogPoints] = useState<number>(100); // Default fallback

  // Fetch dynamic point values on mount
  useEffect(() => {
    const fetchPointValues = async () => {
      try {
        const response = await fetch('/api/points-display');
        const data = await response.json();
        if (data.success && data.points?.play_log) {
          setPlayLogPoints(data.points.play_log);
        }
      } catch (error) {
        console.error('Failed to fetch point values:', error);
        // Keep fallback value
      }
    };

    fetchPointValues();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!sessionDate) {
      setError('Please select a date and time');
      return;
    }

    try {
      setIsLoading(true);

      // Get staff info from localStorage
      const staffId = localStorage.getItem('staff_id'); // UUID primary key
      const staffName = localStorage.getItem('staff_name');

      // Validate UUID format
      const isValidUUID = staffId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(staffId);

      if (!staffName) {
        setError('Staff information not found. Please log in again.');
        return;
      }

      if (!staffId || !isValidUUID) {
        setError('Invalid staff session. Please log in again using the Staff Login button.');
        console.error('❌ Invalid or missing staff UUID:', staffId);
        return;
      }

      // Create play log entry
      const response = await fetch('/api/play-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          staffListId: staffId, // UUID primary key
          sessionDate: new Date(sessionDate).toISOString(),
          notes: notes.trim() || '',
        }),
      });

      let data;
      const responseText = await response.text();
      try {
        data = JSON.parse(responseText);
      } catch (jsonError) {
        console.error('Response text:', responseText);
        setError(`Server error: ${responseText.substring(0, 100)}`);
        return;
      }

      if (!response.ok) {
        setError(data.error || 'Failed to log game');
        return;
      }

      setNotes('');

      // Close dialog and trigger onSuccess callback with game name
      onClose();
      onSuccess?.(gameName);

      // Navigate back to games page
      router.push('/games');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log game');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-md"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Log Play Session
          </DialogTitle>
          <DialogDescription>
            Logging: <span className="font-medium text-foreground">{gameName}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Session Date/Time */}
          <div>
            <label htmlFor="session-date" className="block text-sm font-medium mb-2">
              Session Date & Time
            </label>
            <Input
              id="session-date"
              type="datetime-local"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              disabled={isLoading}
              className="w-full"
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium mb-2">
              Notes <span className="text-muted-foreground">(Optional)</span>
            </label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. packed away in a rush, needs check, maybe missing pieces"
              disabled={isLoading}
              className="w-full"
              rows={3}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="min-w-24"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging...
                </>
              ) : (
                <span className="flex items-center gap-1.5">
                  📊 Log Game
                  <span className="flex items-center gap-0.5 text-yellow-300">
                    <Star className="h-3.5 w-3.5 fill-yellow-400" />
                    <span className="text-xs font-semibold">+{playLogPoints}</span>
                  </span>
                </span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

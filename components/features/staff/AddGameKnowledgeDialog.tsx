'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Loader2 } from 'lucide-react';

interface AddGameKnowledgeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  gameName: string;
  onSuccess?: () => void; // Callback to refresh parent data after successful knowledge addition
}

interface StaffMember {
  id: string;
  name: string;
}

const CONFIDENCE_LEVELS = ['Beginner', 'Intermediate', 'Expert', 'Instructor'];
const REQUIRES_CONFIRMATION = ['Expert', 'Instructor'];

export function AddGameKnowledgeDialog({
  isOpen,
  onClose,
  gameId,
  gameName,
  onSuccess,
}: AddGameKnowledgeDialogProps) {
  const [confidenceLevel, setConfidenceLevel] = useState<string>('');
  const [taughtBy, setTaughtBy] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingConfidenceLevel, setPendingConfidenceLevel] = useState<string | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // Fetch staff members from Airtable Staff table when dialog opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchStaff = async () => {
      try {
        setLoadingStaff(true);
        console.log('Fetching staff from /api/staff-list');
        const response = await fetch('/api/staff-list');

        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Staff data received:', data);

        // Extract staff members with their record IDs
        const staff = (data.staff || []).map((member: any) => ({
          id: member.id,
          name: member.name,
        })) as StaffMember[];

        console.log('Processed staff:', staff);
        setStaffMembers(staff.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        console.error('Failed to load staff members:', err);
        setStaffMembers([]);
      } finally {
        setLoadingStaff(false);
      }
    };

    fetchStaff();
  }, [isOpen]);

  const handleConfidenceLevelChange = (level: string) => {
    if (REQUIRES_CONFIRMATION.includes(level)) {
      setPendingConfidenceLevel(level);
      setShowConfirmation(true);
    } else {
      setConfidenceLevel(level);
    }
  };

  const handleConfirmHighLevel = () => {
    if (pendingConfidenceLevel) {
      setConfidenceLevel(pendingConfidenceLevel);
      setPendingConfidenceLevel(null);
      setShowConfirmation(false);
    }
  };

  const handleCancelConfirmation = () => {
    setPendingConfidenceLevel(null);
    setShowConfirmation(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!confidenceLevel) {
      setError('Please select a confidence level');
      return;
    }

    try {
      setIsLoading(true);

      // Get staff info from localStorage
      const staffName = localStorage.getItem('staff_name');
      const staffRecordId = localStorage.getItem('staff_record_id');

      if (!staffName || !staffRecordId) {
        setError('Staff information not found. Please log in again.');
        return;
      }

      // Create knowledge entry
      const response = await fetch('/api/staff-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          gameName,
          staffName,
          staffRecordId,
          confidenceLevel,
          taughtBy: taughtBy || null,
          notes: notes.trim() || null,
        }),
      });

      // Read the response body as text first (to avoid "body already consumed" error)
      const responseText = await response.text();

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (jsonError) {
        console.error('Failed to parse response as JSON:', responseText);
        setError(`Server error: ${responseText.substring(0, 100)}`);
        return;
      }

      if (!response.ok) {
        setError(data.error || 'Failed to add game knowledge');
        return;
      }

      // Reset form and close
      setConfidenceLevel('');
      setTaughtBy('');
      setNotes('');
      onClose();

      // Trigger parent refresh to update UI (e.g., game card badges)
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add game knowledge');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen && !showConfirmation} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Game Knowledge</DialogTitle>
            <DialogDescription>
              Recording your knowledge for <span className="font-medium text-foreground">{gameName}</span>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Confidence Level */}
            <div>
              <label className="block text-sm font-medium mb-2">Confidence Level</label>
              <div className="space-y-2">
                {CONFIDENCE_LEVELS.map((level) => (
                  <label
                    key={level}
                    className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <input
                      type="radio"
                      name="confidence"
                      value={level}
                      checked={confidenceLevel === level}
                      onChange={() => handleConfidenceLevelChange(level)}
                      disabled={isLoading}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                    <span className="text-sm font-medium">{level}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Was Taught By - Dropdown */}
            <div>
              <label htmlFor="taught-by" className="block text-sm font-medium mb-2">
                Was Taught By <span className="text-muted-foreground">(Optional)</span>
              </label>
              <select
                id="taught-by"
                value={taughtBy}
                onChange={(e) => setTaughtBy(e.target.value)}
                disabled={isLoading || loadingStaff}
                className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background text-foreground cursor-pointer hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select staff member...</option>
                {staffMembers.map((staff) => (
                  <option key={staff.id} value={staff.name}>
                    {staff.name}
                  </option>
                ))}
              </select>
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
                placeholder="e.g. good at strategy, need practice with rules, etc."
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
                    Saving...
                  </>
                ) : (
                  'Save Knowledge'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Expert/Instructor levels */}
      {showConfirmation && isOpen && (
        <Dialog open={showConfirmation} onOpenChange={(open) => {
          // Only allow closing via the Cancel button, not by clicking outside
          if (!open) handleCancelConfirmation();
        }}>
          <DialogContent
            className="sm:max-w-md"
            onPointerDownOutside={(e) => {
              // Prevent closing when clicking outside
              e.preventDefault();
            }}
            onEscapeKeyDown={(e) => {
              // Treat escape key as cancel
              e.preventDefault();
              handleCancelConfirmation();
            }}
          >
            <DialogHeader>
              <DialogTitle>Confirm {pendingConfidenceLevel} Level?</DialogTitle>
              <DialogDescription>
                If you pick this confidence level, you must be able to teach this game!
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelConfirmation}
              >
                Cancel
              </Button>
              <Button onClick={handleConfirmHighLevel}>Confirm</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

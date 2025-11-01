'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, AlertCircle } from 'lucide-react';
import { BoardGame } from '@/types';
import { useToast } from '@/lib/context/toast-context';

interface ContentCheckDialogProps {
  open: boolean;
  onClose: () => void;
  game: BoardGame;
  onSuccess: () => void;
}

interface Inspector {
  id: string;
  name: string;
}

export function ContentCheckDialog({ open, onClose, game, onSuccess }: ContentCheckDialogProps) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [loadingInspectors, setLoadingInspectors] = useState(true);
  const [errorDialog, setErrorDialog] = useState<{ show: boolean; message: string; details?: any }>({
    show: false,
    message: '',
  });

  // Form state
  const [inspector, setInspector] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [boxCondition, setBoxCondition] = useState<string>('');
  const [cardCondition, setCardCondition] = useState<string>('');
  const [missingPieces, setMissingPieces] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [sleevedAtCheck, setSleevedAtCheck] = useState(false);
  const [boxWrappedAtCheck, setBoxWrappedAtCheck] = useState(false);

  // Load inspectors and auto-select current staff member when dialog opens
  useEffect(() => {
    if (open && inspectors.length === 0) {
      loadInspectors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-select current staff member from localStorage
  useEffect(() => {
    if (open && inspectors.length > 0 && !inspector) {
      // Get staff_id (UUID) from localStorage
      const staffId = localStorage.getItem('staff_id');
      const staffName = localStorage.getItem('staff_name');

      if (staffId) {
        // Verify the ID exists in the inspectors list
        const matchingInspector = inspectors.find((insp) => insp.id === staffId);

        if (matchingInspector) {
          setInspector(matchingInspector.id);
          console.log('Auto-selected inspector by ID:', matchingInspector.name, `(${staffId})`);
        } else {
          console.warn('staff_id from localStorage not found in inspectors:', staffId);
          console.log('Available inspectors:', inspectors.map(i => `${i.name} (${i.id})`));
        }
      } else {
        console.warn('No staff_id found in localStorage. Staff member not logged in?');
        console.log('localStorage keys:', Object.keys(localStorage));
      }
    }
  }, [open, inspectors, inspector]);

  const loadInspectors = async () => {
    setLoadingInspectors(true);
    try {
      const response = await fetch('/api/games/inspectors');
      if (response.ok) {
        const data = await response.json();
        setInspectors(data.inspectors);
      }
    } catch (error) {
      console.error('Failed to load inspectors:', error);
    } finally {
      setLoadingInspectors(false);
    }
  };

  const handleSubmit = async () => {
    // Validation with detailed error messaging
    const missingFields: string[] = [];
    if (!status) missingFields.push('Status');
    if (!boxCondition) missingFields.push('Box Condition');
    if (!cardCondition) missingFields.push('Card Condition');

    if (missingFields.length > 0) {
      alert(`Please fill in all required fields:\n${missingFields.join(', ')}`);
      return;
    }

    // If inspector is not set (auto-selection failed), show specific error
    if (!inspector) {
      alert('Unable to identify inspector. Please ensure you are logged in as staff.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/games/content-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId: game.id,
          inspector,
          status,
          boxCondition,
          cardCondition,
          missingPieces,
          notes,
          sleevedAtCheck,
          boxWrappedAtCheck,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Show detailed error dialog with debugging info
        setErrorDialog({
          show: true,
          message: `Content Check submission failed (${response.status})`,
          details: data,
        });
        logger.error('Content Check Dialog', 'API returned error', new Error(JSON.stringify(data)));
        return;
      }

      // Verify the record was actually created by checking for ID
      if (!data.contentCheckId || !data.record) {
        throw new Error('Content check creation failed - no record ID returned');
      }

      // Verify record exists in database
      const verifyResponse = await fetch(`/api/content-checks?gameId=${game.id}`);
      if (!verifyResponse.ok) {
        console.warn('Failed to verify content check creation, but record was created');
      } else {
        const verifyData = await verifyResponse.json();
        const recordExists = verifyData.checks?.some((check: any) => check.id === data.contentCheckId);
        if (!recordExists) {
          console.warn('Content check ID not found in verification query');
        }
      }

      // Success - show toast notification
      addToast('Content check created successfully!', 'success');

      onSuccess();
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error creating content check:', error);
      setErrorDialog({
        show: true,
        message: 'Network or unexpected error occurred',
        details: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      addToast('Failed to create content check. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setInspector('');
    setStatus('');
    setBoxCondition('');
    setCardCondition('');
    setMissingPieces('');
    setNotes('');
    setSleevedAtCheck(false);
    setBoxWrappedAtCheck(false);
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  return (
    <>
      {/* Error Dialog */}
      {errorDialog.show && (
        <Dialog open={errorDialog.show} onOpenChange={() => setErrorDialog({ show: false, message: '' })}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                Content Check Error
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="font-semibold text-red-800 dark:text-red-300">{errorDialog.message}</p>
              </div>
              {errorDialog.details && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Debug Information:</h4>
                  <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(errorDialog.details, null, 2)}
                  </pre>
                  <p className="text-sm text-muted-foreground">
                    Please share this information with technical support for debugging.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setErrorDialog({ show: false, message: '' })}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Main Content Check Dialog */}
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Content Check: {game.fields['Game Name']}</DialogTitle>
          </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Inspector - Auto-selected from localStorage, hidden from UI */}
          {inspector && (
            <div className="px-3 py-2 bg-muted rounded-lg text-sm">
              <span className="font-medium">Inspector:</span>{' '}
              {inspectors.find((insp) => insp.id === inspector)?.name || 'Selected'}
            </div>
          )}

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">
              Status <span className="text-red-500">*</span>
            </Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Perfect Condition">Perfect Condition</SelectItem>
                <SelectItem value="Minor Issues">Minor Issues</SelectItem>
                <SelectItem value="Major Issues">Major Issues</SelectItem>
                <SelectItem value="Unplayable">Unplayable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Box Condition */}
          <div className="space-y-2">
            <Label htmlFor="boxCondition">
              Box Condition <span className="text-red-500">*</span>
            </Label>
            <Select value={boxCondition} onValueChange={setBoxCondition}>
              <SelectTrigger id="boxCondition">
                <SelectValue placeholder="Select box condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Excellent">Excellent</SelectItem>
                <SelectItem value="Good">Good</SelectItem>
                <SelectItem value="Fair">Fair</SelectItem>
                <SelectItem value="Poor">Poor</SelectItem>
                <SelectItem value="Damaged">Damaged</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Card Condition */}
          <div className="space-y-2">
            <Label htmlFor="cardCondition">
              Card Condition <span className="text-red-500">*</span>
            </Label>
            <Select value={cardCondition} onValueChange={setCardCondition}>
              <SelectTrigger id="cardCondition">
                <SelectValue placeholder="Select card condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Excellent">Excellent</SelectItem>
                <SelectItem value="Good">Good</SelectItem>
                <SelectItem value="Fair">Fair</SelectItem>
                <SelectItem value="Poor">Poor</SelectItem>
                <SelectItem value="Damaged">Damaged</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Missing Pieces */}
          <div className="space-y-2">
            <Label htmlFor="missingPieces">
              Missing Pieces (optional)
            </Label>
            <Textarea
              id="missingPieces"
              value={missingPieces}
              onChange={(e) => setMissingPieces(e.target.value)}
              placeholder="List any missing pieces, or write 'None' if complete"
              className="min-h-[80px]"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional observations or notes"
              className="min-h-[80px]"
            />
          </div>

          {/* Checkboxes */}
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="sleeved"
                checked={sleevedAtCheck}
                onCheckedChange={(checked) => setSleevedAtCheck(checked as boolean)}
              />
              <Label htmlFor="sleeved" className="cursor-pointer">
                Sleeved at check
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="boxWrapped"
                checked={boxWrappedAtCheck}
                onCheckedChange={(checked) => setBoxWrappedAtCheck(checked as boolean)}
              />
              <Label htmlFor="boxWrapped" className="cursor-pointer">
                Box wrapped at check
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Content Check
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

// Add logger for client-side logging
const logger = {
  error: (context: string, message: string, error: Error) => {
    console.error(`[${context}] ${message}`, error);
  },
};

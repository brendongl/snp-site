'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Loader2 } from 'lucide-react';
import { ContentCheck } from '@/types';

interface EditContentCheckDialogProps {
  open: boolean;
  onClose: () => void;
  check: ContentCheck;
  gameName: string;
  onSuccess: () => void;
}

export function EditContentCheckDialog({
  open,
  onClose,
  check,
  gameName,
  onSuccess,
}: EditContentCheckDialogProps) {
  const [loading, setLoading] = useState(false);

  // Form state - initialize with existing check data
  const [status, setStatus] = useState<string>('');
  const [boxCondition, setBoxCondition] = useState<string>('');
  const [cardCondition, setCardCondition] = useState<string>('');
  const [missingPieces, setMissingPieces] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [sleevedAtCheck, setSleevedAtCheck] = useState(false);
  const [boxWrappedAtCheck, setBoxWrappedAtCheck] = useState(false);
  // v1.2.0: Add hasIssue toggle state
  const [hasIssueToggle, setHasIssueToggle] = useState(false);

  // Initialize form fields when dialog opens or check changes
  useEffect(() => {
    if (open && check) {
      setStatus(check.fields.Status || '');
      setBoxCondition(check.fields['Box Condition'] || '');
      setCardCondition(check.fields['Card Condition'] || '');
      setMissingPieces(check.fields['Missing Pieces'] || '');
      setNotes(check.fields.Notes || '');
      setSleevedAtCheck(check.fields['Sleeved At Check'] || false);
      setBoxWrappedAtCheck(check.fields['Box Wrapped At Check'] || false);
      // v1.2.0: Initialize hasIssue toggle from existing check
      const hasIssueFromCheck = !!(missingPieces && missingPieces.trim());
      setHasIssueToggle(hasIssueFromCheck);
    }
  }, [open, check]);

  // v1.2.0: Control toggle based on status (same logic as ContentCheckDialog)
  useEffect(() => {
    if (status === 'Perfect Condition') {
      setHasIssueToggle(false); // Force OFF
    } else if (status === 'Major Issues' || status === 'Unplayable') {
      setHasIssueToggle(true); // Lock ON
    }
  }, [status]);

  const handleSubmit = async () => {
    // v1.2.0: Validation with toggle logic
    const missingFields: string[] = [];
    if (!status) missingFields.push('Status');
    if (!boxCondition) missingFields.push('Box Condition');
    if (!cardCondition) missingFields.push('Card Condition');

    if (missingFields.length > 0) {
      alert(`Please fill in all required fields:\n${missingFields.join(', ')}`);
      return;
    }

    // v1.2.0: Validate toggle logic
    if (status === 'Perfect Condition' && hasIssueToggle) {
      alert('Cannot have issues with Perfect Condition status');
      return;
    }
    if ((status === 'Major Issues' || status === 'Unplayable') && (!missingPieces || !missingPieces.trim())) {
      alert('Issue description required for Major Issues or Unplayable status');
      return;
    }

    // v1.2.0: Calculate hasIssue based on toggle AND description
    const hasIssue = hasIssueToggle && missingPieces.trim().length > 0;

    setLoading(true);
    try {
      const response = await fetch(`/api/content-checks/${check.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          boxCondition,
          cardCondition,
          missingPieces,
          notes,
          sleevedAtCheck,
          boxWrappedAtCheck,
          hasIssue, // v1.2.0: Include hasIssue field
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update content check');
      }

      // Success
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating content check:', error);
      alert('Failed to update content check. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  // Get inspector name from check
  const inspectorName = Array.isArray(check.fields.Inspector)
    ? check.fields.Inspector.join(', ')
    : check.fields.Inspector || 'Unknown';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Content Check: {gameName}</DialogTitle>
          <DialogDescription>
            Update the content check details below. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Inspector - Read-only display */}
          <div className="px-3 py-2 bg-muted rounded-lg text-sm">
            <span className="font-medium">Inspector:</span> {inspectorName}
          </div>

          {/* Check Date - Read-only display */}
          {check.fields['Check Date'] && (
            <div className="px-3 py-2 bg-muted rounded-lg text-sm">
              <span className="font-medium">Check Date:</span>{' '}
              {new Date(check.fields['Check Date']).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
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

          {/* v1.2.0: Report an Issue Toggle */}
          <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <Label htmlFor="hasIssue" className="text-base font-semibold">
                Report an Issue
              </Label>
              <Checkbox
                id="hasIssue"
                checked={hasIssueToggle}
                onCheckedChange={(checked) => setHasIssueToggle(checked as boolean)}
                disabled={status === 'Perfect Condition' || status === 'Major Issues' || status === 'Unplayable'}
              />
            </div>
            {hasIssueToggle && (
              <Textarea
                id="issueDescription"
                value={missingPieces}
                onChange={(e) => setMissingPieces(e.target.value)}
                placeholder="Describe the issue (e.g., missing 1 white road, broken sleeves, damaged box corner)"
                className="min-h-[80px]"
              />
            )}
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
            Update Content Check
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

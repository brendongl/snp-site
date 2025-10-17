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
import { Loader2 } from 'lucide-react';
import { BoardGame } from '@/types';

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
  const [loading, setLoading] = useState(false);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [loadingInspectors, setLoadingInspectors] = useState(true);

  // Form state
  const [inspector, setInspector] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [boxCondition, setBoxCondition] = useState<string>('');
  const [cardCondition, setCardCondition] = useState<string>('');
  const [missingPieces, setMissingPieces] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [sleevedAtCheck, setSleevedAtCheck] = useState(false);
  const [boxWrappedAtCheck, setBoxWrappedAtCheck] = useState(false);

  // Load inspectors when dialog opens
  useEffect(() => {
    if (open && inspectors.length === 0) {
      loadInspectors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
    // Validation
    if (!inspector || !status || !boxCondition || !cardCondition || !missingPieces) {
      alert('Please fill in all required fields');
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

      if (!response.ok) {
        throw new Error('Failed to create content check');
      }

      // Success
      onSuccess();
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error creating content check:', error);
      alert('Failed to create content check. Please try again.');
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
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Content Check: {game.fields['Game Name']}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Inspector */}
          <div className="space-y-2">
            <Label htmlFor="inspector">
              Inspector <span className="text-red-500">*</span>
            </Label>
            <Select value={inspector} onValueChange={setInspector} disabled={loadingInspectors}>
              <SelectTrigger id="inspector">
                <SelectValue placeholder={loadingInspectors ? 'Loading...' : 'Select inspector'} />
              </SelectTrigger>
              <SelectContent>
                {inspectors.map((insp) => (
                  <SelectItem key={insp.id} value={insp.id}>
                    {insp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
              Missing Pieces <span className="text-red-500">*</span>
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
            <Label htmlFor="notes">Notes</Label>
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
  );
}

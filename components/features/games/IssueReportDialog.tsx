/**
 * Issue Report Dialog Component (v1.5.0)
 *
 * Simple dialog for reporting game issues
 * - Pre-defined issue categories (no manual actionable/non-actionable selection)
 * - Automatic Vikunja task creation for actionable issues
 * - Awards 100 point reporter bonus to all issue reports
 */

'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertCircle, CheckCircle2, Loader2, Star } from 'lucide-react';

interface IssueReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  gameName: string;
  staffId: string;
  onSuccess?: (message: string) => void;
}

const ISSUE_CATEGORIES = [
  {
    value: 'broken_sleeves',
    label: 'Broken Card Sleeves',
    type: 'actionable' as const,
    description: 'Card sleeves need replacement'
  },
  {
    value: 'needs_sorting',
    label: 'Needs Sorting',
    type: 'actionable' as const,
    description: 'Components are mixed up or disorganized'
  },
  {
    value: 'needs_cleaning',
    label: 'Needs Cleaning',
    type: 'actionable' as const,
    description: 'Game is dirty or has stains'
  },
  {
    value: 'box_rewrap',
    label: 'Box Needs Re-wrapping',
    type: 'actionable' as const,
    description: 'Box is torn or needs new wrap'
  },
  {
    value: 'customer_reported',
    label: 'Customer Reported Issue',
    type: 'actionable' as const,
    description: 'Customer noticed something wrong'
  },
  {
    value: 'other_actionable',
    label: 'Other Actionable Issue',
    type: 'actionable' as const,
    description: 'Something else that can be fixed'
  },
  {
    value: 'missing_pieces',
    label: 'Missing Pieces',
    type: 'non_actionable' as const,
    description: 'Components are permanently missing'
  },
  {
    value: 'broken_components',
    label: 'Broken Components',
    type: 'non_actionable' as const,
    description: 'Pieces are damaged beyond repair'
  },
  {
    value: 'damaged_box',
    label: 'Damaged Box',
    type: 'non_actionable' as const,
    description: 'Box is damaged but still functional'
  },
  {
    value: 'component_wear',
    label: 'Component Wear',
    type: 'non_actionable' as const,
    description: 'Normal wear and tear on components'
  }
];

export function IssueReportDialog({
  isOpen,
  onClose,
  gameId,
  gameName,
  staffId,
  onSuccess
}: IssueReportDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issueReportPoints, setIssueReportPoints] = useState<number>(100); // Default fallback

  // Fetch dynamic point values on mount
  useEffect(() => {
    const fetchPointValues = async () => {
      try {
        const response = await fetch('/api/points-display');
        const data = await response.json();
        if (data.success && data.points?.issue_report) {
          setIssueReportPoints(data.points.issue_report);
        }
      } catch (error) {
        console.error('Failed to fetch point values:', error);
        // Keep fallback value
      }
    };

    fetchPointValues();
  }, []);

  const handleSubmit = async () => {
    if (!selectedCategory || !description.trim()) {
      setError('Please select a category and provide a description');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/games/${gameId}/report-issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reportedById: staffId,
          issueCategory: selectedCategory,
          issueDescription: description.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to report issue');
      }

      // Success!
      const successMessage = data.message || 'Issue reported successfully!';
      if (onSuccess) {
        onSuccess(successMessage);
      }

      // Reset form and close
      setSelectedCategory('');
      setDescription('');
      onClose();

    } catch (err) {
      console.error('Error reporting issue:', err);
      setError(err instanceof Error ? err.message : 'Failed to report issue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (!isSubmitting) {
      setSelectedCategory('');
      setDescription('');
      setError(null);
      onClose();
    }
  };

  const selectedCategoryInfo = ISSUE_CATEGORIES.find(cat => cat.value === selectedCategory);

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report Issue - {gameName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label>Issue Category *</Label>
            <RadioGroup value={selectedCategory} onValueChange={setSelectedCategory}>
              <div className="space-y-2">
                {/* Actionable Issues */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Actionable Issues (Creates task)
                  </div>
                  {ISSUE_CATEGORIES.filter(cat => cat.type === 'actionable').map(category => (
                    <div key={category.value} className="flex items-start space-x-2 pl-6">
                      <RadioGroupItem value={category.value} id={category.value} />
                      <Label
                        htmlFor={category.value}
                        className="font-normal cursor-pointer flex-1"
                      >
                        <div className="font-medium">{category.label}</div>
                        <div className="text-xs text-muted-foreground">{category.description}</div>
                      </Label>
                    </div>
                  ))}
                </div>

                {/* Non-Actionable Issues */}
                <div className="space-y-2 pt-2">
                  <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    Non-Actionable Issues (Tracking only)
                  </div>
                  {ISSUE_CATEGORIES.filter(cat => cat.type === 'non_actionable').map(category => (
                    <div key={category.value} className="flex items-start space-x-2 pl-6">
                      <RadioGroupItem value={category.value} id={category.value} />
                      <Label
                        htmlFor={category.value}
                        className="font-normal cursor-pointer flex-1"
                      >
                        <div className="font-medium">{category.label}</div>
                        <div className="text-xs text-muted-foreground">{category.description}</div>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Be specific about what's wrong and any relevant details
            </p>
          </div>

          {/* Info Box */}
          {selectedCategoryInfo && (
            <div className={`p-3 rounded-lg border ${
              selectedCategoryInfo.type === 'actionable'
                ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                : 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800'
            }`}>
              <div className="text-sm">
                {selectedCategoryInfo.type === 'actionable' ? (
                  <>
                    <p className="font-medium text-green-800 dark:text-green-200">
                      ✓ This will create a task for resolution
                    </p>
                    <div className="flex items-center gap-1 text-green-700 dark:text-green-300 mt-1">
                      <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-600" />
                      <span className="text-sm font-medium">+{issueReportPoints}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      ⚠ This issue will be tracked for awareness only
                    </p>
                    <div className="flex items-center gap-1 text-amber-700 dark:text-amber-300 mt-1">
                      <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-600" />
                      <span className="text-sm font-medium">+{issueReportPoints}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedCategory || !description.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reporting...
                </>
              ) : (
                'Report Issue'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

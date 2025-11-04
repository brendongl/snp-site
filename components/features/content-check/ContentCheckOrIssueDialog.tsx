/**
 * Content Check or Issue Dialog Component (v1.5.0)
 *
 * Simple two-button dialog for choosing between:
 * - Perform Full Content Check (existing flow)
 * - Report an Issue (new flow)
 */

'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BoardGame } from '@/types';

interface ContentCheckOrIssueDialogProps {
  game: BoardGame;
  isOpen: boolean;
  onClose: () => void;
  onOpenContentCheck: () => void;
  onOpenIssueReport: () => void;
}

export function ContentCheckOrIssueDialog({
  game,
  isOpen,
  onClose,
  onOpenContentCheck,
  onOpenIssueReport
}: ContentCheckOrIssueDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>What would you like to do?</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <Button
            onClick={() => {
              onClose();
              onOpenContentCheck();
            }}
            className="w-full h-20 text-lg"
            variant="outline"
          >
            <div className="flex flex-col items-center">
              <span className="text-2xl mb-1">📝</span>
              <span>Perform Full Content Check</span>
              <span className="text-xs text-muted-foreground">
                Count all pieces and inspect condition
              </span>
            </div>
          </Button>

          <Button
            onClick={() => {
              onClose();
              onOpenIssueReport();
            }}
            className="w-full h-20 text-lg"
            variant="outline"
          >
            <div className="flex flex-col items-center">
              <span className="text-2xl mb-1">⚠️</span>
              <span>Report an Issue</span>
              <span className="text-xs text-muted-foreground">
                Quick issue report without full check
              </span>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

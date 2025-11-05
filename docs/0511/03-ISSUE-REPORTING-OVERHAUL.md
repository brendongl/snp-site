# Phase 3: Issue Reporting System Overhaul

**Priority**: 🟠 High
**Effort**: Large (2-3 hours)
**Dependencies**: None
**Affects**: Issue reporting workflow, game dialog, content check dialog

---

## Issues Addressed

### Issue #3: Remove Checklist Overlay
Remove the middle checklist icon overlay which brings up "what would you like to do" dialog. Instead, add "Report an Issue" button inside the game popup dialog.

### Issue #4: Display Task Titles in Game Notes
Games with Vikunja tasks or unactionable issues need to have that title displayed in the notes section within the game popup dialog.

Example: Task https://tasks.sipnplay.cafe/tasks/83 has title "broken sleeves - Time Bomb (Japanese)" and should show "broken sleeves" in the game dialog notes.

### Issue #5: Update Content Check Dialog
Content Check dialog has outdated "Report an Issue" toggle. Replace with new pre-defined list and Vikunja task creation.

---

## Architecture Overview

### Current State
```
GameCard (overlay)
  └─ Middle Icon Click → "What would you like to do?" Dialog
       ├─ Quick Content Check
       ├─ Report an Issue
       └─ Log Play Session

Content Check Dialog
  └─ "Report an Issue" Toggle (old, broken)
```

### Target State
```
GameCard (no middle overlay)
  └─ Click Card → Game Detail Modal
       ├─ Notes Section (shows linked Vikunja task titles)
       ├─ "Report an Issue" Button → Issue Report Dialog
       └─ Other actions...

Content Check Dialog
  └─ "Report an Issue" Button → Issue Report Dialog (same as game dialog)

Issue Report Dialog (shared component)
  └─ Pre-defined issue types + creates Vikunja task
```

---

## Part 1: Remove Checklist Overlay Icon

### Files to Modify
- [components/features/games/GameCard.tsx](../../components/features/games/GameCard.tsx)

### Implementation

#### Step 1: Remove Middle Icon Overlay

**Find and remove**:
```tsx
{/* Middle overlay icon - REMOVE THIS */}
<div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
  <button
    onClick={(e) => {
      e.stopPropagation();
      // Opens "what would you like to do" dialog
    }}
    className="..."
  >
    <ClipboardCheck className="h-6 w-6" />
  </button>
</div>
```

#### Step 2: Remove Associated Dialog

**Find and remove**:
```tsx
{/* "What would you like to do?" Dialog - REMOVE THIS */}
<Dialog open={showQuickActionsDialog} onOpenChange={setShowQuickActionsDialog}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>What would you like to do?</DialogTitle>
    </DialogHeader>
    {/* Quick actions UI */}
  </DialogContent>
</Dialog>
```

#### Step 3: Clean Up State

**Remove state variables**:
```tsx
const [showQuickActionsDialog, setShowQuickActionsDialog] = useState(false);
// Remove any other related state
```

---

## Part 2: Add "Report an Issue" Button to Game Dialog

### Files to Modify
- [components/features/games/GameDetailModal.tsx](../../components/features/games/GameDetailModal.tsx)

### Implementation

#### Step 1: Add Button to Game Dialog

**Location**: Inside `GameDetailModal`, add near other action buttons (content check, play log, etc.)

```tsx
{staffMode && (
  <div className="flex gap-2">
    <Button
      onClick={() => setShowContentCheckDialog(true)}
      variant="outline"
      className="flex-1"
    >
      <ClipboardCheck className="h-4 w-4 mr-2" />
      Content Check
    </Button>

    {/* NEW: Report an Issue button */}
    <Button
      onClick={() => setShowIssueReportDialog(true)}
      variant="outline"
      className="flex-1"
    >
      <AlertCircle className="h-4 w-4 mr-2" />
      Report Issue
    </Button>

    <Button
      onClick={() => setShowPlayLogDialog(true)}
      variant="outline"
      className="flex-1"
    >
      <PlayCircle className="h-4 w-4 mr-2" />
      Log Play
    </Button>
  </div>
)}
```

#### Step 2: Add State for Issue Report Dialog

```tsx
const [showIssueReportDialog, setShowIssueReportDialog] = useState(false);
```

#### Step 3: Import Issue Report Dialog Component

```tsx
import { IssueReportDialog } from '@/components/features/issues/IssueReportDialog';
```

---

## Part 3: Create Shared Issue Report Dialog Component

### Files to Create
- [components/features/issues/IssueReportDialog.tsx](../../components/features/issues/IssueReportDialog.tsx) (new file)

### Implementation

```tsx
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface IssueReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameId: string;
  gameName: string;
  staffMemberName?: string;
}

const ISSUE_TYPES = [
  { value: 'missing_pieces', label: 'Missing Pieces', points: 500, complexity: 2 },
  { value: 'broken_sleeves', label: 'Broken Sleeves', points: 500, complexity: 1 },
  { value: 'damaged_box', label: 'Damaged Box', points: 500, complexity: 1 },
  { value: 'damaged_components', label: 'Damaged Components', points: 500, complexity: 2 },
  { value: 'unclear_rules', label: 'Unclear Rules', points: 200, complexity: 1 },
  { value: 'needs_organization', label: 'Needs Organization', points: 200, complexity: 1 },
  { value: 'needs_sleeves', label: 'Needs Sleeves', points: 1000, complexity: 2 },
  { value: 'needs_wrapping', label: 'Needs Box Wrapping', points: 500, complexity: 1 },
  { value: 'other', label: 'Other Issue', points: 500, complexity: 1 },
];

export function IssueReportDialog({
  open,
  onOpenChange,
  gameId,
  gameName,
  staffMemberName,
}: IssueReportDialogProps) {
  const [issueType, setIssueType] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!issueType) {
      toast({
        title: 'Error',
        description: 'Please select an issue type',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedIssue = ISSUE_TYPES.find((t) => t.value === issueType);

      const response = await fetch('/api/vikunja/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${selectedIssue?.label} - ${gameName}`,
          description: `**Issue:** ${description || selectedIssue?.label}\n**Reported by:** ${staffMemberName || 'Staff'}\n**Game ID:** ${gameId}\n**Complexity:** ${selectedIssue?.complexity}\n\nComplete this task to resolve the issue and earn ${selectedIssue?.points} points!`,
          projectId: 1, // Observation Notes project
          labelIds: [`points:${selectedIssue?.points}`],
          priority: selectedIssue?.complexity || 1,
        }),
      });

      if (!response.ok) throw new Error('Failed to create task');

      toast({
        title: 'Success',
        description: 'Issue reported successfully. Task created in Vikunja.',
      });

      // Reset form
      setIssueType('');
      setDescription('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error reporting issue:', error);
      toast({
        title: 'Error',
        description: 'Failed to report issue. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Report an Issue
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="game-name">Game</Label>
            <input
              id="game-name"
              type="text"
              value={gameName}
              disabled
              className="w-full px-3 py-2 border rounded bg-muted"
            />
          </div>

          <div>
            <Label htmlFor="issue-type">Issue Type *</Label>
            <Select value={issueType} onValueChange={setIssueType}>
              <SelectTrigger id="issue-type">
                <SelectValue placeholder="Select issue type" />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label} ({type.points} points)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Additional Details (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in more detail..."
              rows={4}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
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
```

---

## Part 4: Display Vikunja Task Titles in Game Notes

### Files to Modify
- [components/features/games/GameDetailModal.tsx](../../components/features/games/GameDetailModal.tsx)
- [app/api/vikunja/tasks/by-game/route.ts](../../app/api/vikunja/tasks/by-game/route.ts) (new endpoint)

### Implementation

#### Step 1: Create API Endpoint to Fetch Tasks by Game ID

**Create** [app/api/vikunja/tasks/by-game/route.ts](../../app/api/vikunja/tasks/by-game/route.ts):

```typescript
import { NextResponse } from 'next/server';
import { VikunjaService } from '@/lib/services/vikunja-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');

    if (!gameId) {
      return NextResponse.json({ error: 'Game ID required' }, { status: 400 });
    }

    const vikunjaService = new VikunjaService();

    // Get all tasks from Observation Notes project (ID: 1)
    const tasks = await vikunjaService.getTasksByProject(1);

    // Filter tasks that contain the game ID in description
    const gameTasks = tasks.filter((task: any) =>
      task.description?.includes(`Game ID:** ${gameId}`) && !task.done
    );

    // Extract just the issue type from title (e.g., "broken sleeves - Time Bomb" → "broken sleeves")
    const issues = gameTasks.map((task: any) => {
      const titleParts = task.title.split(' - ');
      return {
        id: task.id,
        issueType: titleParts[0],
        fullTitle: task.title,
        createdAt: task.created,
      };
    });

    return NextResponse.json({ issues });
  } catch (error) {
    console.error('[API] Error fetching tasks by game:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}
```

#### Step 2: Fetch and Display Issues in Game Dialog

**In GameDetailModal.tsx**:

```tsx
// Add state
const [linkedIssues, setLinkedIssues] = useState<any[]>([]);

// Fetch linked issues when dialog opens
useEffect(() => {
  if (open && game.id) {
    fetch(`/api/vikunja/tasks/by-game?gameId=${game.id}`)
      .then((res) => res.json())
      .then((data) => setLinkedIssues(data.issues || []))
      .catch((err) => console.error('Error fetching linked issues:', err));
  }
}, [open, game.id]);

// In the Notes section of the dialog
<div>
  <h3 className="font-semibold mb-2">Notes</h3>

  {/* Existing notes */}
  {game.notes && (
    <p className="text-sm text-muted-foreground mb-2">{game.notes}</p>
  )}

  {/* Linked issues from Vikunja */}
  {linkedIssues.length > 0 && (
    <div className="mt-3 p-3 border border-yellow-200 bg-yellow-50 rounded">
      <h4 className="text-sm font-semibold text-yellow-800 mb-2 flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        Active Issues
      </h4>
      <ul className="space-y-1">
        {linkedIssues.map((issue) => (
          <li key={issue.id} className="text-sm text-yellow-900">
            • {issue.issueType}
          </li>
        ))}
      </ul>
      <p className="text-xs text-yellow-700 mt-2">
        These issues can be resolved from the staff dashboard.
      </p>
    </div>
  )}
</div>
```

---

## Part 5: Update Content Check Dialog

### Files to Modify
- [components/features/content-check/ContentCheckDialog.tsx](../../components/features/content-check/ContentCheckDialog.tsx)

### Implementation

#### Step 1: Remove Old "Report an Issue" Toggle

**Find and remove**:
```tsx
{/* Old report issue toggle - REMOVE THIS */}
<div className="flex items-center gap-2">
  <input
    type="checkbox"
    id="report-issue"
    checked={reportIssue}
    onChange={(e) => setReportIssue(e.target.checked)}
  />
  <label htmlFor="report-issue">Report an Issue</label>
</div>

{reportIssue && (
  <textarea
    placeholder="Describe the issue..."
    // ... old issue reporting
  />
)}
```

#### Step 2: Add "Report an Issue" Button

```tsx
{/* Add after the main content check form */}
<div className="border-t pt-4 mt-4">
  <Button
    onClick={() => {
      // Close content check dialog
      onOpenChange(false);
      // Open issue report dialog
      setShowIssueReportDialog(true);
    }}
    variant="outline"
    className="w-full"
  >
    <AlertCircle className="h-4 w-4 mr-2" />
    Report an Issue with This Game
  </Button>
</div>
```

#### Step 3: Add Issue Report Dialog Integration

```tsx
// Add to ContentCheckDialog
import { IssueReportDialog } from '@/components/features/issues/IssueReportDialog';

// Add state
const [showIssueReportDialog, setShowIssueReportDialog] = useState(false);

// Add dialog component
<IssueReportDialog
  open={showIssueReportDialog}
  onOpenChange={setShowIssueReportDialog}
  gameId={game.id}
  gameName={game.name}
  staffMemberName={staffName}
/>
```

---

## Implementation Steps

### Step 1: Create Issue Report Dialog Component
1. Create directory [components/features/issues/](../../components/features/issues/)
2. Create [IssueReportDialog.tsx](../../components/features/issues/IssueReportDialog.tsx)
3. Implement component as specified above

### Step 2: Create Vikunja API Endpoint
1. Create [app/api/vikunja/tasks/by-game/route.ts](../../app/api/vikunja/tasks/by-game/route.ts)
2. Implement task filtering by game ID
3. Test endpoint locally

### Step 3: Remove Checklist Overlay
1. Open [GameCard.tsx](../../components/features/games/GameCard.tsx)
2. Remove middle icon overlay
3. Remove "what would you like to do" dialog
4. Clean up related state

### Step 4: Update Game Detail Modal
1. Open [GameDetailModal.tsx](../../components/features/games/GameDetailModal.tsx)
2. Add "Report an Issue" button
3. Add linked issues display in Notes section
4. Integrate IssueReportDialog component

### Step 5: Update Content Check Dialog
1. Open [ContentCheckDialog.tsx](../../components/features/content-check/ContentCheckDialog.tsx)
2. Remove old "Report an Issue" toggle
3. Add new "Report an Issue" button
4. Integrate IssueReportDialog component

### Step 6: Test End-to-End
1. Test reporting issue from game dialog
2. Verify task created in Vikunja
3. Verify issue appears in game notes
4. Test reporting issue from content check dialog
5. Verify middle overlay is removed

### Step 7: Commit and Deploy
```bash
git add .
git commit -m "v1.5.6 - Issue reporting system overhaul

- Remove checklist overlay icon from game cards
- Add Report Issue button to game dialog
- Display Vikunja task titles in game notes
- Update content check dialog with new issue reporting
- Create shared IssueReportDialog component

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin staging
```

---

## Testing Checklist

### Issue Reporting
- [ ] IssueReportDialog component created
- [ ] Issue types dropdown populated
- [ ] Task creation works
- [ ] Vikunja task has correct format
- [ ] Points label assigned correctly

### Game Dialog
- [ ] "Report Issue" button visible in staff mode
- [ ] Button opens IssueReportDialog
- [ ] Linked issues display in Notes section
- [ ] Issue type extracted correctly from title

### Content Check Dialog
- [ ] Old toggle removed
- [ ] New "Report Issue" button added
- [ ] Button opens IssueReportDialog
- [ ] Game info passed correctly

### Overlay Removal
- [ ] Middle checklist icon removed from GameCard
- [ ] "What would you like to do" dialog removed
- [ ] No console errors

---

## Rollback Plan

If issues arise:
1. Revert commit
2. Redeploy previous version
3. Review error logs
4. Fix issues incrementally

---

## Estimated Timeline

- **Implementation**: 2 hours
- **Testing**: 45 minutes
- **Deployment**: 15 minutes
- **Total**: ~3 hours

---

## Related Files

- [components/features/games/GameCard.tsx](../../components/features/games/GameCard.tsx)
- [components/features/games/GameDetailModal.tsx](../../components/features/games/GameDetailModal.tsx)
- [components/features/content-check/ContentCheckDialog.tsx](../../components/features/content-check/ContentCheckDialog.tsx)
- [components/features/issues/IssueReportDialog.tsx](../../components/features/issues/IssueReportDialog.tsx) (new)
- [app/api/vikunja/tasks/by-game/route.ts](../../app/api/vikunja/tasks/by-game/route.ts) (new)
- [lib/services/vikunja-service.ts](../../lib/services/vikunja-service.ts)

---

## Notes

- Issue types and points are configurable in IssueReportDialog
- Vikunja project ID 1 is "Observation Notes"
- Tasks are filtered by game ID in description
- Issue type extraction uses first part of title before " - "
- Consider adding task resolution button in game dialog (future enhancement)

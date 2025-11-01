'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useToast } from '@/lib/context/toast-context';

interface GameIssue {
  issue_description: string;
  game_id: string;
  game_name: string;
  check_id: string;
  reported_by: string;
  reported_date: string;
  notes: string | null;
}

export default function IssuesMissingReport() {
  const { addToast } = useToast();
  const [issues, setIssues] = useState<GameIssue[]>([]);
  const [filteredIssues, setFilteredIssues] = useState<GameIssue[]>([]);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  // v1.2.0: Resolution dialog state
  const [showResolutionDialog, setShowResolutionDialog] = useState(false);
  const [currentIssue, setCurrentIssue] = useState<GameIssue | null>(null);
  const [isPerfectCondition, setIsPerfectCondition] = useState<boolean | null>(null);
  const [remainingIssues, setRemainingIssues] = useState('');

  useEffect(() => {
    fetchGameIssues();
  }, []);

  useEffect(() => {
    // Filter issues based on search term
    if (searchTerm) {
      const filtered = issues.filter((issue) =>
        issue.issue_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.game_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredIssues(filtered);
    } else {
      setFilteredIssues(issues);
    }
  }, [searchTerm, issues]);

  const fetchGameIssues = async () => {
    try {
      const response = await fetch('/api/content-checks/needs-attention');
      if (response.ok) {
        const data = await response.json();
        setIssues(data.issues || []);
        setFilteredIssues(data.issues || []);
      }
    } catch (error) {
      console.error('Error fetching game issues:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (issueKey: string) => {
    setExpandedIssue(expandedIssue === issueKey ? null : issueKey);
  };

  const handleResolveClick = (issue: GameIssue) => {
    setCurrentIssue(issue);
    setIsPerfectCondition(null);
    setRemainingIssues('');
    setShowResolutionDialog(true);
  };

  const handleResolveSubmit = async () => {
    if (!currentIssue || isPerfectCondition === null) {
      return;
    }

    // If not perfect condition, require remaining issues description
    if (!isPerfectCondition && !remainingIssues.trim()) {
      addToast('Please describe the remaining issues', 'error');
      return;
    }

    try {
      setResolving(currentIssue.check_id);

      // Get current staff member
      const staffId = localStorage.getItem('staff_id');
      if (!staffId) {
        addToast('Please log in as staff to resolve issues', 'error');
        return;
      }

      // Call resolution API
      const response = await fetch('/api/content-checks/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalCheckId: currentIssue.check_id,
          gameId: currentIssue.game_id,
          staffId,
          isPerfectCondition,
          remainingIssues: isPerfectCondition ? null : remainingIssues,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to resolve issue');
      }

      // Success!
      addToast(`Issue resolved for ${currentIssue.game_name}`, 'success');
      setShowResolutionDialog(false);
      setCurrentIssue(null);

      // Refresh the issues list
      await fetchGameIssues();
    } catch (error) {
      console.error('Error resolving issue:', error);
      addToast('Failed to resolve issue. Please try again.', 'error');
    } finally {
      setResolving(null);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Issues/Missing Report</h2>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-200 rounded"></div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Issues/Missing Report</h2>
          <p className="text-sm text-gray-600">
            {filteredIssues.length} games with issues
          </p>
        </div>

        <Input
          placeholder="Search issues or game names..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mb-4"
        />

        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filteredIssues.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              {searchTerm ? 'No issues match your search' : 'No games with issues!'}
            </p>
          ) : (
            filteredIssues.map((issue, index) => (
              <div key={`${issue.check_id}-${index}`} className="border rounded-lg border-red-200">
                <button
                  onClick={() => toggleExpand(issue.check_id + index)}
                  className="w-full flex items-center justify-between p-3 hover:bg-red-50 text-left"
                >
                  <div className="flex-1">
                    <span className="font-medium">{issue.game_name}</span>
                    <p className="text-sm text-red-600 mt-1">{issue.issue_description}</p>
                  </div>
                  {expandedIssue === issue.check_id + index ? (
                    <ChevronDown className="h-5 w-5 text-gray-400 ml-2" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400 ml-2" />
                  )}
                </button>

                {expandedIssue === issue.check_id + index && (
                  <div className="p-3 border-t bg-gray-50 space-y-2">
                    <div>
                      <span className="text-sm font-medium">Reported: </span>
                      <span className="text-sm">
                        {new Date(issue.reported_date).toLocaleDateString()} by{' '}
                        {issue.reported_by}
                      </span>
                    </div>
                    {issue.notes && (
                      <div>
                        <span className="text-sm font-medium">Note: </span>
                        <span className="text-sm">{issue.notes}</span>
                      </div>
                    )}
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleResolveClick(issue)}
                        disabled={resolving === issue.check_id}
                      >
                        {resolving === issue.check_id ? 'Resolving...' : 'Resolved'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.location.href = `/games?staff=true&openGame=${issue.game_id}`}
                      >
                        View Game
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* v1.2.0: Resolution Dialog */}
      <Dialog open={showResolutionDialog} onOpenChange={setShowResolutionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve Issue: {currentIssue?.game_name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                Is the game now in Perfect Condition?
              </Label>

              <div className="flex gap-3">
                <Button
                  variant={isPerfectCondition === true ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setIsPerfectCondition(true)}
                >
                  Yes - Perfect Condition
                </Button>
                <Button
                  variant={isPerfectCondition === false ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setIsPerfectCondition(false)}
                >
                  No - Still has issues
                </Button>
              </div>
            </div>

            {isPerfectCondition === false && (
              <div className="space-y-2">
                <Label htmlFor="remainingIssues">
                  Describe remaining issues <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="remainingIssues"
                  value={remainingIssues}
                  onChange={(e) => setRemainingIssues(e.target.value)}
                  placeholder="e.g., box still torn, cards still bent"
                  className="min-h-[80px]"
                />
              </div>
            )}

            {isPerfectCondition === true && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-800">
                  ✓ This will mark the game as Perfect Condition and remove it from the Issues/Missing Report.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowResolutionDialog(false);
                setCurrentIssue(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResolveSubmit}
              disabled={isPerfectCondition === null || (isPerfectCondition === false && !remainingIssues.trim())}
            >
              Submit Resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

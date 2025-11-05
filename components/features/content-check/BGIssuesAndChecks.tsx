'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ChevronRight, ChevronDown, AlertCircle } from 'lucide-react';
import { useToast } from '@/lib/context/toast-context';

interface NonActionableIssue {
  id: string;
  gameId: string;
  gameName: string;
  issueCategory: string;
  description: string;
  reporterName: string;
  reportedById: string;
  vikunjaTaskId: number | null;
  createdAt: string;
  daysAgo: number;
}

/**
 * BG Issues & Checks Component
 * v1.5.15: Displays observation notes directly from Vikunja (labeled as 'note')
 *
 * These notes are tracked for awareness but don't require immediate staff action.
 * Staff can resolve them once addressed. Fetches directly from Vikunja to show
 * all note tasks, including those created manually or via issue reporting.
 */
export default function BGIssuesAndChecks() {
  const { addToast } = useToast();
  const [issues, setIssues] = useState<NonActionableIssue[]>([]);
  const [filteredIssues, setFilteredIssues] = useState<NonActionableIssue[]>([]);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  // Resolution dialog state
  const [showResolutionDialog, setShowResolutionDialog] = useState(false);
  const [currentIssue, setCurrentIssue] = useState<NonActionableIssue | null>(null);

  useEffect(() => {
    fetchIssues();
  }, []);

  useEffect(() => {
    // Filter issues based on search term
    if (searchTerm) {
      const filtered = issues.filter((issue) =>
        issue.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.gameName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.issueCategory.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredIssues(filtered);
    } else {
      setFilteredIssues(issues);
    }
  }, [searchTerm, issues]);

  const fetchIssues = async () => {
    try {
      // Fetch directly from Vikunja (tasks with "note" label)
      const response = await fetch('/api/vikunja/observation-notes');
      if (response.ok) {
        const data = await response.json();
        setIssues(data.issues || []);
        setFilteredIssues(data.issues || []);
      }
    } catch (error) {
      console.error('Error fetching issues:', error);
      addToast('Failed to load issues', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (issueId: string) => {
    setExpandedIssue(expandedIssue === issueId ? null : issueId);
  };

  const handleResolveClick = (issue: NonActionableIssue) => {
    setCurrentIssue(issue);
    setShowResolutionDialog(true);
  };

  const handleResolveSubmit = async () => {
    if (!currentIssue) return;

    try {
      setResolving(currentIssue.id);

      // Get current staff member
      const staffId = localStorage.getItem('staff_id');
      if (!staffId) {
        addToast('Please log in as staff to resolve issues', 'error');
        return;
      }

      // Mark Vikunja task as done
      const response = await fetch(`/api/vikunja/tasks/${currentIssue.vikunjaTaskId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          staffId: staffId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark task as complete');
      }

      // Success!
      addToast(`Observation note resolved for ${currentIssue.gameName}`, 'success');
      setShowResolutionDialog(false);
      setCurrentIssue(null);

      // Refresh the issues list
      await fetchIssues();
    } catch (error) {
      console.error('Error resolving issue:', error);
      addToast('Failed to resolve issue. Please try again.', 'error');
    } finally {
      setResolving(null);
    }
  };

  const getCategoryDisplay = (category: string) => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getCategoryColor = (category: string) => {
    const categoryColors: Record<string, string> = {
      'missing_pieces': 'bg-red-50 text-red-700 border-red-200',
      'broken_components': 'bg-orange-50 text-orange-700 border-orange-200',
      'damaged_box': 'bg-yellow-50 text-yellow-700 border-yellow-200',
      'component_wear': 'bg-gray-50 text-gray-700 border-gray-200',
    };
    return categoryColors[category] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  if (loading) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">BG Issues & Checks</h2>
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
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            Observation Notes
          </h2>
          <p className="text-sm text-gray-600">
            {filteredIssues.length} note{filteredIssues.length !== 1 ? 's' : ''} being tracked
          </p>
        </div>

        <Input
          placeholder="Search notes, games, or categories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mb-4"
        />

        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filteredIssues.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              {searchTerm ? 'No notes match your search' : 'No observation notes!'}
            </p>
          ) : (
            filteredIssues.map((issue) => (
              <div key={issue.id} className="border rounded-lg border-blue-200">
                <button
                  onClick={() => toggleExpand(issue.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-blue-50 text-left"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{issue.gameName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${getCategoryColor(issue.issueCategory)}`}>
                        {getCategoryDisplay(issue.issueCategory)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{issue.description}</p>
                  </div>
                  {expandedIssue === issue.id ? (
                    <ChevronDown className="h-5 w-5 text-gray-400 ml-2" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400 ml-2" />
                  )}
                </button>

                {expandedIssue === issue.id && (
                  <div className="p-3 border-t bg-gray-50 space-y-2">
                    <div>
                      <span className="text-sm font-medium">Reported by: </span>
                      <span className="text-sm">{issue.reporterName}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Reported: </span>
                      <span className="text-sm">
                        {issue.daysAgo === 0 ? 'Today' : `${issue.daysAgo} day${issue.daysAgo !== 1 ? 's' : ''} ago`}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleResolveClick(issue)}
                        disabled={resolving === issue.id}
                      >
                        {resolving === issue.id ? 'Resolving...' : 'Resolve Issue'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.location.href = `/games?staff=true&openGame=${issue.gameId}`}
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

      {/* Resolution Confirmation Dialog */}
      <Dialog open={showResolutionDialog} onOpenChange={setShowResolutionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve Issue: {currentIssue?.gameName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 mb-2">
                <strong>Issue:</strong> {currentIssue?.description}
              </p>
              <p className="text-sm text-blue-800">
                <strong>Category:</strong> {currentIssue && getCategoryDisplay(currentIssue.issueCategory)}
              </p>
            </div>

            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-800">
                ⚠️ This will mark the issue as resolved and remove it from the tracking list.
              </p>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-700">
                ℹ️ No points are awarded for resolving observation notes, as they are tracking-only.
              </p>
            </div>
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
              disabled={resolving !== null}
            >
              {resolving ? 'Resolving...' : 'Confirm Resolution'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

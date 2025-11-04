/**
 * Issues Overview Page (v1.5.0)
 *
 * Staff view of all game issues (actionable and non-actionable)
 * - Separate tabs for actionable vs non-actionable issues
 * - Shows issue details, reporter, and status
 * - Links to games and Vikunja tasks
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Issue {
  id: string;
  gameId: string;
  gameName?: string;
  reportedById: string;
  reporterName?: string;
  issueCategory: string;
  description: string;
  vikunjaTaskId?: number | null;
  createdAt: string;
}

export default function IssuesPage() {
  const [actionableIssues, setActionableIssues] = useState<Issue[]>([]);
  const [nonActionableIssues, setNonActionableIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIssues();
  }, []);

  const fetchIssues = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [actionableResponse, nonActionableResponse] = await Promise.all([
        fetch('/api/issues/actionable'),
        fetch('/api/issues/non-actionable')
      ]);

      if (!actionableResponse.ok || !nonActionableResponse.ok) {
        throw new Error('Failed to fetch issues');
      }

      const actionableData = await actionableResponse.json();
      const nonActionableData = await nonActionableResponse.json();

      setActionableIssues(actionableData.issues || []);
      setNonActionableIssues(nonActionableData.issues || []);
    } catch (err) {
      console.error('Error fetching issues:', err);
      setError(err instanceof Error ? err.message : 'Failed to load issues');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCategoryLabel = (category: string): string => {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const IssueCard = ({ issue, isActionable }: { issue: Issue; isActionable: boolean }) => (
    <Card className="mb-3">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-base">{issue.gameName || 'Unknown Game'}</CardTitle>
              {isActionable && issue.vikunjaTaskId && (
                <Badge variant="outline" className="text-xs">
                  Task #{issue.vikunjaTaskId}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Reported by {issue.reporterName || 'Unknown'} · {formatDate(issue.createdAt)}
            </CardDescription>
          </div>
          <Badge className={isActionable ? 'bg-green-500' : 'bg-amber-500'}>
            {formatCategoryLabel(issue.issueCategory)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">{issue.description}</p>
        <div className="flex gap-2">
          <Link href={`/games?search=${encodeURIComponent(issue.gameName || '')}`}>
            <Button variant="outline" size="sm">
              <ExternalLink className="h-3 w-3 mr-1" />
              View Game
            </Button>
          </Link>
          {isActionable && issue.vikunjaTaskId && (
            <Link
              href={`https://tasks.sipnplay.cafe/tasks/${issue.vikunjaTaskId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                <ExternalLink className="h-3 w-3 mr-1" />
                View Task
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <p className="text-red-800">{error}</p>
            <Button onClick={fetchIssues} className="mt-4" variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Game Issues</h1>
        <p className="text-muted-foreground">
          Track and manage game issues reported by staff
        </p>
      </div>

      <Tabs defaultValue="actionable" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="actionable" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Actionable ({actionableIssues.length})
          </TabsTrigger>
          <TabsTrigger value="non-actionable" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Non-Actionable ({nonActionableIssues.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actionable" className="mt-4">
          {actionableIssues.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No actionable issues</p>
                <p className="text-sm mt-1">All issues have been resolved or no issues have been reported</p>
              </CardContent>
            </Card>
          ) : (
            <div>
              {actionableIssues.map(issue => (
                <IssueCard key={issue.id} issue={issue} isActionable={true} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="non-actionable" className="mt-4">
          {nonActionableIssues.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No non-actionable issues</p>
                <p className="text-sm mt-1">No tracking-only issues have been reported</p>
              </CardContent>
            </Card>
          ) : (
            <div>
              {nonActionableIssues.map(issue => (
                <IssueCard key={issue.id} issue={issue} isActionable={false} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

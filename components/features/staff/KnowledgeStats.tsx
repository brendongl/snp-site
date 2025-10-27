'use client';

import { useState, useEffect } from 'react';
import { BookOpen, TrendingUp, Users, CheckCircle, Activity, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface StaffStats {
  totalKnowledge: number;
  knowledgeByLevel: {
    missing: number;
    beginner: number;
    intermediate: number;
    expert: number;
  };
  canTeachCount: number;
  totalPlayLogs: number;
  totalContentChecks: number;
}

interface KnowledgeEntry {
  id: string;
  staffMember: string;
  gameName: string;
  confidenceLevel: string;
  canTeach: boolean;
  notes: string;
  taughtBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeStatsProps {
  staffId: string;
  stats: StaffStats;
}

export function KnowledgeStats({ staffId, stats }: KnowledgeStatsProps) {
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeEntry[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetailedList, setShowDetailedList] = useState(false);

  // Fetch detailed knowledge list when user expands
  useEffect(() => {
    if (!showDetailedList) {
      return;
    }

    const fetchKnowledgeList = async () => {
      try {
        setIsLoadingList(true);
        setError(null);

        const response = await fetch(`/api/staff-knowledge`);

        if (!response.ok) {
          throw new Error(`Failed to fetch knowledge: ${response.statusText}`);
        }

        const data = await response.json();

        // Filter by current staff member
        const filtered = (data.knowledge || []).filter(
          (entry: KnowledgeEntry) => entry.staffMember === staffId
        );

        // Sort by confidence level (highest first), then by game name
        const sorted = filtered.sort((a: KnowledgeEntry, b: KnowledgeEntry) => {
          const levelOrder = { 'Expert': 4, 'Intermediate': 3, 'Beginner': 2, 'Instructor': 5 };
          const aLevel = levelOrder[a.confidenceLevel as keyof typeof levelOrder] || 0;
          const bLevel = levelOrder[b.confidenceLevel as keyof typeof levelOrder] || 0;

          if (aLevel !== bLevel) {
            return bLevel - aLevel; // Descending
          }

          return a.gameName.localeCompare(b.gameName);
        });

        setKnowledgeList(sorted);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load knowledge list');
        setKnowledgeList([]);
      } finally {
        setIsLoadingList(false);
      }
    };

    fetchKnowledgeList();
  }, [showDetailedList, staffId]);

  // Get badge color for confidence level
  const getConfidenceBadgeVariant = (level: string): 'default' | 'secondary' | 'outline' => {
    switch (level) {
      case 'Beginner':
        return 'secondary';
      case 'Intermediate':
        return 'default';
      case 'Expert':
      case 'Instructor':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getConfidenceBadgeClass = (level: string): string => {
    switch (level) {
      case 'Beginner':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'Intermediate':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'Expert':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'Instructor':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Knowledge Card */}
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Games Known</p>
              <p className="text-3xl font-bold">{stats.totalKnowledge}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
          </div>
        </Card>

        {/* Can Teach Card */}
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Can Teach</p>
              <p className="text-3xl font-bold">{stats.canTeachCount}</p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg">
              <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Expert & Instructor level games
          </p>
        </Card>

        {/* Play Logs Card */}
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Play Sessions</p>
              <p className="text-3xl font-bold">{stats.totalPlayLogs}</p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </Card>

        {/* Content Checks Card */}
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Content Checks</p>
              <p className="text-3xl font-bold">{stats.totalContentChecks}</p>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <CheckCircle className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </Card>

        {/* Knowledge by Level Card */}
        <Card className="p-4 md:col-span-2">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Knowledge by Level</p>
            </div>
            <div className="p-3 bg-indigo-500/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
              <span className="text-sm font-medium">Beginner</span>
              <span className="text-lg font-bold">{stats.knowledgeByLevel.beginner}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <span className="text-sm font-medium">Intermediate</span>
              <span className="text-lg font-bold">{stats.knowledgeByLevel.intermediate}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950 rounded-lg">
              <span className="text-sm font-medium">Expert</span>
              <span className="text-lg font-bold">{stats.knowledgeByLevel.expert}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-950 rounded-lg">
              <span className="text-sm font-medium">Missing</span>
              <span className="text-lg font-bold">{stats.knowledgeByLevel.missing}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Detailed Knowledge List (Collapsible) */}
      <Card className="p-4">
        <button
          onClick={() => setShowDetailedList(!showDetailedList)}
          className="w-full flex items-center justify-between text-left hover:bg-muted/50 -m-4 p-4 rounded-lg transition-colors"
        >
          <div>
            <h3 className="font-semibold text-lg">My Game Knowledge</h3>
            <p className="text-sm text-muted-foreground">
              {stats.totalKnowledge} games tracked
            </p>
          </div>
          {showDetailedList ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </button>

        {showDetailedList && (
          <div className="mt-4 pt-4 border-t">
            {/* Loading State */}
            {isLoadingList && (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Loading knowledge list...</span>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && !isLoadingList && (
              <div className="p-4 bg-destructive/10 text-destructive rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Error loading knowledge list</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!isLoadingList && !error && knowledgeList.length === 0 && (
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No knowledge entries found</p>
              </div>
            )}

            {/* Knowledge List Table */}
            {!isLoadingList && !error && knowledgeList.length > 0 && (
              <div className="space-y-2">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left py-2 px-3 text-sm font-semibold">Game</th>
                        <th className="text-left py-2 px-3 text-sm font-semibold">Level</th>
                        <th className="text-left py-2 px-3 text-sm font-semibold">Can Teach</th>
                        <th className="text-left py-2 px-3 text-sm font-semibold">Last Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {knowledgeList.map((entry) => (
                        <tr key={entry.id} className="hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-3 font-medium">{entry.gameName}</td>
                          <td className="py-3 px-3">
                            <Badge className={getConfidenceBadgeClass(entry.confidenceLevel)}>
                              {entry.confidenceLevel}
                            </Badge>
                          </td>
                          <td className="py-3 px-3">
                            {entry.canTeach ? (
                              <span className="text-green-600 dark:text-green-400">Yes</span>
                            ) : (
                              <span className="text-muted-foreground">No</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-sm text-muted-foreground">
                            {new Date(entry.updatedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {knowledgeList.map((entry) => (
                    <Card key={entry.id} className="p-3">
                      <div className="space-y-2">
                        <div className="font-medium">{entry.gameName}</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={getConfidenceBadgeClass(entry.confidenceLevel)}>
                            {entry.confidenceLevel}
                          </Badge>
                          {entry.canTeach && (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                              Can Teach
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Updated: {new Date(entry.updatedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

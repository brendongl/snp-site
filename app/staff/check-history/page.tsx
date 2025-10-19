'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, User, CheckCircle, AlertCircle } from 'lucide-react';

interface ContentCheckEntry {
  id: string;
  gameId: string;
  gameName: string;
  checkStatus?: string;
  checkDate?: string;
  checkedBy?: string;
  notes?: string;
}

export default function CheckHistoryPage() {
  const router = useRouter();
  const [staffName, setStaffName] = useState<string | null>(null);
  const [checks, setChecks] = useState<ContentCheckEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'status'>('recent');

  // Check authentication
  useEffect(() => {
    const name = localStorage.getItem('staff_name');
    if (!name) {
      router.push('/auth/signin');
      return;
    }
    setStaffName(name);
  }, [router]);

  // Fetch content check data
  useEffect(() => {
    if (!staffName) return;

    const fetchChecks = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/content-checks');

        if (!response.ok) {
          throw new Error(`Failed to fetch content checks: ${response.statusText}`);
        }

        const data = await response.json();
        let checkData = data.contentChecks || [];

        // Sort based on selected option
        if (sortBy === 'recent') {
          checkData.sort(
            (a: ContentCheckEntry, b: ContentCheckEntry) =>
              new Date(b.checkDate || '').getTime() -
              new Date(a.checkDate || '').getTime()
          );
        } else if (sortBy === 'status') {
          // Sort by status: Unplayable > Major Issues > Minor Issues > Perfect
          const statusOrder: { [key: string]: number } = {
            'Unplayable': 0,
            'Major Issues': 1,
            'Minor Issues': 2,
            'Perfect Condition': 3,
          };
          checkData.sort((a: ContentCheckEntry, b: ContentCheckEntry) => {
            const aOrder = statusOrder[a.checkStatus || ''] ?? 999;
            const bOrder = statusOrder[b.checkStatus || ''] ?? 999;
            return aOrder - bOrder;
          });
        }

        setChecks(checkData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch content checks');
        console.error('Content checks fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChecks();
  }, [staffName, sortBy]);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'Perfect Condition':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'Minor Issues':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'Major Issues':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Unplayable':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'Perfect Condition':
        return <CheckCircle className="w-4 h-4" />;
      case 'Unplayable':
      case 'Major Issues':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/games"
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Content Check History</h1>
              <p className="text-gray-600 mt-1">Track all game condition checks</p>
            </div>
          </div>
        </div>

        {/* Staff Info */}
        {staffName && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex items-center gap-2 text-gray-700">
              <User className="w-5 h-5" />
              <span>
                Logged in as: <strong>{staffName}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Sorting Controls */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Sort By:</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('recent')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  sortBy === 'recent'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Most Recent
              </button>
              <button
                onClick={() => setSortBy('status')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  sortBy === 'status'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                By Status
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading content checks...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && checks.length === 0 && !error && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No content checks found yet</p>
            <p className="text-gray-500 mt-2">
              Start checking games to see them appear here
            </p>
          </div>
        )}

        {/* Content Checks Table */}
        {!isLoading && checks.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Game Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Check Date
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Checked By
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Notes
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {checks.map((check, idx) => (
                    <tr key={`${check.id}-${idx}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {check.gameName}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                            check.checkStatus
                          )}`}
                        >
                          {getStatusIcon(check.checkStatus)}
                          {check.checkStatus || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {check.checkDate
                            ? new Date(check.checkDate).toLocaleDateString()
                            : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {check.checkedBy || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {check.notes || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Link
                          href={`/games?search=${encodeURIComponent(
                            check.gameName
                          )}`}
                          className="text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          View Game
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer Stats */}
            <div className="bg-gray-50 px-6 py-4 border-t">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Total Checks: <strong>{checks.length}</strong></span>
                <span>
                  Perfect:{' '}
                  <strong>
                    {checks.filter(c => c.checkStatus === 'Perfect Condition').length}
                  </strong>
                </span>
                <span>
                  Issues:{' '}
                  <strong>
                    {checks.filter(
                      c =>
                        c.checkStatus === 'Minor Issues' ||
                        c.checkStatus === 'Major Issues'
                    ).length}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

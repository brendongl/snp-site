'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, User, Activity, Filter, Download, TrendingUp, Users, Package, CheckCircle } from 'lucide-react';
import { useAdminMode } from '@/lib/hooks/useAdminMode';
import type { ChangelogEntry, ChangelogFilters, ChangelogStats, ChangelogChartData } from '@/types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface StaffMember {
  id: string;
  name: string;
}

export default function ChangelogPage() {
  const router = useRouter();
  const isAdmin = useAdminMode();
  const [staffName, setStaffName] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);

  // Data state
  const [logs, setLogs] = useState<ChangelogEntry[]>([]);
  const [stats, setStats] = useState<ChangelogStats | null>(null);
  const [chartData, setChartData] = useState<ChangelogChartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter state
  const [filters, setFilters] = useState<ChangelogFilters>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    endDate: new Date().toISOString().split('T')[0],
    staffId: null,
    eventType: null,
    category: null,
    myChangesOnly: false,
  });

  // Check authentication and admin access
  useEffect(() => {
    const name = localStorage.getItem('staff_name');
    const id = localStorage.getItem('staff_id');
    const staffType = localStorage.getItem('staff_type');

    if (!name || !id) {
      router.push('/auth/signin');
      return;
    }

    // Admin-only access
    if (staffType !== 'Admin') {
      alert('Access denied: Admin access required for changelog');
      router.push('/games');
      return;
    }

    setStaffName(name);
    setStaffId(id);
  }, [router, isAdmin]);

  // Fetch staff members for filter dropdown
  useEffect(() => {
    const fetchStaffMembers = async () => {
      try {
        const response = await fetch('/api/staff-list');
        if (response.ok) {
          const data = await response.json();
          const members = data.staff.map((s: any) => ({
            id: s.stafflist_id,
            name: s.staff_name,
          }));
          setStaffMembers(members);
        }
      } catch (err) {
        console.error('Failed to fetch staff members:', err);
      }
    };

    fetchStaffMembers();
  }, []);

  // Fetch changelog data
  useEffect(() => {
    if (!staffName || !isAdmin) return;

    const fetchChangelog = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Build query params
        const params = new URLSearchParams({
          startDate: filters.startDate,
          endDate: filters.endDate,
          page: currentPage.toString(),
          limit: '20',
        });

        if (filters.myChangesOnly && staffId) {
          params.append('staffId', staffId);
        } else if (filters.staffId) {
          params.append('staffId', filters.staffId);
        }

        if (filters.eventType) params.append('eventType', filters.eventType);
        if (filters.category) params.append('category', filters.category);

        const response = await fetch(`/api/changelog?${params.toString()}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch changelog: ${response.statusText}`);
        }

        const data = await response.json();
        setLogs(data.data || []);
        setStats(data.stats || null);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalItems(data.pagination?.totalItems || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load changelog');
        setLogs([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChangelog();
  }, [staffName, isAdmin, staffId, filters, currentPage]);

  // Fetch chart data separately
  useEffect(() => {
    if (!staffName || !isAdmin) return;

    const fetchChartData = async () => {
      try {
        const params = new URLSearchParams({
          startDate: filters.startDate,
          endDate: filters.endDate,
        });

        if (filters.myChangesOnly && staffId) {
          params.append('staffId', staffId);
        } else if (filters.staffId) {
          params.append('staffId', filters.staffId);
        }

        if (filters.eventType) params.append('eventType', filters.eventType);
        if (filters.category) params.append('category', filters.category);

        const response = await fetch(`/api/changelog/stats?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setChartData(data);
        }
      } catch (err) {
        console.error('Failed to fetch chart data:', err);
      }
    };

    fetchChartData();
  }, [staffName, isAdmin, staffId, filters]);

  // Get event type badge color
  const getEventTypeBadge = (eventType: string) => {
    const colors = {
      created: 'bg-green-100 text-green-800 border-green-300',
      updated: 'bg-blue-100 text-blue-800 border-blue-300',
      deleted: 'bg-red-100 text-red-800 border-red-300',
      photo_added: 'bg-purple-100 text-purple-800 border-purple-300',
    };
    return colors[eventType as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  // Get category badge color
  const getCategoryBadge = (category: string) => {
    const colors = {
      board_game: 'bg-indigo-100 text-indigo-800',
      play_log: 'bg-amber-100 text-amber-800',
      staff_knowledge: 'bg-cyan-100 text-cyan-800',
      content_check: 'bg-emerald-100 text-emerald-800',
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handle filter changes
  const handleFilterChange = (key: keyof ChangelogFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page on filter change
  };

  if (!staffName || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/games"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-medium">Back to Games</span>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Activity className="w-7 h-7 text-indigo-600" />
                Changelog
              </h1>
            </div>
            <div className="text-sm text-gray-500">
              Admin: {staffName}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Changes</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalChanges}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-indigo-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Game Updates</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.gameUpdates}</p>
                </div>
                <Package className="w-8 h-8 text-indigo-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Play Logs</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.playLogsAdded}</p>
                </div>
                <Activity className="w-8 h-8 text-amber-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Knowledge</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.knowledgeUpdates}</p>
                </div>
                <Users className="w-8 h-8 text-cyan-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Content Checks</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.contentChecks}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
            </div>
          </div>
        )}

        {/* Charts */}
        {chartData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Changes by Day - Line Chart */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Over Time</h3>
              <div className="h-72">
                <Line
                  data={{
                    labels: chartData.changesByDay.map((d) =>
                      new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    ),
                    datasets: [
                      {
                        label: 'Created',
                        data: chartData.changesByDay.map((d) => d.created),
                        borderColor: 'rgb(34, 197, 94)',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        fill: true,
                        tension: 0.4,
                      },
                      {
                        label: 'Updated',
                        data: chartData.changesByDay.map((d) => d.updated),
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true,
                        tension: 0.4,
                      },
                      {
                        label: 'Deleted',
                        data: chartData.changesByDay.map((d) => d.deleted),
                        borderColor: 'rgb(239, 68, 68)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        fill: true,
                        tension: 0.4,
                      },
                      {
                        label: 'Photos Added',
                        data: chartData.changesByDay.map((d) => d.photo_added),
                        borderColor: 'rgb(168, 85, 247)',
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        fill: true,
                        tension: 0.4,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                      },
                      tooltip: {
                        mode: 'index',
                        intersect: false,
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          stepSize: 1,
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>

            {/* Changes by Category - Doughnut Chart */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Changes by Category</h3>
              <div className="h-72 flex items-center justify-center">
                <Doughnut
                  data={{
                    labels: ['Board Games', 'Play Logs', 'Staff Knowledge', 'Content Checks'],
                    datasets: [
                      {
                        data: [
                          chartData.changesByCategory.board_game,
                          chartData.changesByCategory.play_log,
                          chartData.changesByCategory.staff_knowledge,
                          chartData.changesByCategory.content_check,
                        ],
                        backgroundColor: [
                          'rgba(99, 102, 241, 0.8)',
                          'rgba(251, 191, 36, 0.8)',
                          'rgba(6, 182, 212, 0.8)',
                          'rgba(16, 185, 129, 0.8)',
                        ],
                        borderColor: [
                          'rgb(99, 102, 241)',
                          'rgb(251, 191, 36)',
                          'rgb(6, 182, 212)',
                          'rgb(16, 185, 129)',
                        ],
                        borderWidth: 2,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                      },
                      tooltip: {
                        callbacks: {
                          label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                          }
                        }
                      }
                    },
                  }}
                />
              </div>
            </div>

            {/* Changes by Staff - Bar Chart */}
            {chartData.changesByStaff.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm lg:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Contributors</h3>
                <div className="h-72">
                  <Bar
                    data={{
                      labels: chartData.changesByStaff.map((s) => s.staffName),
                      datasets: [
                        {
                          label: 'Total Changes',
                          data: chartData.changesByStaff.map((s) => s.totalChanges),
                          backgroundColor: 'rgba(99, 102, 241, 0.8)',
                          borderColor: 'rgb(99, 102, 241)',
                          borderWidth: 2,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              return `Changes: ${context.parsed.y}`;
                            }
                          }
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            stepSize: 1,
                          },
                        },
                      },
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
              <select
                value={filters.eventType || ''}
                onChange={(e) => handleFilterChange('eventType', e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">All Events</option>
                <option value="created">Created</option>
                <option value="updated">Updated</option>
                <option value="deleted">Deleted</option>
                <option value="photo_added">Photo Added</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={filters.category || ''}
                onChange={(e) => handleFilterChange('category', e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                <option value="board_game">Board Games</option>
                <option value="play_log">Play Logs</option>
                <option value="staff_knowledge">Staff Knowledge</option>
                <option value="content_check">Content Checks</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Staff Member</label>
              <select
                value={filters.staffId || ''}
                onChange={(e) => handleFilterChange('staffId', e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">All Staff</option>
                {staffMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.myChangesOnly}
                  onChange={(e) => handleFilterChange('myChangesOnly', e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">My Changes Only</span>
              </label>
            </div>
          </div>
        </div>

        {/* Changelog Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Activity Log ({totalItems} entries)
              </h2>
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading changelog...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">{error}</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No changelog entries found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date/Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Staff Member
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getEventTypeBadge(log.event_type)}`}>
                          {log.event_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryBadge(log.category)}`}>
                          {log.category.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {log.description}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {log.staff_member}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

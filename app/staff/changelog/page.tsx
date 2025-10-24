'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Activity, Filter, TrendingUp, TrendingDown, Users, Package, CheckCircle, AlertCircle, GraduationCap, BarChart3, Info } from 'lucide-react';
import { useAdminMode } from '@/lib/hooks/useAdminMode';
import type { ChangelogEntry, ChangelogFilters, ChangelogStats, ChangelogChartData, AnalyticsInsights } from '@/types';
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
  const [previousStats, setPreviousStats] = useState<ChangelogStats | null>(null);
  const [chartData, setChartData] = useState<ChangelogChartData | null>(null);
  const [analyticsInsights, setAnalyticsInsights] = useState<AnalyticsInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [compareStaff, setCompareStaff] = useState<string[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter state
  const [filters, setFilters] = useState<ChangelogFilters>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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

    if (staffType !== 'Admin') {
      alert('Access denied: Admin access required for changelog');
      router.push('/games');
      return;
    }

    setStaffName(name);
    setStaffId(id);
  }, [router, isAdmin]);

  // Fetch staff members
  useEffect(() => {
    const fetchStaffMembers = async () => {
      try {
        const response = await fetch('/api/staff-list');
        if (response.ok) {
          const data = await response.json();
          console.log('Staff list API response:', data);
          if (data.staff && Array.isArray(data.staff)) {
            const members = data.staff.map((s: any) => ({
              id: s.id,
              name: s.name,
            }));
            console.log('Mapped staff members:', members);
            setStaffMembers(members);
          } else {
            console.error('Invalid staff data format:', data);
          }
        } else {
          console.error('Failed to fetch staff list:', response.status, response.statusText);
        }
      } catch (err) {
        console.error('Failed to fetch staff members:', err);
      }
    };

    fetchStaffMembers();
  }, []);

  // Fetch analytics insights
  useEffect(() => {
    if (!staffName || !isAdmin) return;

    const fetchInsights = async () => {
      try {
        const response = await fetch('/api/analytics/insights');
        if (response.ok) {
          const data = await response.json();
          setAnalyticsInsights(data);
        }
      } catch (err) {
        console.error('Failed to fetch analytics insights:', err);
      }
    };

    fetchInsights();
  }, [staffName, isAdmin]);

  // Fetch changelog data
  useEffect(() => {
    if (!staffName || !isAdmin) return;

    const fetchChangelog = async () => {
      try {
        setIsLoading(true);
        setError(null);

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

        console.log('[Changelog Page] Fetching with params:', params.toString());
        const response = await fetch(`/api/changelog?${params.toString()}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch changelog: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('[Changelog Page] Received data:', {
          dataCount: data.data?.length || 0,
          totalItems: data.pagination?.totalItems || 0,
          stats: data.stats,
          sampleEntry: data.data?.[0]
        });
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

  // Fetch chart data
  useEffect(() => {
    if (!staffName || !isAdmin) return;

    const fetchChartData = async () => {
      try {
        const params = new URLSearchParams({
          startDate: filters.startDate,
          endDate: filters.endDate,
          includePreviousPeriod: 'true',
        });

        if (filters.myChangesOnly && staffId) {
          params.append('staffId', staffId);
        } else if (filters.staffId) {
          params.append('staffId', filters.staffId);
        }

        if (filters.eventType) params.append('eventType', filters.eventType);
        if (filters.category) params.append('category', filters.category);

        if (compareStaff.length > 0) {
          params.append('compareStaff', compareStaff.join(','));
        }

        const response = await fetch(`/api/changelog/stats?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setChartData(data);
          setPreviousStats(data.previousStats || null);
        }
      } catch (err) {
        console.error('Failed to fetch chart data:', err);
      }
    };

    fetchChartData();
  }, [staffName, isAdmin, staffId, filters, compareStaff]);

  // Helper functions
  const getEventTypeBadge = (eventType: string) => {
    const colors = {
      created: 'bg-green-100 text-green-800 border-green-300',
      updated: 'bg-blue-100 text-blue-800 border-blue-300',
      deleted: 'bg-red-100 text-red-800 border-red-300',
      photo_added: 'bg-purple-100 text-purple-800 border-purple-300',
    };
    return colors[eventType as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getCategoryBadge = (category: string) => {
    const colors = {
      board_game: 'bg-indigo-100 text-indigo-800',
      play_log: 'bg-amber-100 text-amber-800',
      staff_knowledge: 'bg-cyan-100 text-cyan-800',
      content_check: 'bg-emerald-100 text-emerald-800',
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

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

  const handleFilterChange = (key: keyof ChangelogFilters, value: any) => {
    console.log(`[Changelog Page] Filter changed: ${key} = ${value}`);
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value };
      console.log('[Changelog Page] New filters:', newFilters);
      return newFilters;
    });
    setCurrentPage(1);
  };

  const calculateChange = (current: number, previous: number): { value: number; isIncrease: boolean } => {
    if (previous === 0) return { value: current > 0 ? 100 : 0, isIncrease: current > 0 };
    const change = ((current - previous) / previous) * 100;
    return { value: Math.abs(change), isIncrease: change >= 0 };
  };

  const renderStatChange = (current: number, previous: number | null) => {
    if (previous === null) return null;
    const { value, isIncrease } = calculateChange(current, previous);
    return (
      <div className={`flex items-center gap-1 text-xs ${isIncrease ? 'text-green-600' : 'text-red-600'}`}>
        {isIncrease ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        <span>{value.toFixed(1)}%</span>
      </div>
    );
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
                  {previousStats && renderStatChange(stats.totalChanges, previousStats.totalChanges)}
                </div>
                <TrendingUp className="w-8 h-8 text-indigo-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Game Updates</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.gameUpdates}</p>
                  {previousStats && renderStatChange(stats.gameUpdates, previousStats.gameUpdates)}
                </div>
                <Package className="w-8 h-8 text-indigo-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Play Logs</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.playLogsAdded}</p>
                  {previousStats && renderStatChange(stats.playLogsAdded, previousStats.playLogsAdded)}
                </div>
                <Activity className="w-8 h-8 text-amber-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Knowledge</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.knowledgeUpdates}</p>
                  {previousStats && renderStatChange(stats.knowledgeUpdates, previousStats.knowledgeUpdates)}
                </div>
                <Users className="w-8 h-8 text-cyan-600" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Content Checks</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.contentChecks}</p>
                  {previousStats && renderStatChange(stats.contentChecks, previousStats.contentChecks)}
                </div>
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
            </div>
          </div>
        )}

        {/* Compact Insights Cards */}
        {analyticsInsights && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-amber-50 rounded-lg border border-amber-200 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900">Games Needing Attention</h3>
                  <p className="text-2xl font-bold text-amber-600 mt-1">
                    {analyticsInsights.gamesNeedingAttention.count} ({analyticsInsights.gamesNeedingAttention.percentage}%)
                  </p>
                  <p className="text-sm text-gray-600 mt-1">No checks or &gt;6 months</p>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <Package className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900">Underutilized Games</h3>
                  <p className="text-2xl font-bold text-blue-600 mt-1">
                    {analyticsInsights.underutilizedGames.count} ({analyticsInsights.underutilizedGames.percentage}%)
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Never played</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Charts */}
        {chartData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Activity Over Time - Staff Activity */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Staff Activity Over Time</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={compareStaff[0] || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        setCompareStaff(prev => [e.target.value, prev[1]].filter(Boolean));
                      } else {
                        setCompareStaff(prev => [prev[1]].filter(Boolean));
                      }
                    }}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Select first staff member...</option>
                    {staffMembers.map((member) => (
                      <option key={member.id} value={member.id} disabled={compareStaff[1] === member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={compareStaff[1] || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        setCompareStaff(prev => [prev[0], e.target.value].filter(Boolean));
                      } else {
                        setCompareStaff(prev => [prev[0]].filter(Boolean));
                      }
                    }}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Select second staff member (optional)...</option>
                    {staffMembers.map((member) => (
                      <option key={member.id} value={member.id} disabled={compareStaff[0] === member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="h-72">
                {chartData.changesByStaffOverTime && chartData.changesByStaffOverTime.length > 0 ? (
                  <Line
                    data={{
                      labels: Array.from(
                        new Set(chartData.changesByStaffOverTime.map(d => d.date))
                      ).map(date =>
                        new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      ),
                      datasets: Array.from(
                        new Set(chartData.changesByStaffOverTime.map(d => d.staffName))
                      ).map((staffName, index) => {
                        const colors = [
                          { border: 'rgb(99, 102, 241)', bg: 'rgba(99, 102, 241, 0.1)' },
                          { border: 'rgb(34, 197, 94)', bg: 'rgba(34, 197, 94, 0.1)' }
                        ];
                        const color = colors[index] || colors[0];
                        return {
                          label: staffName,
                          data: Array.from(
                            new Set(chartData.changesByStaffOverTime?.map(d => d.date))
                          ).map(date => {
                            const entry = chartData.changesByStaffOverTime?.find(
                              d => d.date === date && d.staffName === staffName
                            );
                            return entry?.totalActions || 0;
                          }),
                          borderColor: color.border,
                          backgroundColor: color.bg,
                          fill: true,
                          tension: 0.4,
                        };
                      })
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'bottom' },
                        tooltip: { mode: 'index', intersect: false },
                      },
                      scales: {
                        y: { beginAtZero: true, ticks: { stepSize: 1 } },
                      },
                    }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    Select at least one staff member to view activity
                  </div>
                )}
              </div>
            </div>

            {/* Staff Knowledge Distribution */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Staff Knowledge Distribution (Weighted by Complexity)</h3>
              <div className="h-72 flex items-center justify-center">
                {chartData.staffKnowledgeCounts && chartData.staffKnowledgeCounts.length > 0 ? (
                  <Doughnut
                    data={{
                      labels: chartData.staffKnowledgeCounts.map(s => s.staffName),
                      datasets: [
                        {
                          data: chartData.staffKnowledgeCounts.map(s => s.knowledgeCount),
                          backgroundColor: [
                            'rgba(99, 102, 241, 0.8)',     // Indigo
                            'rgba(251, 191, 36, 0.8)',     // Amber
                            'rgba(6, 182, 212, 0.8)',      // Cyan
                            'rgba(16, 185, 129, 0.8)',     // Emerald
                            'rgba(239, 68, 68, 0.8)',      // Red
                            'rgba(168, 85, 247, 0.8)',     // Purple
                            'rgba(236, 72, 153, 0.8)',     // Pink
                            'rgba(249, 115, 22, 0.8)',     // Orange
                            'rgba(20, 184, 166, 0.8)',     // Teal
                            'rgba(132, 204, 22, 0.8)',     // Lime
                            'rgba(59, 130, 246, 0.8)',     // Blue
                            'rgba(245, 158, 11, 0.8)',     // Yellow
                          ],
                          borderColor: [
                            'rgb(99, 102, 241)',
                            'rgb(251, 191, 36)',
                            'rgb(6, 182, 212)',
                            'rgb(16, 185, 129)',
                            'rgb(239, 68, 68)',
                            'rgb(168, 85, 247)',
                            'rgb(236, 72, 153)',
                            'rgb(249, 115, 22)',
                            'rgb(20, 184, 166)',
                            'rgb(132, 204, 22)',
                            'rgb(59, 130, 246)',
                            'rgb(245, 158, 11)',
                          ],
                          borderWidth: 2,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'bottom' },
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              const label = context.label || '';
                              const value = context.parsed || 0;
                              const total = (context.dataset.data as number[]).reduce((a: number, b: number) => a + b, 0);
                              const percentage = ((value / total) * 100).toFixed(1);
                              return `${label}: ${value.toFixed(1)} complexity points (${percentage}%)`;
                            }
                          }
                        }
                      },
                    }}
                  />
                ) : (
                  <div className="text-gray-500">No knowledge data available</div>
                )}
              </div>
            </div>

            {/* Weighted Top Contributors */}
            {chartData.weightedContributions && chartData.weightedContributions.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm lg:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Top Contributors</h3>
                  <div className="group relative">
                    <Info className="w-4 h-4 text-gray-400 cursor-help" />
                    <div className="invisible group-hover:visible absolute left-0 top-6 z-10 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                      <p className="font-semibold mb-1">Weighted Scoring:</p>
                      <ul className="space-y-1">
                        <li>• Content Checks: ×3 points</li>
                        <li>• Photo Uploads: ×2 points</li>
                        <li>• Play Logs: ×1 point</li>
                      </ul>
                      <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                    </div>
                  </div>
                </div>
                <div className="h-72">
                  <Bar
                    data={{
                      labels: chartData.weightedContributions.map(s => s.staffName),
                      datasets: [
                        {
                          label: 'Total Score',
                          data: chartData.weightedContributions.map(s => s.totalScore),
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
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              const staff = chartData.weightedContributions?.[context.dataIndex];
                              if (!staff) return '';
                              return [
                                `Score: ${staff.totalScore} points`,
                                `Checks: ${staff.contentChecks} (×3)`,
                                `Photos: ${staff.photos} (×2)`,
                                `Logs: ${staff.playLogs} (×1)`
                              ];
                            }
                          }
                        }
                      },
                      scales: {
                        y: { beginAtZero: true, ticks: { stepSize: 1 } },
                      },
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Additional Insights */}
        {analyticsInsights && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Knowledge Coverage */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <GraduationCap className="w-6 h-6 text-indigo-600" />
                <h3 className="text-lg font-semibold text-gray-900">Knowledge Coverage</h3>
              </div>
              <div className="text-center">
                <p className="text-5xl font-bold text-indigo-600">{analyticsInsights.knowledgeCoverage.percentage}%</p>
                <p className="text-sm text-gray-600 mt-2">
                  {analyticsInsights.knowledgeCoverage.gamesWithKnowledge} of {analyticsInsights.knowledgeCoverage.totalGames} games have staff knowledge
                </p>
                <div className="mt-4 bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${analyticsInsights.knowledgeCoverage.percentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Teaching Capacity */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-6 h-6 text-cyan-600" />
                <h3 className="text-lg font-semibold text-gray-900">Teaching Capacity</h3>
              </div>
              <div className="space-y-3">
                {analyticsInsights.teachingCapacity.slice(0, 5).map((teacher, index) => (
                  <div key={teacher.staffName} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📚'}</span>
                      <span className="font-medium text-gray-900">{teacher.staffName}</span>
                    </div>
                    <span className="text-sm font-semibold text-cyan-600">{teacher.canTeachCount} games</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                onChange={(e) => {
                  const selectedId = e.target.value || null;
                  const selectedMember = staffMembers.find(m => m.id === selectedId);
                  console.log('[Staff Filter] Selected:', { id: selectedId, member: selectedMember });
                  handleFilterChange('staffId', selectedId);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">All Staff</option>
                {staffMembers.length === 0 && (
                  <option disabled>Loading staff...</option>
                )}
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

        {/* Activity Log Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">
              Activity Log ({totalItems} entries)
            </h2>
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

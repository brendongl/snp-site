'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Settings, Save, Users } from 'lucide-react';
import { useAdminMode } from '@/lib/hooks/useAdminMode';

interface PointConfig {
  id: number;
  action_type: string;
  base_points: number;
  uses_complexity: boolean;
  uses_level_multiplier: boolean;
  uses_student_count: boolean;
  description: string;
  updated_at: string;
}

interface StaffMember {
  id: string;
  staff_name: string;
  staff_email: string;
  points: number;
  vikunja_username: string | null;
  updated_at: string;
}

export default function PointsConfigPage() {
  const router = useRouter();
  const isAdmin = useAdminMode();
  const [staffId, setStaffId] = useState<string | null>(null);
  const [configs, setConfigs] = useState<PointConfig[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingStaff, setIsSavingStaff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [staffSuccessMessage, setStaffSuccessMessage] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, number>>({});
  const [editedStaffPoints, setEditedStaffPoints] = useState<Record<string, number>>({});

  // Check authentication and admin access
  useEffect(() => {
    const id = localStorage.getItem('staff_id');
    const staffType = localStorage.getItem('staff_type');

    if (!id) {
      router.push('/auth/signin');
      return;
    }

    if (staffType !== 'Admin') {
      alert('Access denied: Admin access required for points configuration');
      router.push('/games');
      return;
    }

    setStaffId(id);
  }, [router]);

  // Fetch points configuration
  useEffect(() => {
    if (!staffId || !isAdmin) return;

    const fetchConfig = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/admin/points-config');
        if (!response.ok) {
          throw new Error('Failed to fetch points configuration');
        }

        const data = await response.json();
        setConfigs(data.config);

        // Initialize edited values
        const initialValues: Record<string, number> = {};
        data.config.forEach((cfg: PointConfig) => {
          initialValues[cfg.action_type] = cfg.base_points;
        });
        setEditedValues(initialValues);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load configuration');
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, [staffId, isAdmin]);

  // Fetch staff points
  useEffect(() => {
    if (!staffId || !isAdmin) return;

    const fetchStaff = async () => {
      try {
        setIsLoadingStaff(true);
        setStaffError(null);

        const response = await fetch('/api/admin/staff-points-adjustment');
        if (!response.ok) {
          throw new Error('Failed to fetch staff points');
        }

        const data = await response.json();
        setStaffMembers(data.staff);

        // Initialize edited staff points
        const initialPoints: Record<string, number> = {};
        data.staff.forEach((staff: StaffMember) => {
          initialPoints[staff.id] = staff.points || 0;
        });
        setEditedStaffPoints(initialPoints);

      } catch (err) {
        setStaffError(err instanceof Error ? err.message : 'Failed to load staff points');
      } finally {
        setIsLoadingStaff(false);
      }
    };

    fetchStaff();
  }, [staffId, isAdmin]);

  const handleValueChange = (actionType: string, value: number) => {
    setEditedValues(prev => ({
      ...prev,
      [actionType]: value
    }));
  };

  const handleStaffPointsChange = (staffMemberId: string, value: number) => {
    setEditedStaffPoints(prev => ({
      ...prev,
      [staffMemberId]: value
    }));
  };

  const handleSave = async () => {
    if (!staffId) return;

    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      // Find changed values
      const updates = configs
        .filter(cfg => editedValues[cfg.action_type] !== cfg.base_points)
        .map(cfg => ({
          action_type: cfg.action_type,
          base_points: editedValues[cfg.action_type]
        }));

      if (updates.length === 0) {
        setSuccessMessage('No changes to save');
        return;
      }

      const response = await fetch('/api/admin/points-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          updates,
          updatedById: staffId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }

      const data = await response.json();
      setSuccessMessage(`Successfully updated ${data.updated} point configuration(s)`);

      // Refresh configuration
      const refreshResponse = await fetch('/api/admin/points-config');
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setConfigs(refreshData.config);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveStaffPoints = async () => {
    if (!staffId) return;

    try {
      setIsSavingStaff(true);
      setStaffError(null);
      setStaffSuccessMessage(null);

      // Find changed staff points
      const adjustments = staffMembers
        .filter(staff => editedStaffPoints[staff.id] !== staff.points)
        .map(staff => ({
          staffId: staff.id,
          newPoints: editedStaffPoints[staff.id],
          reason: 'Manual adjustment via Points Config'
        }));

      if (adjustments.length === 0) {
        setStaffSuccessMessage('No changes to save');
        return;
      }

      const response = await fetch('/api/admin/staff-points-adjustment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          adjustments,
          adjustedById: staffId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save staff points');
      }

      const data = await response.json();
      setStaffSuccessMessage(`Successfully adjusted ${data.adjusted} staff member(s) points`);

      // Refresh staff points
      const refreshResponse = await fetch('/api/admin/staff-points-adjustment');
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setStaffMembers(refreshData.staff);
        // Update edited points to match new values
        const updatedPoints: Record<string, number> = {};
        refreshData.staff.forEach((staff: StaffMember) => {
          updatedPoints[staff.id] = staff.points || 0;
        });
        setEditedStaffPoints(updatedPoints);
      }

    } catch (err) {
      setStaffError(err instanceof Error ? err.message : 'Failed to save staff points');
    } finally {
      setIsSavingStaff(false);
    }
  };

  const getModifierBadges = (config: PointConfig) => {
    const badges = [];
    if (config.uses_complexity) badges.push('× Complexity');
    if (config.uses_student_count) badges.push('× Students');
    return badges;
  };

  const formatActionType = (actionType: string) => {
    return actionType
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (!staffId || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/staff/changelog"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Changelog</span>
            </Link>
            <div className="h-6 w-px bg-gray-300" />
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Settings className="w-7 h-7 text-indigo-600" />
              Points Configuration
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Configuration Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
            {successMessage}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">Configuration Guide</h2>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Base Points</strong>: The fundamental point value for each action</li>
            <li>• <strong>× Complexity</strong>: Points are multiplied by game complexity (1-5)</li>
            <li>• <strong>× Students</strong>: Points are multiplied by number of students taught</li>
            <li>• Changes take effect immediately and are cached for 5 minutes</li>
          </ul>
        </div>

        {/* Configuration Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-8">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Point Values ({configs.length} configurations)
            </h2>
            <button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading configuration...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action Type
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Base Points
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Modifiers
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {configs.map((config) => (
                    <tr key={config.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-medium text-gray-900">
                          {formatActionType(config.action_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <input
                          type="number"
                          value={editedValues[config.action_type] || 0}
                          onChange={(e) => handleValueChange(config.action_type, parseInt(e.target.value) || 0)}
                          className="w-24 px-3 py-2 border border-gray-300 rounded-md text-right font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          min="0"
                          step="100"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-2">
                          {getModifierBadges(config).map((badge, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                            >
                              {badge}
                            </span>
                          ))}
                          {getModifierBadges(config).length === 0 && (
                            <span className="text-sm text-gray-400">None</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {config.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Staff Points Adjustment Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Staff Points Manual Adjustment ({staffMembers.length} staff)
            </h2>
            <button
              onClick={handleSaveStaffPoints}
              disabled={isSavingStaff || isLoadingStaff}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {isSavingStaff ? 'Saving...' : 'Save Adjustments'}
            </button>
          </div>

          {/* Staff Messages */}
          {staffError && (
            <div className="m-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              {staffError}
            </div>
          )}

          {staffSuccessMessage && (
            <div className="m-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
              {staffSuccessMessage}
            </div>
          )}

          {isLoadingStaff ? (
            <div className="p-8 text-center text-gray-500">Loading staff points...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Staff Member
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Points
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Adjusted Points
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {staffMembers.map((staff) => (
                    <tr key={staff.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-medium text-gray-900">
                          {staff.staff_name}
                        </span>
                        {staff.vikunja_username && (
                          <span className="ml-2 text-xs text-gray-500">
                            @{staff.vikunja_username}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {staff.staff_email}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <span className="font-semibold text-gray-700">
                          {staff.points.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <input
                          type="number"
                          value={editedStaffPoints[staff.id] || 0}
                          onChange={(e) => handleStaffPointsChange(staff.id, parseInt(e.target.value) || 0)}
                          className="w-32 px-3 py-2 border border-gray-300 rounded-md text-right font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          min="0"
                          step="100"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Last Updated Info */}
        {configs.length > 0 && (
          <div className="mt-4 text-sm text-gray-500">
            Configuration last updated: {new Date(configs[0].updated_at).toLocaleString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        )}
      </div>
    </div>
  );
}

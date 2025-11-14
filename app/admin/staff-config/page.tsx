'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Users,
  Save,
  DollarSign,
  Key,
  Shield,
  Edit,
  Check,
  X
} from 'lucide-react';
import { useAdminMode } from '@/lib/hooks/useAdminMode';

interface StaffMember {
  id: string;
  staff_name: string;
  nickname: string | null;
  staff_email: string;
  staff_type: string;
  base_hourly_rate: number | null;
  has_keys: boolean;
  available_roles: string[] | null;
  date_of_hire: string | null;
  created_at: string;
  updated_at: string;
}

const AVAILABLE_ROLES = ['supervisor', 'dealer', 'barista', 'kitchen', 'cleaner'];

export default function StaffConfigPage() {
  const router = useRouter();
  const isAdmin = useAdminMode();
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Edited values
  const [editedPayRates, setEditedPayRates] = useState<Record<string, number>>({});
  const [editedHasKeys, setEditedHasKeys] = useState<Record<string, boolean>>({});
  const [editedRoles, setEditedRoles] = useState<Record<string, string[]>>({});
  const [editedTypes, setEditedTypes] = useState<Record<string, string>>({});

  // Check authentication and admin access
  useEffect(() => {
    const id = localStorage.getItem('staff_id');
    const staffType = localStorage.getItem('staff_type');

    if (!id) {
      router.push('/auth/signin');
      return;
    }

    if (staffType !== 'Admin') {
      alert('Access denied: Admin access required for staff configuration');
      router.push('/games');
      return;
    }

    setStaffId(id);
  }, [router]);

  // Fetch staff configuration
  useEffect(() => {
    if (!staffId || !isAdmin) return;

    fetchStaffConfig();
  }, [staffId, isAdmin]);

  const fetchStaffConfig = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/admin/staff-config');
      if (!response.ok) {
        throw new Error('Failed to fetch staff configuration');
      }

      const data = await response.json();
      setStaffMembers(data.staff);

      // Initialize edited values
      const payRates: Record<string, number> = {};
      const hasKeys: Record<string, boolean> = {};
      const roles: Record<string, string[]> = {};
      const types: Record<string, string> = {};

      data.staff.forEach((staff: StaffMember) => {
        payRates[staff.id] = staff.base_hourly_rate || 0;
        hasKeys[staff.id] = staff.has_keys || false;
        roles[staff.id] = staff.available_roles || [];
        types[staff.id] = staff.staff_type;
      });

      setEditedPayRates(payRates);
      setEditedHasKeys(hasKeys);
      setEditedRoles(roles);
      setEditedTypes(types);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load staff configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (staffMemberId: string) => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      const staff = staffMembers.find(s => s.id === staffMemberId);
      if (!staff) return;

      const updates: any = {};

      if (editedPayRates[staffMemberId] !== staff.base_hourly_rate) {
        updates.base_hourly_rate = editedPayRates[staffMemberId];
      }

      if (editedHasKeys[staffMemberId] !== staff.has_keys) {
        updates.has_keys = editedHasKeys[staffMemberId];
      }

      if (JSON.stringify(editedRoles[staffMemberId]) !== JSON.stringify(staff.available_roles)) {
        updates.available_roles = editedRoles[staffMemberId];
      }

      if (editedTypes[staffMemberId] !== staff.staff_type) {
        updates.staff_type = editedTypes[staffMemberId];
      }

      if (Object.keys(updates).length === 0) {
        setSuccessMessage('No changes to save');
        setEditingStaffId(null);
        return;
      }

      const response = await fetch('/api/admin/staff-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          staff_id: staffMemberId,
          updates
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update staff configuration');
      }

      setSuccessMessage('Staff configuration updated successfully');
      setEditingStaffId(null);
      fetchStaffConfig();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update staff configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRole = (staffMemberId: string, role: string) => {
    setEditedRoles(prev => {
      const currentRoles = prev[staffMemberId] || [];
      if (currentRoles.includes(role)) {
        return { ...prev, [staffMemberId]: currentRoles.filter(r => r !== role) };
      } else {
        return { ...prev, [staffMemberId]: [...currentRoles, role] };
      }
    });
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
              href="/staff/roster/calendar"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Roster Calendar</span>
            </Link>
            <div className="h-6 w-px bg-gray-300" />
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-7 h-7 text-indigo-600" />
              Staff Configuration
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Messages */}
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
            <li>• <strong>Base Hourly Rate</strong>: Default pay rate for regular shifts</li>
            <li>• <strong>Has Keys</strong>: Staff member can open/close the café</li>
            <li>• <strong>Available Roles</strong>: Roles staff member can work (supervisor, dealer, barista, etc.)</li>
            <li>• <strong>Staff Type</strong>: Admin or Staff access level</li>
          </ul>
        </div>

        {/* Staff Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">
              Staff Members ({staffMembers.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading staff configuration...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Staff Member
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center justify-end gap-1">
                        <DollarSign className="w-3 h-3" />
                        Base Rate (₫/hr)
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-1">
                        <Key className="w-3 h-3" />
                        Keys
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Available Roles
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center justify-center gap-1">
                        <Shield className="w-3 h-3" />
                        Type
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {staffMembers.map((staff) => (
                    <tr key={staff.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div>
                          <div className="font-medium text-gray-900">
                            {staff.nickname || staff.staff_name}
                          </div>
                          <div className="text-sm text-gray-500">{staff.staff_email}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        {editingStaffId === staff.id ? (
                          <input
                            type="number"
                            value={editedPayRates[staff.id]}
                            onChange={(e) =>
                              setEditedPayRates({ ...editedPayRates, [staff.id]: parseInt(e.target.value) || 0 })
                            }
                            className="w-32 px-3 py-2 border border-gray-300 rounded-md text-right font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            min="0"
                            step="1000"
                          />
                        ) : (
                          <span className="font-semibold text-gray-900">
                            {staff.base_hourly_rate?.toLocaleString() || '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {editingStaffId === staff.id ? (
                          <button
                            onClick={() =>
                              setEditedHasKeys({ ...editedHasKeys, [staff.id]: !editedHasKeys[staff.id] })
                            }
                            className={`p-2 rounded-md transition-colors ${
                              editedHasKeys[staff.id]
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                          >
                            <Key className="w-4 h-4" />
                          </button>
                        ) : staff.has_keys ? (
                          <Check className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-gray-300 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingStaffId === staff.id ? (
                          <div className="flex flex-wrap gap-2">
                            {AVAILABLE_ROLES.map(role => (
                              <button
                                key={role}
                                onClick={() => toggleRole(staff.id, role)}
                                className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                                  editedRoles[staff.id]?.includes(role)
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                              >
                                {role}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {staff.available_roles && staff.available_roles.length > 0 ? (
                              staff.available_roles.map(role => (
                                <span
                                  key={role}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                                >
                                  {role}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-gray-400">No roles</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {editingStaffId === staff.id ? (
                          <select
                            value={editedTypes[staff.id]}
                            onChange={(e) =>
                              setEditedTypes({ ...editedTypes, [staff.id]: e.target.value })
                            }
                            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          >
                            <option value="Admin">Admin</option>
                            <option value="Staff">Staff</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            staff.staff_type === 'Admin'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {staff.staff_type}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {editingStaffId === staff.id ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleSave(staff.id)}
                              disabled={isSaving}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
                            >
                              <Save className="w-4 h-4" />
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingStaffId(null);
                                // Reset to original values
                                setEditedPayRates(prev => ({ ...prev, [staff.id]: staff.base_hourly_rate || 0 }));
                                setEditedHasKeys(prev => ({ ...prev, [staff.id]: staff.has_keys }));
                                setEditedRoles(prev => ({ ...prev, [staff.id]: staff.available_roles || [] }));
                                setEditedTypes(prev => ({ ...prev, [staff.id]: staff.staff_type }));
                              }}
                              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingStaffId(staff.id)}
                            className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                            title="Edit configuration"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Clock, Settings, RefreshCw, Loader2, Save, DollarSign, Key } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface StaffConfig {
  id: string;
  staff_name: string;
  nickname: string;
  base_hourly_rate: number;
  weekend_multiplier: number;
  holiday_multiplier: number;
  overtime_multiplier: number;
  available_roles: string[];
  has_keys: boolean;
}

const AVAILABLE_ROLES = ['cafe', 'floor', 'supervisor', 'dealer', 'senior', 'barista', 'game master'];

export default function StaffConfigPage() {
  const [staff, setStaff] = useState<StaffConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingStaff, setEditingStaff] = useState<Record<string, Partial<StaffConfig>>>({});

  // Fetch staff configuration
  const fetchStaffConfig = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/roster/staff-config');
      if (!response.ok) throw new Error('Failed to fetch staff configuration');

      const data = await response.json();
      setStaff(data.staff || []);
    } catch (err) {
      console.error('Error fetching staff config:', err);
      setError(err instanceof Error ? err.message : 'Failed to load staff configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffConfig();
  }, []);

  // Handle field change
  const handleFieldChange = (staffId: string, field: keyof StaffConfig, value: any) => {
    setEditingStaff((prev) => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        [field]: value,
      },
    }));
  };

  // Handle role toggle
  const handleRoleToggle = (staffId: string, role: string) => {
    const currentStaff = staff.find((s) => s.id === staffId);
    if (!currentStaff) return;

    const currentRoles = editingStaff[staffId]?.available_roles || currentStaff.available_roles;
    const newRoles = currentRoles.includes(role)
      ? currentRoles.filter((r) => r !== role)
      : [...currentRoles, role];

    handleFieldChange(staffId, 'available_roles', newRoles);
  };

  // Save changes for a staff member
  const handleSave = async (staffId: string) => {
    const changes = editingStaff[staffId];
    if (!changes) return;

    setSaving(staffId);
    try {
      const response = await fetch('/api/roster/staff-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staffId,
          ...changes,
        }),
      });

      if (!response.ok) throw new Error('Failed to save changes');

      // Update local state
      setStaff((prev) =>
        prev.map((s) =>
          s.id === staffId ? { ...s, ...changes } : s
        )
      );

      // Clear editing state
      setEditingStaff((prev) => {
        const newState = { ...prev };
        delete newState[staffId];
        return newState;
      });

      alert('Staff configuration updated successfully!');
    } catch (err) {
      console.error('Error saving staff config:', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  // Check if staff member has unsaved changes
  const hasChanges = (staffId: string) => {
    return !!editingStaff[staffId];
  };

  // Get current value (edited or original)
  const getCurrentValue = (staffId: string, field: keyof StaffConfig) => {
    const currentStaff = staff.find((s) => s.id === staffId);
    if (!currentStaff) return undefined;
    return editingStaff[staffId]?.[field] ?? currentStaff[field];
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Admin Roster Navigation */}
      <div className="flex flex-wrap gap-2 p-4 bg-muted/50 rounded-lg border">
        <Link href="/admin/roster/calendar">
          <Button variant="outline" size="sm" className="gap-2">
            <Calendar className="h-4 w-4" />
            Calendar
          </Button>
        </Link>
        <Link href="/admin/roster/rules">
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            Rules
          </Button>
        </Link>
        <Link href="/admin/roster/clock-records">
          <Button variant="outline" size="sm" className="gap-2">
            <Clock className="h-4 w-4" />
            Clock Records
          </Button>
        </Link>
        <Button variant="default" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Staff Config
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Staff Payroll Configuration</h1>
          <p className="text-muted-foreground">
            Configure hourly rates, multipliers, and roles for staff members
          </p>
        </div>

        <Button variant="outline" onClick={fetchStaffConfig} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Staff Configuration Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pay Rates & Roles
          </CardTitle>
          <CardDescription>
            Edit staff hourly rates, pay multipliers, and available roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {staff.map((member) => (
                <Card key={member.id} className={hasChanges(member.id) ? 'border-yellow-500' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{member.nickname || member.staff_name}</CardTitle>
                        {getCurrentValue(member.id, 'has_keys') && (
                          <Badge variant="secondary" className="gap-1">
                            <Key className="h-3 w-3" />
                            Has Keys
                          </Badge>
                        )}
                      </div>
                      {hasChanges(member.id) && (
                        <Button
                          size="sm"
                          onClick={() => handleSave(member.id)}
                          disabled={saving === member.id}
                        >
                          {saving === member.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          Save Changes
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Pay Rates */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="text-sm font-medium">Base Hourly Rate (VND)</label>
                        <Input
                          type="number"
                          value={(getCurrentValue(member.id, 'base_hourly_rate') as number) || 0}
                          onChange={(e) => handleFieldChange(member.id, 'base_hourly_rate', parseFloat(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Weekend Multiplier</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={(getCurrentValue(member.id, 'weekend_multiplier') as number) || 1.0}
                          onChange={(e) => handleFieldChange(member.id, 'weekend_multiplier', parseFloat(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Holiday Multiplier</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={(getCurrentValue(member.id, 'holiday_multiplier') as number) || 1.0}
                          onChange={(e) => handleFieldChange(member.id, 'holiday_multiplier', parseFloat(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Overtime Multiplier</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={(getCurrentValue(member.id, 'overtime_multiplier') as number) || 1.5}
                          onChange={(e) => handleFieldChange(member.id, 'overtime_multiplier', parseFloat(e.target.value))}
                        />
                      </div>
                    </div>

                    {/* Available Roles */}
                    <div>
                      <label className="text-sm font-medium block mb-2">Available Roles</label>
                      <div className="flex flex-wrap gap-2">
                        {AVAILABLE_ROLES.map((role) => (
                          <label key={role} className="flex items-center gap-2 px-3 py-2 border rounded cursor-pointer hover:bg-accent">
                            <Checkbox
                              checked={(getCurrentValue(member.id, 'available_roles') as string[] || []).includes(role)}
                              onCheckedChange={() => handleRoleToggle(member.id, role)}
                            />
                            <span className="text-sm capitalize">{role}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Has Keys Checkbox */}
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={getCurrentValue(member.id, 'has_keys') as boolean || false}
                        onCheckedChange={(checked) => handleFieldChange(member.id, 'has_keys', checked)}
                      />
                      <label className="text-sm font-medium">
                        Has store keys (can open/close)
                      </label>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShiftAssignment } from './ShiftCard';
import { useState, useEffect } from 'react';
import { Loader2, Info } from 'lucide-react';

interface StaffPreferredTime {
  id: number;
  staff_id: string;
  staff_name: string;
  staff_nickname?: string;
  day_of_week: string;
  hour_start: number;
  hour_end: number;
}

interface ShiftEditDialogProps {
  shift: ShiftAssignment | null;
  open: boolean;
  onClose: () => void;
  onSave: (updatedShift: Partial<ShiftAssignment>) => Promise<void>;
  onDelete?: () => Promise<void>; // Callback after successful delete
  staffMembers?: Array<{ id: string; name: string }>;
}

export function ShiftEditDialog({
  shift,
  open,
  onClose,
  onSave,
  onDelete,
  staffMembers = [],
}: ShiftEditDialogProps) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [role, setRole] = useState('');
  const [preferredTimes, setPreferredTimes] = useState<StaffPreferredTime[]>([]);

  // Initialize form when shift changes
  useEffect(() => {
    if (shift) {
      setStaffId(shift.staff_id);

      // Set default times based on day of week if no scheduled times exist
      const isWeekend = shift.day_of_week === 'Friday' || shift.day_of_week === 'Saturday' || shift.day_of_week === 'Sunday';
      const defaultStart = isWeekend ? '09:30' : '12:30';
      const defaultEnd = '18:00';

      setStartTime(shift.scheduled_start || defaultStart);
      setEndTime(shift.scheduled_end || defaultEnd);
      setRole(shift.role_required || '');
    }
  }, [shift]);

  // Fetch preferred times when staff or day changes
  useEffect(() => {
    const fetchPreferredTimes = async () => {
      if (!staffId || !shift?.day_of_week) return;

      try {
        const response = await fetch(
          `/api/roster/preferred-times?staff_id=${staffId}&day_of_week=${shift.day_of_week}`
        );
        if (response.ok) {
          const data = await response.json();
          setPreferredTimes(data.preferred_times || []);
        }
      } catch (error) {
        console.error('Failed to fetch preferred times:', error);
        setPreferredTimes([]);
      }
    };

    fetchPreferredTimes();
  }, [staffId, shift?.day_of_week]);

  // Format hour to 12-hour time format
  const formatHour = (hour: number): string => {
    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    if (hour < 12) return `${hour}am`;
    return `${hour - 12}pm`;
  };

  const handleSave = async () => {
    if (!shift) return;

    setSaving(true);
    try {
      await onSave({
        staff_id: staffId,
        scheduled_start: startTime,
        scheduled_end: endTime,
        role_required: role,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save shift:', error);
      alert('Failed to save shift. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!shift?.id) return;

    // Confirm deletion
    if (!confirm(`Delete shift for ${shift.staff_name} on ${shift.day_of_week}?`)) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/roster/shifts/${shift.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete shift');
      }

      onClose();
      // Call parent's onDelete callback to refresh data without page reload
      if (onDelete) {
        await onDelete();
      }
    } catch (error) {
      console.error('Failed to delete shift:', error);
      alert('Failed to delete shift. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (!shift) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{shift.id ? 'Edit Shift' : 'Add Shift'}</DialogTitle>
          <DialogDescription>
            {shift.day_of_week} • {shift.staff_name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Staff Member Selection */}
          <div className="grid gap-2">
            <Label htmlFor="staff">Staff Member</Label>
            {staffMembers.length > 0 ? (
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger id="staff">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staffMembers.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="staff"
                value={shift.staff_name}
                disabled
                className="bg-muted"
              />
            )}
          </div>

          {/* Preferred Times Info */}
          {preferredTimes.length > 0 && (
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 p-3 border border-blue-200 dark:border-blue-800">
              <div className="flex gap-2 items-start">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <div className="text-sm space-y-1">
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    Preferred times for {shift.day_of_week}:
                  </p>
                  <div className="text-blue-700 dark:text-blue-300">
                    {preferredTimes.map((pref, idx) => (
                      <div key={idx}>
                        {formatHour(pref.hour_start)} - {formatHour(pref.hour_end)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Start Time */}
          <div className="grid gap-2">
            <Label htmlFor="start-time">Start Time</Label>
            <Input
              id="start-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          {/* End Time */}
          <div className="grid gap-2">
            <Label htmlFor="end-time">End Time</Label>
            <Input
              id="end-time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>

          {/* Role */}
          <div className="grid gap-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="dealer">Dealer</SelectItem>
                <SelectItem value="senior">Senior</SelectItem>
                <SelectItem value="barista">Barista</SelectItem>
                <SelectItem value="game master">Game Master</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          {/* Delete button - only show for existing shifts */}
          {shift.id ? (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving || deleting}
              className="mr-auto"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          ) : (
            <div />
          )}

          {/* Cancel and Save buttons */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving || deleting}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || deleting}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

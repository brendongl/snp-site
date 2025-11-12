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
import { Loader2 } from 'lucide-react';

interface ShiftEditDialogProps {
  shift: ShiftAssignment | null;
  open: boolean;
  onClose: () => void;
  onSave: (updatedShift: Partial<ShiftAssignment>) => Promise<void>;
  staffMembers?: Array<{ id: string; name: string }>;
}

export function ShiftEditDialog({
  shift,
  open,
  onClose,
  onSave,
  staffMembers = [],
}: ShiftEditDialogProps) {
  const [saving, setSaving] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [role, setRole] = useState('');

  // Initialize form when shift changes
  useEffect(() => {
    if (shift) {
      setStaffId(shift.staff_id);
      setStartTime(shift.scheduled_start);
      setEndTime(shift.scheduled_end);
      setRole(shift.role_required);
    }
  }, [shift]);

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

  if (!shift) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Shift</DialogTitle>
          <DialogDescription>
            {shift.day_of_week} • {shift.shift_type}
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
                <SelectItem value="cafe">Cafe</SelectItem>
                <SelectItem value="floor">Floor</SelectItem>
                <SelectItem value="opening">Opening</SelectItem>
                <SelectItem value="closing">Closing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

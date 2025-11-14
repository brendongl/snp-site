'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Clock, RefreshCw, Loader2, Plus, Calendar, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';

interface Shift {
  id: string;
  roster_week_start: string;
  day_of_week: string;
  scheduled_start: string;
  scheduled_end: string;
  role_required: string;
  shift_type: string;
}

interface StaffMember {
  id: string;
  name: string;
  nickname: string;
}

interface ShiftSwap {
  id: string;
  shift_id: string;
  requesting_staff_id: string;
  target_staff_id: string;
  status: 'pending' | 'auto_approved' | 'admin_approved' | 'vetoed';
  reason?: string;
  requested_at: string;
  resolved_at?: string;
  notes?: string;
}

export default function ShiftSwapPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [swaps, setSwaps] = useState<ShiftSwap[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [targetStaffId, setTargetStaffId] = useState<string>('');
  const [reason, setReason] = useState('');

  // Get staff ID from localStorage
  const staffId = typeof window !== 'undefined' ? localStorage.getItem('staff_id') : null;

  // Fetch data
  const fetchData = async () => {
    if (!staffId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch shifts
      const shiftsResponse = await fetch(`/api/roster/shifts?staff_id=${staffId}`);
      if (shiftsResponse.ok) {
        const shiftsData = await shiftsResponse.json();
        setShifts(shiftsData.shifts || []);
      }

      // Fetch staff list
      const staffResponse = await fetch('/api/staff-list');
      if (staffResponse.ok) {
        const staffData = await staffResponse.json();
        setStaff((staffData.staff || []).filter((s: any) => s.id !== staffId));
      }

      // Fetch existing swap requests
      const swapsResponse = await fetch(`/api/roster/shift-swap?staff_id=${staffId}`);
      if (swapsResponse.ok) {
        const swapsData = await swapsResponse.json();
        setSwaps(swapsData.swaps || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (staffId) {
      fetchData();
    } else {
      setError('Please log in to view shift swaps');
    }
  }, [staffId]);

  // Open dialog for new request
  const handleRequestClick = () => {
    setSelectedShiftId('');
    setTargetStaffId('');
    setReason('');
    setDialogOpen(true);
  };

  // Submit shift swap request
  const handleSubmit = async () => {
    if (!staffId || !selectedShiftId || !targetStaffId) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/roster/shift-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_id: selectedShiftId,
          requesting_staff_id: staffId,
          target_staff_id: targetStaffId,
          reason,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create shift swap request');
      }

      // Close dialog and refresh
      setDialogOpen(false);
      await fetchData();
      alert('Shift swap request submitted successfully!');
    } catch (err) {
      console.error('Error creating shift swap:', err);
      alert(err instanceof Error ? err.message : 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Get shift details
  const getShiftDetails = (shiftId: string) => {
    return shifts.find((s) => s.id === shiftId);
  };

  // Get staff name
  const getStaffName = (staffId: string) => {
    const member = staff.find((s) => s.id === staffId);
    return member?.nickname || member?.name || 'Unknown';
  };

  // Format time
  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5); // HH:MM
  };

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><AlertCircle className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'auto_approved':
      case 'admin_approved':
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'vetoed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Vetoed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Filter upcoming shifts (not in the past)
  const upcomingShifts = shifts.filter((shift) => {
    const shiftDate = new Date(`${shift.roster_week_start}T${shift.scheduled_start}`);
    return shiftDate >= new Date();
  });

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Shift Swap Requests</h1>
          <p className="text-muted-foreground">
            Request to swap shifts with your colleagues
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button onClick={handleRequestClick} disabled={upcomingShifts.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Shifts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Your Upcoming Shifts ({upcomingShifts.length})
          </CardTitle>
          <CardDescription>
            Shifts you can request to swap
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : upcomingShifts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No upcoming shifts scheduled</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingShifts.map((shift) => (
                <div key={shift.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">{shift.day_of_week}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatTime(shift.scheduled_start)} - {formatTime(shift.scheduled_end)} • {shift.role_required}
                    </div>
                  </div>
                  <Badge variant="outline">{shift.shift_type}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Swap Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Your Swap Requests ({swaps.length})</CardTitle>
          <CardDescription>
            View the status of your shift swap requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : swaps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No swap requests yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {swaps.map((swap) => {
                const shift = getShiftDetails(swap.shift_id);
                return (
                  <Card key={swap.id} className="border">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-medium">
                            Swap with {getStaffName(swap.target_staff_id)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Requested {formatDate(swap.requested_at)}
                          </div>
                        </div>
                        {getStatusBadge(swap.status)}
                      </div>

                      {shift && (
                        <div className="text-sm mb-2 p-2 bg-muted/50 rounded">
                          <div className="font-medium">{shift.day_of_week}</div>
                          <div className="text-muted-foreground">
                            {formatTime(shift.scheduled_start)} - {formatTime(shift.scheduled_end)} • {shift.role_required}
                          </div>
                        </div>
                      )}

                      {swap.reason && (
                        <div className="text-sm mb-2">
                          <span className="font-medium">Reason:</span> {swap.reason}
                        </div>
                      )}

                      {swap.notes && (
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Admin notes:</span> {swap.notes}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Shift Swap</DialogTitle>
            <DialogDescription>
              Select a shift and colleague to request a swap
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Shift</label>
              <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a shift..." />
                </SelectTrigger>
                <SelectContent>
                  {upcomingShifts.map((shift) => (
                    <SelectItem key={shift.id} value={shift.id}>
                      {shift.day_of_week} • {formatTime(shift.scheduled_start)}-{formatTime(shift.scheduled_end)} • {shift.role_required}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Swap With</label>
              <Select value={targetStaffId} onValueChange={setTargetStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a colleague..." />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.nickname || member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Reason (Optional)</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why you need this swap..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !selectedShiftId || !targetStaffId}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>Submit Request</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

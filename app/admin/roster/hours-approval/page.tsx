'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Clock, Settings, RefreshCw, Loader2, CheckCircle2, AlertCircle, MapPin } from 'lucide-react';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import Link from 'next/link';

interface ClockRecord {
  id: string;
  staff_id: string;
  staff_name: string;
  shift_id: string | null;
  clock_in_time: string;
  clock_out_time: string | null;
  clock_in_location: any;
  clock_out_location: any;
  rostered_start: string | null;
  rostered_end: string | null;
  day_of_week: string | null;
  variance_reason: string | null;
  requires_approval: boolean;
  actual_hours: number | null;
  rostered_hours: number | null;
  variance_hours: number | null;
}

export default function HoursApprovalPage() {
  const [records, setRecords] = useState<ClockRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Approval dialog state
  const [approvingRecord, setApprovingRecord] = useState<ClockRecord | null>(null);
  const [approvalHours, setApprovalHours] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch pending approval records
  const fetchPendingRecords = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/roster/clock-records?requires_approval=true');
      if (!response.ok) throw new Error('Failed to fetch pending records');

      const data = await response.json();
      setRecords(data.records || []);
    } catch (err) {
      console.error('Error fetching pending records:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pending records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingRecords();
  }, []);

  // Open approval dialog
  const handleApproveClick = (record: ClockRecord) => {
    setApprovingRecord(record);
    setApprovalHours(record.actual_hours?.toFixed(2) || '');
    setApprovalNotes(record.variance_reason || '');
  };

  // Submit approval
  const handleSubmitApproval = async () => {
    if (!approvingRecord) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/roster/clock-records/${approvingRecord.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved_hours: parseFloat(approvalHours),
          approved_by: 'admin', // TODO: Get from auth
          notes: approvalNotes,
        }),
      });

      if (!response.ok) throw new Error('Failed to approve record');

      // Close dialog and refresh
      setApprovingRecord(null);
      setApprovalHours('');
      setApprovalNotes('');
      await fetchPendingRecords();

      alert('Record approved successfully!');
    } catch (err) {
      console.error('Error approving record:', err);
      alert('Failed to approve record. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Format time for display
  const formatTime = (isoString: string) => {
    return format(new Date(isoString), 'MMM d, yyyy h:mm a');
  };

  // Format duration
  const formatDuration = (hours: number | null) => {
    if (hours === null) return '-';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  // Get reason for approval requirement
  const getApprovalReason = (record: ClockRecord) => {
    if (!record.clock_out_time) return 'Missing clock-out';
    if (!record.shift_id) return 'Unscheduled shift';
    if (record.variance_hours && Math.abs(record.variance_hours) > 0.25) {
      return `Variance: ${record.variance_hours > 0 ? '+' : ''}${formatDuration(record.variance_hours)}`;
    }
    return 'Manual review required';
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
        <Link href="/admin/roster/staff-config">
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            Staff Config
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Hours Approval Queue</h1>
          <p className="text-muted-foreground">
            Review and approve clock records requiring manual verification
          </p>
        </div>

        <Button variant="outline" onClick={fetchPendingRecords} disabled={loading}>
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

      {/* Pending Records */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            Pending Approvals ({records.length})
          </CardTitle>
          <CardDescription>
            Clock records requiring manual review and approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-600" />
              <p>All caught up! No records pending approval.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {records.map((record) => (
                <Card key={record.id} className="border-yellow-500">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{record.staff_name}</CardTitle>
                        <CardDescription>
                          {record.day_of_week && `${record.day_of_week} • `}
                          {formatTime(record.clock_in_time)}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                        {getApprovalReason(record)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Time Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Clock In</div>
                        <div className="font-medium">{formatTime(record.clock_in_time)}</div>
                        {record.clock_in_location && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            Location recorded
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-muted-foreground">Clock Out</div>
                        {record.clock_out_time ? (
                          <>
                            <div className="font-medium">{formatTime(record.clock_out_time)}</div>
                            {record.clock_out_location && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                Location recorded
                              </div>
                            )}
                          </>
                        ) : (
                          <Badge variant="destructive">Missing</Badge>
                        )}
                      </div>
                      <div>
                        <div className="text-muted-foreground">Rostered Hours</div>
                        <div className="font-medium">
                          {record.rostered_start && record.rostered_end ? (
                            <>
                              {record.rostered_start} - {record.rostered_end}
                              <div className="text-xs">{formatDuration(record.rostered_hours)}</div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Unscheduled</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Actual Hours</div>
                        <div className="font-medium">{formatDuration(record.actual_hours)}</div>
                        {record.variance_hours !== null && (
                          <div className="text-xs text-yellow-600">
                            Variance: {record.variance_hours > 0 ? '+' : ''}
                            {formatDuration(record.variance_hours)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Reason */}
                    {record.variance_reason && (
                      <div className="bg-muted p-3 rounded">
                        <div className="text-sm font-medium mb-1">Staff Note:</div>
                        <div className="text-sm">{record.variance_reason}</div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApproveClick(record)}
                        className="gap-2"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={!!approvingRecord} onOpenChange={() => setApprovingRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Hours</DialogTitle>
            <DialogDescription>
              Review and approve hours for {approvingRecord?.staff_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Approved Hours</label>
              <Input
                type="number"
                step="0.25"
                value={approvalHours}
                onChange={(e) => setApprovalHours(e.target.value)}
                placeholder="e.g., 8.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Actual: {formatDuration(approvingRecord?.actual_hours || null)}
                {approvingRecord?.rostered_hours && (
                  <> • Rostered: {formatDuration(approvingRecord.rostered_hours)}</>
                )}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Admin Notes (optional)</label>
              <Textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Add any notes about this approval..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApprovingRecord(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitApproval} disabled={submitting || !approvalHours}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve Hours
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

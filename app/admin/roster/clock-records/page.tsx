'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, CheckCircle2, XCircle, AlertCircle, RefreshCw, Loader2, Filter, Settings, Calendar as CalendarIcon } from 'lucide-react';
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
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  approved_hours: number | null;
  points_awarded: number;
  created_at: string;
  actual_hours: number | null;
  rostered_hours: number | null;
  variance_hours: number | null;
}

export default function ClockRecordsPage() {
  const [records, setRecords] = useState<ClockRecord[]>([]);
  const [staffMembers, setStaffMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [approvalFilter, setApprovalFilter] = useState<string>('all');
  const [showMissingClockOut, setShowMissingClockOut] = useState(false);

  // Fetch staff list
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const response = await fetch('/api/staff-list');
        if (!response.ok) throw new Error('Failed to fetch staff');
        const data = await response.json();
        const staff = (data.staff || []).map((s: any) => ({
          id: s.id,
          name: s.nickname || s.name,
        }));
        setStaffMembers(staff);
      } catch (err) {
        console.error('Error fetching staff:', err);
      }
    };
    fetchStaff();
  }, []);

  // Fetch clock records
  const fetchRecords = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedStaff !== 'all') params.append('staff_id', selectedStaff);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (approvalFilter === 'pending') params.append('requires_approval', 'true');
      if (approvalFilter === 'approved') params.append('requires_approval', 'false');
      if (showMissingClockOut) params.append('missing_clock_out', 'true');

      const response = await fetch(`/api/roster/clock-records?${params}`);
      if (!response.ok) throw new Error('Failed to fetch clock records');

      const data = await response.json();
      setRecords(data.records || []);
    } catch (err) {
      console.error('Error fetching clock records:', err);
      setError(err instanceof Error ? err.message : 'Failed to load clock records');
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and filter change
  useEffect(() => {
    fetchRecords();
  }, [selectedStaff, startDate, endDate, approvalFilter, showMissingClockOut]);

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

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Admin Roster Navigation */}
      <div className="flex flex-wrap gap-2 p-4 bg-muted/50 rounded-lg border">
        <Link href="/admin/roster/calendar">
          <Button variant="outline" size="sm" className="gap-2">
            <CalendarIcon className="h-4 w-4" />
            Calendar
          </Button>
        </Link>
        <Link href="/admin/roster/rules">
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            Rules
          </Button>
        </Link>
        <Button variant="default" size="sm" className="gap-2">
          <Clock className="h-4 w-4" />
          Clock Records
        </Button>
        <Button variant="outline" size="sm" className="gap-2" disabled title="Coming soon">
          <Settings className="h-4 w-4" />
          Staff Config
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clock Records</h1>
          <p className="text-muted-foreground">
            View and approve staff clock-in/out records
          </p>
        </div>

        <Button variant="outline" onClick={fetchRecords} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="text-sm font-medium">Staff Member</label>
            <Select value={selectedStaff} onValueChange={setSelectedStaff}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                {staffMembers.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {staff.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">End Date</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Approval Status</label>
            <Select value={approvalFilter} onValueChange={setApprovalFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Records</SelectItem>
                <SelectItem value="pending">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              variant={showMissingClockOut ? 'default' : 'outline'}
              onClick={() => setShowMissingClockOut(!showMissingClockOut)}
              className="w-full"
            >
              <AlertCircle className="mr-2 h-4 w-4" />
              Missing Clock-Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Clock Records ({records.length})</CardTitle>
          <CardDescription>
            {approvalFilter === 'pending' && 'Showing records requiring approval'}
            {approvalFilter === 'approved' && 'Showing approved records'}
            {approvalFilter === 'all' && 'Showing all clock records'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No clock records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Staff</th>
                    <th className="text-left p-2">Clock In</th>
                    <th className="text-left p-2">Clock Out</th>
                    <th className="text-left p-2">Rostered</th>
                    <th className="text-left p-2">Actual</th>
                    <th className="text-left p-2">Variance</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b hover:bg-accent/50">
                      <td className="p-2">
                        <div className="font-medium">{record.staff_name}</div>
                        {record.day_of_week && (
                          <div className="text-xs text-muted-foreground">
                            {record.day_of_week}
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="text-sm">{formatTime(record.clock_in_time)}</div>
                        {record.clock_in_location && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            Location recorded
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        {record.clock_out_time ? (
                          <>
                            <div className="text-sm">{formatTime(record.clock_out_time)}</div>
                            {record.clock_out_location && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                Location recorded
                              </div>
                            )}
                          </>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Missing
                          </Badge>
                        )}
                      </td>
                      <td className="p-2">
                        {record.rostered_start && record.rostered_end ? (
                          <>
                            <div className="text-sm">
                              {record.rostered_start} - {record.rostered_end}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDuration(record.rostered_hours)}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Unscheduled</span>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="font-medium">
                          {formatDuration(record.actual_hours)}
                        </div>
                      </td>
                      <td className="p-2">
                        {record.variance_hours !== null && (
                          <div className={`flex items-center gap-1 ${
                            Math.abs(record.variance_hours) > 0.25
                              ? 'text-yellow-600 dark:text-yellow-500'
                              : 'text-green-600 dark:text-green-500'
                          }`}>
                            {record.variance_hours > 0 ? '+' : ''}
                            {formatDuration(record.variance_hours)}
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        {record.requires_approval ? (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        ) : record.approved_by ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Approved
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            Auto-approved
                          </Badge>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{record.points_awarded}</span>
                          <span className="text-xs text-muted-foreground">pts</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Card */}
      {records.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-2xl font-bold">{records.length}</div>
              <div className="text-sm text-muted-foreground">Total Records</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {records.filter(r => r.requires_approval).length}
              </div>
              <div className="text-sm text-muted-foreground">Pending Approval</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {records.filter(r => !r.clock_out_time).length}
              </div>
              <div className="text-sm text-muted-foreground">Missing Clock-Out</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {records.reduce((sum, r) => sum + r.points_awarded, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Total Points Awarded</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

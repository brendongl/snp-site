'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Clock, Calendar, Award, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface HoursRecord {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  day_of_week: string;
  approved_hours: number;
  base_rate: number;
  pay_multiplier: number;
  pay_category: string;
  total_pay: number;
  points_awarded: number;
}

interface HoursSummary {
  total_hours: number;
  total_pay: number;
  pay_breakdown: {
    base: number;
    weekend: number;
    holiday: number;
    overtime: number;
  };
  total_points: number;
}

export default function MyHoursPage() {
  const [records, setRecords] = useState<HoursRecord[]>([]);
  const [summary, setSummary] = useState<HoursSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date filters
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // First day of current month
    return format(date, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(() => {
    return format(new Date(), 'yyyy-MM-dd');
  });

  // Fetch hours summary
  const fetchHoursSummary = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get staff ID from localStorage (from staff login)
      const staffId = localStorage.getItem('staff_id');
      if (!staffId) {
        throw new Error('Please log in to view your hours');
      }

      const params = new URLSearchParams({
        staff_id: staffId,
        start_date: startDate,
        end_date: endDate,
      });

      const response = await fetch(`/api/roster/my-hours?${params}`);
      if (!response.ok) throw new Error('Failed to fetch hours summary');

      const data = await response.json();
      setRecords(data.records || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error('Error fetching hours:', err);
      setError(err instanceof Error ? err.message : 'Failed to load hours summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHoursSummary();
  }, [startDate, endDate]);

  // Format currency (VND)
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace(/,/g, '.') + ' VND';
  };

  // Format duration
  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  // Format time
  const formatTime = (isoString: string) => {
    return format(new Date(isoString), 'MMM d, h:mm a');
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Hours & Pay</h1>
          <p className="text-muted-foreground">
            View your work hours, pay breakdown, and points earned
          </p>
        </div>

        <Button variant="outline" onClick={fetchHoursSummary} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Date Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Date Range
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Total Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(summary.total_hours)}</div>
              <p className="text-xs text-muted-foreground">Approved work hours</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Pay
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.total_pay)}</div>
              <p className="text-xs text-muted-foreground">Gross earnings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Avg Hourly Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.total_hours > 0 ? summary.total_pay / summary.total_hours : 0)}
              </div>
              <p className="text-xs text-muted-foreground">Including multipliers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Award className="h-4 w-4" />
                Points Earned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_points}</div>
              <p className="text-xs text-muted-foreground">Punctuality & performance</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pay Breakdown */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Pay Breakdown</CardTitle>
            <CardDescription>Your earnings by category</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Base Pay</div>
              <div className="text-lg font-semibold">{formatCurrency(summary.pay_breakdown.base)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Weekend Pay</div>
              <div className="text-lg font-semibold">{formatCurrency(summary.pay_breakdown.weekend)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Holiday Pay</div>
              <div className="text-lg font-semibold">{formatCurrency(summary.pay_breakdown.holiday)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Overtime Pay</div>
              <div className="text-lg font-semibold">{formatCurrency(summary.pay_breakdown.overtime)}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hours History */}
      <Card>
        <CardHeader>
          <CardTitle>Hours History ({records.length})</CardTitle>
          <CardDescription>Your approved work sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No approved hours found for this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Day</th>
                    <th className="text-left p-2">Clock In</th>
                    <th className="text-left p-2">Clock Out</th>
                    <th className="text-left p-2">Hours</th>
                    <th className="text-left p-2">Category</th>
                    <th className="text-left p-2">Pay</th>
                    <th className="text-left p-2">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b hover:bg-accent/50">
                      <td className="p-2">
                        <div className="font-medium">
                          {format(new Date(record.clock_in_time), 'MMM d, yyyy')}
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="text-sm">{record.day_of_week}</div>
                      </td>
                      <td className="p-2">
                        <div className="text-sm">{formatTime(record.clock_in_time)}</div>
                      </td>
                      <td className="p-2">
                        <div className="text-sm">
                          {record.clock_out_time ? formatTime(record.clock_out_time) : '-'}
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="font-medium">{formatDuration(record.approved_hours)}</div>
                      </td>
                      <td className="p-2">
                        <Badge
                          variant={
                            record.pay_category === 'overtime' ? 'default' :
                            record.pay_category === 'weekend' ? 'secondary' :
                            record.pay_category === 'holiday' ? 'destructive' :
                            'outline'
                          }
                          className="capitalize"
                        >
                          {record.pay_category}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <div className="font-medium">{formatCurrency(record.total_pay)}</div>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <Award className="h-4 w-4 text-yellow-600" />
                          <span className="font-medium">{record.points_awarded}</span>
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
    </div>
  );
}

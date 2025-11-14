'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Clock, CheckCircle, AlertCircle, Trophy } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ClockStatus {
  isClockedIn: boolean;
  activeClockRecord: {
    id: string;
    clock_in_time: string;
    rostered_start: string | null;
    rostered_end: string | null;
  } | null;
  upcomingShift: {
    id: string;
    scheduled_start: string;
    scheduled_end: string;
  } | null;
}

interface ClockResponse {
  success: boolean;
  clock_record: any;
  variance_minutes: number;
  points_awarded: number;
  requires_approval?: boolean;
  reminders?: any[];
  prompt?: {
    type: string;
    message: string;
  };
}

export default function ClockInPage() {
  const [staffId, setStaffId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<ClockStatus | null>(null);
  const [lastAction, setLastAction] = useState<ClockResponse | null>(null);
  const [reason, setReason] = useState('');
  const [showReasonPrompt, setShowReasonPrompt] = useState(false);

  // Get staff ID from localStorage
  useEffect(() => {
    const storedStaffId = localStorage.getItem('staff_id');
    if (storedStaffId) {
      setStaffId(storedStaffId);
      loadClockStatus(storedStaffId);
    } else {
      setLoading(false);
    }
  }, []);

  // Load current clock status
  const loadClockStatus = async (staffId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/clock-in?staff_id=${staffId}`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Error loading clock status:', error);
    } finally {
      setLoading(false);
    }
  };

  // Clock in
  const handleClockIn = async () => {
    if (!staffId) return;

    setProcessing(true);
    setLastAction(null);
    try {
      const response = await fetch('/api/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clock_in',
          staff_id: staffId,
          location: 'Web App'
        })
      });

      if (response.ok) {
        const data: ClockResponse = await response.json();
        setLastAction(data);

        // Reload status
        await loadClockStatus(staffId);
      } else {
        const error = await response.json();
        alert(`Failed to clock in: ${error.error}`);
      }
    } catch (error) {
      console.error('Error clocking in:', error);
      alert('Failed to clock in');
    } finally {
      setProcessing(false);
    }
  };

  // Clock out
  const handleClockOut = async () => {
    if (!staffId) return;

    // Check if we need a reason (if they're clocking out significantly early/late)
    if (status?.activeClockRecord?.rostered_end) {
      const now = new Date();
      const rostered = new Date();
      const [hours, minutes] = status.activeClockRecord.rostered_end.split(':').map(Number);
      rostered.setHours(hours, minutes, 0, 0);
      const varianceMinutes = Math.round((now.getTime() - rostered.getTime()) / (1000 * 60));

      if (Math.abs(varianceMinutes) > 15 && !reason.trim() && !showReasonPrompt) {
        setShowReasonPrompt(true);
        return;
      }
    }

    setProcessing(true);
    setLastAction(null);
    try {
      const response = await fetch('/api/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clock_out',
          staff_id: staffId,
          location: 'Web App',
          reason: reason.trim() || null
        })
      });

      if (response.ok) {
        const data: ClockResponse = await response.json();
        setLastAction(data);
        setShowReasonPrompt(false);
        setReason('');

        // Reload status
        await loadClockStatus(staffId);
      } else {
        const error = await response.json();
        alert(`Failed to clock out: ${error.error}`);
      }
    } catch (error) {
      console.error('Error clocking out:', error);
      alert('Failed to clock out');
    } finally {
      setProcessing(false);
    }
  };

  // Format time for display
  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Format duration
  const formatDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // Get prompt type icon and color
  const getPromptDisplay = (type: string) => {
    switch (type) {
      case 'early':
        return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/20', border: 'border-green-500' };
      case 'on_time':
        return { icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-500' };
      case 'late_warning':
        return { icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/20', border: 'border-yellow-500' };
      case 'late_explanation_required':
        return { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20', border: 'border-red-500' };
      default:
        return { icon: CheckCircle, color: 'text-gray-600', bg: 'bg-gray-50 dark:bg-gray-950/20', border: 'border-gray-500' };
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!staffId) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please log in to clock in/out
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Clock In/Out</h1>
        <p className="text-muted-foreground">
          Manage your shift attendance
        </p>
      </div>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Current Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.isClockedIn ? (
            <>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                <span className="font-semibold text-lg">Clocked In</span>
              </div>

              {status.activeClockRecord && (
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Clock In Time:</span>{' '}
                    {formatTime(status.activeClockRecord.clock_in_time)}
                  </p>
                  <p>
                    <span className="font-medium">Duration:</span>{' '}
                    {formatDuration(status.activeClockRecord.clock_in_time)}
                  </p>
                  {status.activeClockRecord.rostered_start && (
                    <p>
                      <span className="font-medium">Scheduled:</span>{' '}
                      {status.activeClockRecord.rostered_start} - {status.activeClockRecord.rostered_end}
                    </p>
                  )}
                </div>
              )}

              {!showReasonPrompt ? (
                <Button
                  onClick={handleClockOut}
                  disabled={processing}
                  className="w-full sm:w-auto"
                  variant="destructive"
                >
                  {processing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Clocking Out...
                    </>
                  ) : (
                    <>
                      <Clock className="mr-2 h-4 w-4" />
                      Clock Out
                    </>
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="reason">
                      Reason for Early/Late Clock Out (Required)
                    </Label>
                    <Textarea
                      id="reason"
                      placeholder="Please explain why you're clocking out significantly early or late..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleClockOut}
                      disabled={processing || !reason.trim()}
                      variant="destructive"
                    >
                      {processing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit & Clock Out'
                      )}
                    </Button>
                    <Button
                      onClick={() => {
                        setShowReasonPrompt(false);
                        setReason('');
                      }}
                      variant="outline"
                      disabled={processing}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-gray-400" />
                <span className="font-semibold text-lg">Not Clocked In</span>
              </div>

              {status?.upcomingShift && (
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Upcoming Shift:</span>{' '}
                    {status.upcomingShift.scheduled_start} - {status.upcomingShift.scheduled_end}
                  </p>
                </div>
              )}

              <Button
                onClick={handleClockIn}
                disabled={processing}
                className="w-full sm:w-auto"
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Clocking In...
                  </>
                ) : (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Clock In
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Last Action Result */}
      {lastAction && lastAction.prompt && (
        <Card className={`${getPromptDisplay(lastAction.prompt.type).bg} ${getPromptDisplay(lastAction.prompt.type).border} border`}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              {(() => {
                const Icon = getPromptDisplay(lastAction.prompt.type).icon;
                return <Icon className={`h-5 w-5 ${getPromptDisplay(lastAction.prompt.type).color} mt-0.5`} />;
              })()}
              <div className="flex-1 space-y-2">
                <p className={`font-medium ${getPromptDisplay(lastAction.prompt.type).color}`}>
                  {lastAction.prompt.message}
                </p>
                {lastAction.points_awarded !== 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Trophy className="h-4 w-4" />
                    <span>
                      {lastAction.points_awarded > 0 ? '+' : ''}{lastAction.points_awarded} points
                    </span>
                  </div>
                )}
                {lastAction.requires_approval && (
                  <p className="text-sm text-muted-foreground">
                    This clock out requires manager approval due to significant variance.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
          <CardDescription>
            Clock in/out system with points rewards
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-medium text-green-600">Early (5-15 min): +50 points</p>
            <p className="text-muted-foreground">Arrive 5-15 minutes before your shift</p>
          </div>
          <div>
            <p className="font-medium text-blue-600">On-time (±5 min): +20 points</p>
            <p className="text-muted-foreground">Arrive within 5 minutes of scheduled time</p>
          </div>
          <div>
            <p className="font-medium text-yellow-600">Late (5-15 min): Warning first time, -50 points after</p>
            <p className="text-muted-foreground">First late arrival is a warning</p>
          </div>
          <div>
            <p className="font-medium text-red-600">Late (15+ min): -100 points</p>
            <p className="text-muted-foreground">Significantly late requires explanation</p>
          </div>
          <div className="pt-2 border-t">
            <p className="text-muted-foreground">
              Clock outs more than 15 minutes early or late require manager approval.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

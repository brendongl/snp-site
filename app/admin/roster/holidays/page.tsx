'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Clock, Settings, RefreshCw, Loader2, Plus, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';

interface Holiday {
  id: string;
  holiday_name: string;
  start_date: string;
  end_date: string;
  pay_multiplier: number;
  is_recurring: boolean;
  created_at?: string;
  updated_at?: string;
}

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    holiday_name: '',
    start_date: '',
    end_date: '',
    pay_multiplier: '2.0',
    is_recurring: false,
  });

  // Fetch holidays
  const fetchHolidays = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/roster/holidays');
      if (!response.ok) throw new Error('Failed to fetch holidays');

      const data = await response.json();
      setHolidays(data.holidays || []);
    } catch (err) {
      console.error('Error fetching holidays:', err);
      setError(err instanceof Error ? err.message : 'Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  // Open dialog for new holiday
  const handleAddClick = () => {
    setEditingHoliday(null);
    setFormData({
      holiday_name: '',
      start_date: '',
      end_date: '',
      pay_multiplier: '2.0',
      is_recurring: false,
    });
    setDialogOpen(true);
  };

  // Open dialog for editing
  const handleEditClick = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      holiday_name: holiday.holiday_name,
      start_date: holiday.start_date,
      end_date: holiday.end_date,
      pay_multiplier: holiday.pay_multiplier.toString(),
      is_recurring: holiday.is_recurring,
    });
    setDialogOpen(true);
  };

  // Submit form (create or update)
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        pay_multiplier: parseFloat(formData.pay_multiplier),
      };

      if (editingHoliday) {
        // Update existing holiday
        const response = await fetch('/api/roster/holidays', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingHoliday.id,
            ...payload,
          }),
        });

        if (!response.ok) throw new Error('Failed to update holiday');
      } else {
        // Create new holiday
        const response = await fetch('/api/roster/holidays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error('Failed to create holiday');
      }

      // Close dialog and refresh
      setDialogOpen(false);
      await fetchHolidays();
      alert(editingHoliday ? 'Holiday updated successfully!' : 'Holiday created successfully!');
    } catch (err) {
      console.error('Error saving holiday:', err);
      alert('Failed to save holiday. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete holiday
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const response = await fetch(`/api/roster/holidays?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete holiday');

      await fetchHolidays();
      alert('Holiday deleted successfully!');
    } catch (err) {
      console.error('Error deleting holiday:', err);
      alert('Failed to delete holiday. Please try again.');
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM d, yyyy');
    } catch {
      return dateString;
    }
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
        <Button variant="default" size="sm" className="gap-2">
          <Calendar className="h-4 w-4" />
          Holidays
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Holiday Management</h1>
          <p className="text-muted-foreground">
            Configure public holidays with special pay multipliers
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchHolidays} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button onClick={handleAddClick}>
            <Plus className="mr-2 h-4 w-4" />
            Add Holiday
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

      {/* Holidays List */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Holidays ({holidays.length})</CardTitle>
          <CardDescription>
            Holidays automatically apply pay multipliers to shifts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : holidays.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No holidays configured yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Holiday Name</th>
                    <th className="text-left p-2">Start Date</th>
                    <th className="text-left p-2">End Date</th>
                    <th className="text-left p-2">Pay Multiplier</th>
                    <th className="text-left p-2">Recurring</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((holiday) => (
                    <tr key={holiday.id} className="border-b hover:bg-accent/50">
                      <td className="p-2">
                        <div className="font-medium">{holiday.holiday_name}</div>
                      </td>
                      <td className="p-2">
                        <div className="text-sm">{formatDate(holiday.start_date)}</div>
                      </td>
                      <td className="p-2">
                        <div className="text-sm">{formatDate(holiday.end_date)}</div>
                      </td>
                      <td className="p-2">
                        <Badge variant={holiday.pay_multiplier >= 2.5 ? 'destructive' : 'secondary'}>
                          {holiday.pay_multiplier}x
                        </Badge>
                      </td>
                      <td className="p-2">
                        {holiday.is_recurring ? (
                          <Badge variant="outline">Recurring</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">One-time</span>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditClick(holiday)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(holiday.id, holiday.holiday_name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}</DialogTitle>
            <DialogDescription>
              Configure holiday details and pay multiplier
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Holiday Name</label>
              <Input
                value={formData.holiday_name}
                onChange={(e) => setFormData({ ...formData, holiday_name: e.target.value })}
                placeholder="e.g., Tết Nguyên Đán"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Pay Multiplier</label>
              <Input
                type="number"
                step="0.1"
                min="1.0"
                value={formData.pay_multiplier}
                onChange={(e) => setFormData({ ...formData, pay_multiplier: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Staff will earn {formData.pay_multiplier}x their base hourly rate
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={formData.is_recurring}
                onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked as boolean })}
              />
              <label className="text-sm font-medium">
                Recurring (applies every year)
              </label>
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
            <Button onClick={handleSubmit} disabled={submitting || !formData.holiday_name || !formData.start_date || !formData.end_date}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  {editingHoliday ? 'Update' : 'Create'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Save, RefreshCw } from 'lucide-react';

type AvailabilityStatus = 'available' | 'preferred_not' | 'unavailable';

interface CellState {
  day: string;
  hour: number;
  status: AvailabilityStatus;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
// Extended hours: 24 = 12am, 25 = 1am (avoids midnight wrap-around complexity)
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]; // 8am to 2am

export default function AvailabilityEditorPage() {
  const [staffId, setStaffId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [grid, setGrid] = useState<Map<string, AvailabilityStatus>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);

  // Get staff ID from localStorage
  useEffect(() => {
    const storedStaffId = localStorage.getItem('staff_id');
    if (storedStaffId) {
      setStaffId(storedStaffId);
      loadAvailability(storedStaffId);
    } else {
      setLoading(false);
    }
  }, []);

  // Load existing availability from API
  const loadAvailability = async (staffId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/staff/availability?staff_id=${staffId}`);
      if (response.ok) {
        const data = await response.json();
        const newGrid = new Map<string, AvailabilityStatus>();

        // Initialize all cells as 'available' by default
        DAYS.forEach(day => {
          HOURS.forEach(hour => {
            const key = `${day}-${hour}`;
            newGrid.set(key, 'available');
          });
        });

        // Override with existing data
        data.availability.forEach((slot: any) => {
          // Simple sequential loop (extended hours avoid midnight wrap-around)
          for (let h = slot.hour_start; h < slot.hour_end; h++) {
            const key = `${slot.day_of_week}-${h}`;
            newGrid.set(key, slot.availability_status);
          }
        });

        setGrid(newGrid);
      }
    } catch (error) {
      console.error('Error loading availability:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get cell key
  const getCellKey = (day: string, hour: number) => `${day}-${hour}`;

  // Get cell status
  const getCellStatus = (day: string, hour: number): AvailabilityStatus => {
    return grid.get(getCellKey(day, hour)) || 'available';
  };

  // Cycle cell status: available → preferred_not → unavailable → available
  const cycleCellStatus = (day: string, hour: number) => {
    const key = getCellKey(day, hour);
    const current = grid.get(key) || 'available';
    let next: AvailabilityStatus;

    if (current === 'available') {
      next = 'preferred_not';
    } else if (current === 'preferred_not') {
      next = 'unavailable';
    } else {
      next = 'available';
    }

    const newGrid = new Map(grid);
    newGrid.set(key, next);
    setGrid(newGrid);
    setHasChanges(true);
  };

  // Fill all cells with a specific status
  const fillAll = (status: AvailabilityStatus) => {
    const newGrid = new Map<string, AvailabilityStatus>();
    DAYS.forEach(day => {
      HOURS.forEach(hour => {
        newGrid.set(getCellKey(day, hour), status);
      });
    });
    setGrid(newGrid);
    setHasChanges(true);
  };

  // Reset to default (all available)
  const reset = () => {
    if (!staffId) return;
    loadAvailability(staffId);
    setHasChanges(false);
  };

  // Save availability to API
  const saveAvailability = async () => {
    if (!staffId) return;

    setSaving(true);
    try {
      // Group consecutive hours with same status into slots
      const slots: any[] = [];

      DAYS.forEach(day => {
        let currentSlot: { day_of_week: string; hour_start: number; hour_end: number; availability_status: AvailabilityStatus } | null = null;

        HOURS.forEach((hour, index) => {
          const status = getCellStatus(day, hour);

          if (!currentSlot || currentSlot.availability_status !== status) {
            // Start new slot
            if (currentSlot) {
              slots.push(currentSlot);
            }
            currentSlot = {
              day_of_week: day,
              hour_start: hour,
              hour_end: hour + 1, // Extended hours: can go up to 26
              availability_status: status
            };
          } else {
            // Extend current slot
            currentSlot.hour_end = hour + 1;
          }

          // Close slot at end of day
          if (index === HOURS.length - 1 && currentSlot) {
            slots.push(currentSlot);
          }
        });
      });

      const response = await fetch('/api/staff/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staffId,
          availability_slots: slots
        })
      });

      if (response.ok) {
        alert('✅ Availability saved successfully!');
        setHasChanges(false);
      } else {
        const error = await response.json();
        alert(`❌ Failed to save: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving availability:', error);
      alert('❌ Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  // Format hour for display (handles extended hours: 24=12am, 25=1am)
  const formatHour = (hour: number) => {
    if (hour === 24) return '12am';
    if (hour === 25) return '1am';
    if (hour === 0) return '12am';
    if (hour < 12) return `${hour}am`;
    if (hour === 12) return '12pm';
    return `${hour - 12}pm`;
  };

  // Get color classes for cell
  const getCellColor = (status: AvailabilityStatus) => {
    switch (status) {
      case 'available':
        return 'bg-green-500 hover:bg-green-600 text-white';
      case 'preferred_not':
        return 'bg-yellow-500 hover:bg-yellow-600 text-white';
      case 'unavailable':
        return 'bg-red-500 hover:bg-red-600 text-white';
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
              Please log in to edit your availability
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
        <h1 className="text-3xl font-bold">My Availability</h1>
        <p className="text-muted-foreground">
          Tap any hour to cycle: <span className="text-green-600">Available</span> → <span className="text-yellow-600">Prefer Not</span> → <span className="text-red-600">Unavailable</span>
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => fillAll('available')}
          className="flex-1 sm:flex-initial"
        >
          <div className="w-4 h-4 rounded bg-green-500 mr-2" />
          Fill All Available
        </Button>
        <Button
          variant="outline"
          onClick={() => fillAll('unavailable')}
          className="flex-1 sm:flex-initial"
        >
          <div className="w-4 h-4 rounded bg-red-500 mr-2" />
          Fill All Unavailable
        </Button>
        <Button
          variant="outline"
          onClick={reset}
          disabled={!hasChanges}
          className="flex-1 sm:flex-initial"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Reset
        </Button>
        <Button
          onClick={saveAvailability}
          disabled={saving || !hasChanges}
          className="flex-1 sm:flex-initial ml-auto"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Availability Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Availability</CardTitle>
          <CardDescription>
            Your recurring weekly schedule (8am - 2am)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Desktop: Horizontal Scroll */}
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-background border border-border p-2 text-sm font-semibold text-left min-w-[80px]">
                      Time
                    </th>
                    {DAYS.map(day => (
                      <th
                        key={day}
                        className="border border-border p-2 text-sm font-semibold min-w-[80px]"
                      >
                        {day.substring(0, 3)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HOURS.map(hour => (
                    <tr key={hour}>
                      <td className="sticky left-0 z-10 bg-background border border-border p-2 text-sm font-medium">
                        {formatHour(hour)}
                      </td>
                      {DAYS.map(day => {
                        const status = getCellStatus(day, hour);
                        return (
                          <td key={`${day}-${hour}`} className="border border-border p-0">
                            <button
                              onClick={() => cycleCellStatus(day, hour)}
                              className={`w-full h-12 transition-colors ${getCellColor(status)}`}
                              title={`${day} ${formatHour(hour)}: ${status}`}
                            >
                              <span className="sr-only">{status}</span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-500" />
              <span>Prefer Not</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500" />
              <span>Unavailable</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Changes Reminder */}
      {hasChanges && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="pt-6">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ You have unsaved changes. Click "Save Changes" to update your availability.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

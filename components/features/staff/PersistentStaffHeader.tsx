'use client';

import { useEffect, useState } from 'react';
import { Star, User } from 'lucide-react';

export function PersistentStaffHeader() {
  const [staffInfo, setStaffInfo] = useState<{
    name: string;
    points: number;
  } | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if staff is logged in
    const staffId = localStorage.getItem('staff_id');
    if (!staffId) return;

    // Function to fetch staff info
    const fetchStaffInfo = () => {
      fetch(`/api/staff/points?staffId=${staffId}`)
        .then((res) => res.json())
        .then((data) => {
          setStaffInfo({
            name: data.nickname || data.full_name,
            points: data.points || 0,
          });
          setIsVisible(true);
        })
        .catch((err) => console.error('Error fetching staff info:', err));
    };

    // Initial fetch
    fetchStaffInfo();

    // Set up polling for real-time points updates (every 30 seconds)
    const pointsInterval = setInterval(fetchStaffInfo, 30000);

    // Cleanup interval on unmount
    return () => clearInterval(pointsInterval);
  }, []);

  if (!isVisible || !staffInfo) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-yellow-400 to-yellow-500 shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-yellow-900">
          <User className="h-4 w-4" />
          <span>Logged in as: {staffInfo.name}</span>
        </div>

        <div className="flex items-center gap-1 text-sm font-bold text-yellow-900">
          <Star className="h-4 w-4 fill-yellow-600" />
          <span>{staffInfo.points.toLocaleString()} points</span>
        </div>
      </div>
    </div>
  );
}

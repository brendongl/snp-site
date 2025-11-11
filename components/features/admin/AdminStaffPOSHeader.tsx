'use client';

import { useEffect, useState } from 'react';
import { formatVND } from '@/lib/services/ipos-api-service';
import { Star, User } from 'lucide-react';

interface POSDashboardData {
  unpaidAmount: number;
  paidAmount: number;
  currentTables: number;
  paidCustomers: number;    // Customers who have paid (left)
  unpaidCustomers: number;  // Customers currently in store
  lastUpdated: string;
}

interface StaffInfo {
  name: string;
  points: number;
}

export function AdminStaffPOSHeader() {
  const [posData, setPosData] = useState<POSDashboardData | null>(null);
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // Fetch POS data
        const posResponse = await fetch('/api/pos/dashboard');
        const posResult = await posResponse.json();

        if (posResult.success) {
          setPosData(posResult.data);
          setError(null);
        } else {
          setError('Failed to load POS data');
        }

        // Fetch staff info if logged in
        const staffId = localStorage.getItem('staff_id');
        if (staffId) {
          const staffResponse = await fetch(`/api/staff/points?staffId=${staffId}`);
          if (staffResponse.ok) {
            const staffData = await staffResponse.json();
            setStaffInfo({
              name: staffData.nickname || staffData.full_name,
              points: staffData.points || 0,
            });
          }
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Error loading data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // Refresh data every 2 minutes
    const interval = setInterval(fetchData, 120000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-blue-600 text-white py-2 px-4 text-sm text-center">
        Loading dashboard data...
      </div>
    );
  }

  if (error || !posData) {
    return null; // Don't show header if there's an error or no data
  }

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2.5 px-4 shadow-md">
      <div className="container mx-auto flex items-center justify-between gap-4 text-sm font-medium flex-wrap sm:flex-nowrap">
        {/* Left: POS Data */}
        <div className="flex items-center gap-4 sm:gap-8">
          <div className="flex items-center gap-2">
            <span className="opacity-90">💰 Unpaid:</span>
            <span className="font-bold text-yellow-300">{formatVND(posData.unpaidAmount)} VND</span>
          </div>

          <div className="h-4 w-px bg-white/30 hidden sm:block"></div>

          <div className="flex items-center gap-2">
            <span className="opacity-90">✅ Paid:</span>
            <span className="font-bold text-green-300">{formatVND(posData.paidAmount)} VND</span>
          </div>

          <div className="h-4 w-px bg-white/30 hidden md:block"></div>

          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <span className="opacity-90">🪑 <span className="hidden sm:inline">Tables:</span></span>
            <span className="font-bold">{posData.currentTables}</span>
          </div>

          <div className="h-4 w-px bg-white/30 hidden md:block"></div>

          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <span className="opacity-90">✅ <span className="hidden sm:inline">Paid:</span></span>
            <span className="font-bold text-green-300">{posData.paidCustomers}</span>
          </div>

          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <span className="opacity-90">⏱️ <span className="hidden sm:inline">In Store:</span></span>
            <span className="font-bold text-yellow-300">{posData.unpaidCustomers}</span>
          </div>
        </div>

        {/* Right: Staff Info (if logged in) */}
        {staffInfo && (
          <>
            <div className="h-4 w-px bg-white/30 hidden lg:block"></div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 opacity-90" />
                <span className="opacity-90">{staffInfo.name}</span>
              </div>
              <div className="flex items-center gap-1 px-3 py-1 bg-yellow-500/20 border border-yellow-400/30 rounded-full">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-bold text-yellow-200">{staffInfo.points.toLocaleString()}</span>
                <span className="text-xs text-yellow-300">pts</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

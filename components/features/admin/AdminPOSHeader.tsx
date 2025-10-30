'use client';

import { useEffect, useState } from 'react';
import { formatVND } from '@/lib/services/ipos-service';

interface POSDashboardData {
  unpaidAmount: number;
  paidAmount: number;
  currentTables: number;
  currentCustomers: number;
  lastUpdated: string;
}

export function AdminPOSHeader() {
  const [data, setData] = useState<POSDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch('/api/pos/dashboard');
        const result = await response.json();

        if (result.success) {
          setData(result.data);
          setError(null);
        } else {
          setError('Failed to load POS data');
        }
      } catch (err) {
        console.error('Error fetching POS dashboard:', err);
        setError('Error loading POS data');
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
        Loading POS data...
      </div>
    );
  }

  if (error || !data) {
    return null; // Don't show header if there's an error or no data
  }

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2.5 px-4 shadow-md">
      <div className="container mx-auto flex items-center justify-center gap-8 text-sm font-medium">
        <div className="flex items-center gap-2">
          <span className="opacity-90">💰 Unpaid:</span>
          <span className="font-bold text-yellow-300">{formatVND(data.unpaidAmount)} VND</span>
        </div>

        <div className="h-4 w-px bg-white/30"></div>

        <div className="flex items-center gap-2">
          <span className="opacity-90">✅ Paid:</span>
          <span className="font-bold text-green-300">{formatVND(data.paidAmount)} VND</span>
        </div>

        <div className="h-4 w-px bg-white/30"></div>

        <div className="flex items-center gap-2">
          <span className="opacity-90">🪑 Tables:</span>
          <span className="font-bold">{data.currentTables}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="opacity-90">👥 Customers:</span>
          <span className="font-bold">{data.currentCustomers}</span>
        </div>
      </div>
    </div>
  );
}

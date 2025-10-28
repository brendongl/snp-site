'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StatsData {
  uniqueGames: number;
  totalPlays: number;
  mostPlayed: { game_name: string; count: number } | null;
  topLogger: { staff_name: string; count: number } | null;
  timePeriod: number;
}

export default function PlayLogStats() {
  const [timePeriod, setTimePeriod] = useState<string>('7');
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats(timePeriod);
  }, [timePeriod]);

  const fetchStats = async (period: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/play-logs/stats?timePeriod=${period}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching play log stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Statistics</h2>
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Statistics</h2>
        <Select value={timePeriod} onValueChange={setTimePeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-1">Unique Games</div>
          <div className="text-2xl font-bold">{stats?.uniqueGames || 0}</div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-1">Total Plays</div>
          <div className="text-2xl font-bold">{stats?.totalPlays || 0}</div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-1">Most Played</div>
          <div className="text-xl font-bold truncate">
            {stats?.mostPlayed?.game_name || '-'}
          </div>
          <div className="text-sm text-gray-500">
            {stats?.mostPlayed?.count ? `${stats.mostPlayed.count}x` : ''}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-1">Top Logger</div>
          <div className="text-xl font-bold truncate">
            {stats?.topLogger?.staff_name || '-'}
          </div>
          <div className="text-sm text-gray-500">
            {stats?.topLogger?.count ? `${stats.topLogger.count}x` : ''}
          </div>
        </Card>
      </div>
    </div>
  );
}

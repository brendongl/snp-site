import { NextRequest, NextResponse } from 'next/server';
import PlayLogsDbService from '@/lib/services/play-logs-db-service';

const playLogsService = new PlayLogsDbService(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timePeriod = parseInt(searchParams.get('timePeriod') || '7');

    // Validate time period
    if (![7, 30, 90].includes(timePeriod)) {
      return NextResponse.json(
        { error: 'Invalid time period. Must be 7, 30, or 90.' },
        { status: 400 }
      );
    }

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - timePeriod);

    // Get all logs with names in time period
    const allLogs = await playLogsService.getAllLogsWithNames();
    const filteredLogs = allLogs.filter((log) => {
      if (!log.sessionDate) return false;
      const logDate = new Date(log.sessionDate);
      return logDate >= dateThreshold;
    });

    // Calculate statistics
    const uniqueGames = new Set(filteredLogs.map((log) => log.gameId)).size;
    const totalPlays = filteredLogs.length;

    // Most played game
    const gameCounts: Record<string, { name: string; count: number }> = {};
    filteredLogs.forEach((log) => {
      if (!gameCounts[log.gameId]) {
        gameCounts[log.gameId] = { name: log.gameName, count: 0 };
      }
      gameCounts[log.gameId].count++;
    });
    const mostPlayedEntry = Object.entries(gameCounts).sort(
      ([, a], [, b]) => b.count - a.count
    )[0];
    const mostPlayed = mostPlayedEntry
      ? { game_name: mostPlayedEntry[1].name, count: mostPlayedEntry[1].count }
      : null;

    // Top logger (prefer nickname over full name)
    const loggerCounts: Record<string, { name: string; count: number }> = {};
    filteredLogs.forEach((log) => {
      if (!loggerCounts[log.staffListId]) {
        loggerCounts[log.staffListId] = { name: log.staffNickname || log.staffName, count: 0 };
      }
      loggerCounts[log.staffListId].count++;
    });
    const topLoggerEntry = Object.entries(loggerCounts).sort(
      ([, a], [, b]) => b.count - a.count
    )[0];
    const topLogger = topLoggerEntry
      ? { staff_name: topLoggerEntry[1].name, count: topLoggerEntry[1].count }
      : null;

    return NextResponse.json({
      uniqueGames,
      totalPlays,
      mostPlayed,
      topLogger,
      timePeriod,
    });
  } catch (error) {
    console.error('Error fetching play log statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch play log statistics' },
      { status: 500 }
    );
  }
}

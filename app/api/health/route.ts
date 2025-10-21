import { NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';

export async function GET() {
  const envCheck = {
    timestamp: new Date().toISOString(),
    environment: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      AIRTABLE_API_KEY: !!process.env.AIRTABLE_API_KEY,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET',
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    },
    nodeEnv: process.env.NODE_ENV,
  };

  // Try to connect to PostgreSQL
  let postgresTest = {
    success: false,
    error: null as string | null,
    details: null as any,
  };

  let dbStats = {
    games: 0,
    images: 0,
    contentChecks: 0,
    staffKnowledge: 0,
    playLogs: 0,
  };

  try {
    const db = DatabaseService.initialize();

    // Test database health
    const healthCheck = await db.healthCheck();
    postgresTest.success = healthCheck.status === 'ok';

    if (!postgresTest.success) {
      postgresTest.error = healthCheck.message;
    }

    // Get database statistics
    const games = await db.games.getAllGames();

    dbStats.games = games.length;
    dbStats.images = await db.games.getImageCount();

    // Try to get counts from other tables
    try {
      const checks = await db.contentChecks.getAllChecks();
      dbStats.contentChecks = checks.length;
    } catch (e) {
      // Silently fail if table is empty or has issues
    }

    try {
      const knowledge = await db.staffKnowledge.getAllKnowledge();
      dbStats.staffKnowledge = knowledge.length;
    } catch (e) {
      // Silently fail
    }

    try {
      const logs = await db.playLogs.getAllLogs();
      dbStats.playLogs = logs.length;
    } catch (e) {
      // Silently fail
    }
  } catch (error) {
    postgresTest.error = error instanceof Error ? error.message : 'Unknown error';
    postgresTest.details = {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  return NextResponse.json({
    status: postgresTest.success ? 'healthy' : 'unhealthy',
    envCheck,
    database: postgresTest,
    stats: dbStats,
  }, {
    status: postgresTest.success ? 200 : 500
  });
}

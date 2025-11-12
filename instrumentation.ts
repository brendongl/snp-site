/**
 * Server Instrumentation
 * Version: 2.0.0
 *
 * Runs on server startup (Next.js instrumentation API)
 * Used to initialize cron jobs for the rostering system
 */

import RosterCronService from './lib/services/roster-cron-service';

export async function register() {
  // Only run on server (not during build)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('\n🚀 Server instrumentation starting...');

    try {
      // Initialize rostering cron jobs
      await RosterCronService.initialize();
      console.log('✅ Server instrumentation complete\n');
    } catch (error: any) {
      console.error('❌ Server instrumentation failed:', error.message);
    }

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('\n👋 SIGTERM received, stopping cron jobs...');
      RosterCronService.stopAll();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      console.log('\n👋 SIGINT received, stopping cron jobs...');
      RosterCronService.stopAll();
      process.exit(0);
    });
  }
}

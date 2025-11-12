/**
 * Roster Cron Service
 * Version: 2.0.0
 * Phase 1: Cron Job Infrastructure
 *
 * Manages scheduled tasks for the rostering system:
 * - Daily Airtable export (11:59pm)
 * - Expired rule cleanup (midnight Sunday)
 * - Missing clock-out detection (9am daily)
 */

import schedule from 'node-schedule';
import RosterDbService from './roster-db-service';
import pool from '@/lib/db/postgres';

export class RosterCronService {
  private static jobs: schedule.Job[] = [];

  /**
   * Initialize all cron jobs
   */
  static async initialize() {
    console.log('🕐 Initializing roster cron jobs...');

    // Daily Airtable export at 11:59pm
    const exportJob = schedule.scheduleJob('59 23 * * *', async () => {
      console.log('⏰ Running daily Airtable export...');
      await this.exportHoursToAirtable();
    });
    this.jobs.push(exportJob);
    console.log('   ✅ Daily export job scheduled (11:59pm)');

    // Expired rule cleanup - Midnight Sunday (0 0 * * 0)
    const cleanupJob = schedule.scheduleJob('0 0 * * 0', async () => {
      console.log('⏰ Running expired rule cleanup...');
      await this.cleanupExpiredRules();
    });
    this.jobs.push(cleanupJob);
    console.log('   ✅ Rule cleanup job scheduled (midnight Sunday)');

    // Missing clock-out detection - 9am daily
    const clockoutJob = schedule.scheduleJob('0 9 * * *', async () => {
      console.log('⏰ Checking for missing clock-outs...');
      await this.checkMissingClockouts();
    });
    this.jobs.push(clockoutJob);
    console.log('   ✅ Missing clock-out check scheduled (9am daily)');

    console.log(`✨ All ${this.jobs.length} cron jobs initialized\n`);
  }

  /**
   * Stop all cron jobs (for graceful shutdown)
   */
  static stopAll() {
    console.log('🛑 Stopping all cron jobs...');
    this.jobs.forEach(job => job.cancel());
    this.jobs = [];
    console.log('   ✅ All jobs stopped');
  }

  /**
   * Export approved hours to Airtable
   * Runs daily at 11:59pm
   */
  private static async exportHoursToAirtable() {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // Get all approved clock records for today
      const query = `
        SELECT
          cr.*,
          s.name as staff_name,
          s.email as staff_email,
          s.base_hourly_rate,
          rs.scheduled_start,
          rs.scheduled_end,
          rs.day_of_week
        FROM clock_records cr
        JOIN staff_list s ON cr.staff_id = s.id
        LEFT JOIN roster_shifts rs ON cr.shift_id = rs.id
        WHERE DATE(cr.clock_in_time AT TIME ZONE 'Asia/Ho_Chi_Minh') = $1
        AND cr.approved_by IS NOT NULL
        ORDER BY cr.clock_in_time
      `;

      const result = await pool.query(query, [todayStr]);
      const records = result.rows;

      console.log(`   📊 Found ${records.length} approved clock records for ${todayStr}`);

      if (records.length === 0) {
        console.log('   ℹ️  No records to export');
        return;
      }

      // TODO: Phase 5 - Implement Airtable export
      // For now, just log the records
      let totalHours = 0;
      records.forEach(record => {
        const hours = record.approved_hours || 0;
        totalHours += hours;
        console.log(`   - ${record.staff_name}: ${hours} hours`);
      });

      console.log(`   ✅ Total hours: ${totalHours.toFixed(2)}`);
      console.log('   ⚠️  Airtable export not yet implemented (Phase 5)');

    } catch (error: any) {
      console.error('   ❌ Export failed:', error.message);
      // TODO: Send Discord alert to admin
    }
  }

  /**
   * Cleanup expired rules
   * Runs midnight Sunday
   */
  private static async cleanupExpiredRules() {
    try {
      const query = `
        UPDATE roster_rules
        SET is_active = false
        WHERE expires_at < CURRENT_DATE
        AND is_active = true
        RETURNING id, rule_text, expires_at
      `;

      const result = await pool.query(query);
      const expiredRules = result.rows;

      console.log(`   📊 Deactivated ${expiredRules.length} expired rules`);

      if (expiredRules.length > 0) {
        // Create admin notifications
        for (const rule of expiredRules) {
          await pool.query(`
            INSERT INTO roster_notifications (
              notification_type,
              message,
              severity,
              related_record_id
            ) VALUES ($1, $2, $3, $4)
          `, [
            'rule_expired',
            `Rule auto-deactivated: "${rule.rule_text}" (expired ${rule.expires_at})`,
            'info',
            rule.id
          ]);
        }
        console.log(`   ✅ Created ${expiredRules.length} notifications`);
      }

    } catch (error: any) {
      console.error('   ❌ Rule cleanup failed:', error.message);
    }
  }

  /**
   * Check for missing clock-outs
   * Runs daily at 9am
   */
  private static async checkMissingClockouts() {
    try {
      // Find clock-ins older than 18 hours with no clock-out
      const eighteenHoursAgo = new Date();
      eighteenHoursAgo.setHours(eighteenHoursAgo.getHours() - 18);

      const query = `
        SELECT
          cr.id,
          cr.staff_id,
          cr.clock_in_time,
          cr.rostered_start,
          cr.rostered_end,
          s.name as staff_name,
          s.email as staff_email,
          s.discord_username
        FROM clock_records cr
        JOIN staff_list s ON cr.staff_id = s.id
        WHERE cr.clock_out_time IS NULL
        AND cr.clock_in_time < $1
        ORDER BY cr.clock_in_time DESC
      `;

      const result = await pool.query(query, [eighteenHoursAgo]);
      const missingClockouts = result.rows;

      console.log(`   📊 Found ${missingClockouts.length} missing clock-outs`);

      if (missingClockouts.length > 0) {
        for (const record of missingClockouts) {
          // Create notification
          await pool.query(`
            INSERT INTO roster_notifications (
              notification_type,
              staff_id,
              related_record_id,
              message,
              severity
            ) VALUES ($1, $2, $3, $4, $5)
          `, [
            'missing_clock_out',
            record.staff_id,
            record.id,
            `${record.staff_name} clocked in at ${new Date(record.clock_in_time).toLocaleTimeString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })} but never clocked out`,
            'requires_action'
          ]);

          console.log(`   ⚠️  Missing clock-out: ${record.staff_name}`);

          // TODO: Phase 5 - Send Discord alert
          // await sendDiscordAlert(ADMIN_CHANNEL, {
          //   content: `🚨 Missing Clock-Out\n\n${record.discord_username || record.staff_name} clocked in yesterday at ${clockInTime} but never clocked out\n\nLast scheduled shift: ${record.rostered_start} - ${record.rostered_end}`
          // });
        }

        console.log(`   ✅ Created ${missingClockouts.length} notifications`);
        console.log('   ⚠️  Discord alerts not yet implemented (Phase 5)');
      }

    } catch (error: any) {
      console.error('   ❌ Missing clock-out check failed:', error.message);
    }
  }

  /**
   * Manual trigger for testing (called via API)
   */
  static async runManualExport() {
    console.log('🔧 Manual export triggered');
    await this.exportHoursToAirtable();
  }

  static async runManualCleanup() {
    console.log('🔧 Manual cleanup triggered');
    await this.cleanupExpiredRules();
  }

  static async runManualClockoutCheck() {
    console.log('🔧 Manual clock-out check triggered');
    await this.checkMissingClockouts();
  }
}

export default RosterCronService;

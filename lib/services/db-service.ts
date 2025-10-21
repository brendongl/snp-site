import GamesDbService from './games-db-service';
import ContentChecksDbService from './content-checks-db-service';
import StaffKnowledgeDbService from './staff-knowledge-db-service';
import PlayLogsDbService from './play-logs-db-service';

/**
 * Master database service coordinator
 * Provides unified access to all PostgreSQL services
 */
class DatabaseService {
  private static instance: DatabaseService;
  private connectionString: string;

  public games: GamesDbService;
  public contentChecks: ContentChecksDbService;
  public staffKnowledge: StaffKnowledgeDbService;
  public playLogs: PlayLogsDbService;

  private constructor(connectionString: string) {
    this.connectionString = connectionString;
    this.games = new GamesDbService(connectionString);
    this.contentChecks = new ContentChecksDbService(connectionString);
    this.staffKnowledge = new StaffKnowledgeDbService(connectionString);
    this.playLogs = new PlayLogsDbService(connectionString);
  }

  /**
   * Initialize the database service singleton
   */
  static initialize(connectionString?: string): DatabaseService {
    if (!DatabaseService.instance) {
      const dbUrl = connectionString || process.env.DATABASE_URL;
      if (!dbUrl) {
        throw new Error('DATABASE_URL environment variable is required for database initialization');
      }
      DatabaseService.instance = new DatabaseService(dbUrl);
    }
    return DatabaseService.instance;
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      throw new Error('DatabaseService not initialized. Call initialize() first.');
    }
    return DatabaseService.instance;
  }

  /**
   * Close all database connections
   */
  async close(): Promise<void> {
    try {
      await this.games.close();
      await this.contentChecks.close();
      await this.staffKnowledge.close();
      await this.playLogs.close();
      console.log('✅ All database connections closed');
    } catch (error) {
      console.error('Error closing database connections:', error);
      throw error;
    }
  }

  /**
   * Health check - verify database connectivity
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; message: string }> {
    try {
      // Try to query each table
      await this.games.getAllGames().then(() => 'games');
      await this.contentChecks.getAllChecks().then(() => 'checks');
      await this.staffKnowledge.getAllKnowledge().then(() => 'knowledge');
      await this.playLogs.getAllLogs().then(() => 'logs');

      return {
        status: 'ok',
        message: 'Database connection healthy - all tables accessible',
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Database health check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<{
    gamesCount: number;
    contentChecksCount: number;
    staffKnowledgeCount: number;
    playLogsCount: number;
  }> {
    // This would require implementing stats methods in each service
    // For now, we'll return a placeholder
    return {
      gamesCount: 0,
      contentChecksCount: 0,
      staffKnowledgeCount: 0,
      playLogsCount: 0,
    };
  }
}

export default DatabaseService;

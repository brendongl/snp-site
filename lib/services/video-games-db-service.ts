import { Pool, PoolClient } from 'pg';
import { VideoGame, VideoGameFilters, VideogamePlatform } from '@/types';

class VideoGamesDbService {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      // Connection pool configuration for Railway production environment
      max: 10, // Maximum number of clients in the pool
      min: 2, // Minimum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection can't be acquired
    });
  }

  /**
   * Get all video games from PostgreSQL
   */
  async getAllGames(platform?: VideogamePlatform): Promise<VideoGame[]> {
    try {
      const query = platform
        ? `SELECT * FROM video_games WHERE platform = $1 ORDER BY name ASC`
        : `SELECT * FROM video_games ORDER BY name ASC`;

      const params = platform ? [platform] : [];
      const result = await this.pool.query(query, params);

      return result.rows.map(this.mapRowToVideoGame);
    } catch (error) {
      console.error('Error fetching all video games from PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Get a single video game by ID and platform
   */
  async getGameById(id: string, platform: VideogamePlatform = 'switch'): Promise<VideoGame | null> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM video_games WHERE id = $1 AND platform = $2`,
        [id, platform]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToVideoGame(result.rows[0]);
    } catch (error) {
      console.error(`Error fetching video game ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get games by platform (multiple platforms)
   */
  async getGamesByPlatform(platforms: VideogamePlatform[]): Promise<VideoGame[]> {
    try {
      const placeholders = platforms.map((_, i) => `$${i + 1}`).join(', ');
      const result = await this.pool.query(
        `SELECT * FROM video_games WHERE platform = ANY($1) ORDER BY name ASC`,
        [platforms]
      );

      return result.rows.map(this.mapRowToVideoGame);
    } catch (error) {
      console.error('Error fetching games by platform:', error);
      throw error;
    }
  }

  /**
   * Get games by console location (OR logic - games on ANY of the selected consoles)
   */
  async getGamesByLocation(locations: string[]): Promise<VideoGame[]> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM video_games WHERE located_on && $1 ORDER BY name ASC`,
        [locations]
      );

      return result.rows.map(this.mapRowToVideoGame);
    } catch (error) {
      console.error('Error fetching games by location:', error);
      throw error;
    }
  }

  /**
   * Get games by category/genre (OR logic - games with ANY of the selected categories)
   */
  async getGamesByCategory(categories: string[]): Promise<VideoGame[]> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM video_games WHERE category && $1 ORDER BY name ASC`,
        [categories]
      );

      return result.rows.map(this.mapRowToVideoGame);
    } catch (error) {
      console.error('Error fetching games by category:', error);
      throw error;
    }
  }

  /**
   * Search games by name or publisher
   */
  async searchGames(query: string, platform?: VideogamePlatform): Promise<VideoGame[]> {
    try {
      const searchPattern = `%${query}%`;
      const sql = platform
        ? `SELECT * FROM video_games
           WHERE platform = $1 AND (name ILIKE $2 OR publisher ILIKE $2)
           ORDER BY name ASC`
        : `SELECT * FROM video_games
           WHERE name ILIKE $1 OR publisher ILIKE $1
           ORDER BY name ASC`;

      const params = platform ? [platform, searchPattern] : [searchPattern];
      const result = await this.pool.query(sql, params);

      return result.rows.map(this.mapRowToVideoGame);
    } catch (error) {
      console.error('Error searching video games:', error);
      throw error;
    }
  }

  /**
   * Get Switch games specifically
   */
  async getSwitchGames(): Promise<VideoGame[]> {
    return this.getAllGames('switch');
  }

  /**
   * Create a new video game
   */
  async createGame(gameData: Partial<VideoGame>): Promise<VideoGame> {
    try {
      const result = await this.pool.query(
        `INSERT INTO video_games (
          id, platform, name, publisher, developer, release_date,
          description, category, languages, number_of_players,
          rating_content, platform_specific_data, located_on,
          image_landscape_url, image_portrait_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [
          gameData.id,
          gameData.platform,
          gameData.name,
          gameData.publisher,
          gameData.developer,
          gameData.release_date,
          gameData.description,
          gameData.category,
          gameData.languages,
          gameData.number_of_players,
          gameData.rating_content,
          gameData.platform_specific_data,
          gameData.located_on,
          gameData.image_landscape_url,
          gameData.image_portrait_url,
        ]
      );

      return this.mapRowToVideoGame(result.rows[0]);
    } catch (error) {
      console.error('Error creating video game:', error);
      throw error;
    }
  }

  /**
   * Update a video game
   */
  async updateGame(id: string, platform: VideogamePlatform, updates: Partial<VideoGame>): Promise<VideoGame> {
    try {
      const result = await this.pool.query(
        `UPDATE video_games SET
          name = COALESCE($1, name),
          publisher = COALESCE($2, publisher),
          developer = COALESCE($3, developer),
          release_date = COALESCE($4, release_date),
          description = COALESCE($5, description),
          category = COALESCE($6, category),
          languages = COALESCE($7, languages),
          number_of_players = COALESCE($8, number_of_players),
          rating_content = COALESCE($9, rating_content),
          platform_specific_data = COALESCE($10, platform_specific_data),
          located_on = COALESCE($11, located_on),
          image_landscape_url = COALESCE($12, image_landscape_url),
          image_portrait_url = COALESCE($13, image_portrait_url),
          updated_at = NOW()
        WHERE id = $14 AND platform = $15
        RETURNING *`,
        [
          updates.name,
          updates.publisher,
          updates.developer,
          updates.release_date,
          updates.description,
          updates.category,
          updates.languages,
          updates.number_of_players,
          updates.rating_content,
          updates.platform_specific_data,
          updates.located_on,
          updates.image_landscape_url,
          updates.image_portrait_url,
          id,
          platform,
        ]
      );

      if (result.rows.length === 0) {
        throw new Error(`Game not found: ${id} on platform ${platform}`);
      }

      return this.mapRowToVideoGame(result.rows[0]);
    } catch (error) {
      console.error(`Error updating video game ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a video game
   */
  async deleteGame(id: string, platform: VideogamePlatform): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `DELETE FROM video_games WHERE id = $1 AND platform = $2`,
        [id, platform]
      );

      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error(`Error deleting video game ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get unique console locations
   */
  async getUniqueLocations(platform?: VideogamePlatform): Promise<string[]> {
    try {
      const query = platform
        ? `SELECT DISTINCT unnest(located_on) as location FROM video_games WHERE platform = $1 ORDER BY location`
        : `SELECT DISTINCT unnest(located_on) as location FROM video_games ORDER BY location`;

      const params = platform ? [platform] : [];
      const result = await this.pool.query(query, params);

      return result.rows.map(row => row.location);
    } catch (error) {
      console.error('Error fetching unique locations:', error);
      throw error;
    }
  }

  /**
   * Get unique categories/genres
   */
  async getUniqueCategories(platform?: VideogamePlatform): Promise<string[]> {
    try {
      const query = platform
        ? `SELECT DISTINCT unnest(category) as genre FROM video_games WHERE platform = $1 ORDER BY genre`
        : `SELECT DISTINCT unnest(category) as genre FROM video_games ORDER BY genre`;

      const params = platform ? [platform] : [];
      const result = await this.pool.query(query, params);

      return result.rows.map(row => row.genre);
    } catch (error) {
      console.error('Error fetching unique categories:', error);
      throw error;
    }
  }

  /**
   * Get game count by platform
   */
  async getGameCountByPlatform(): Promise<Record<string, number>> {
    try {
      const result = await this.pool.query(
        `SELECT platform, COUNT(*) as count FROM video_games GROUP BY platform`
      );

      const counts: Record<string, number> = {};
      result.rows.forEach(row => {
        counts[row.platform] = parseInt(row.count);
      });

      return counts;
    } catch (error) {
      console.error('Error fetching game count by platform:', error);
      throw error;
    }
  }

  /**
   * Map database row to VideoGame interface
   */
  private mapRowToVideoGame(row: any): VideoGame {
    return {
      id: row.id,
      platform: row.platform,
      name: row.name,
      publisher: row.publisher,
      developer: row.developer,
      release_date: row.release_date,
      description: row.description,
      category: row.category || [],
      languages: row.languages || [],
      number_of_players: row.number_of_players,
      age_rating: row.age_rating,
      rating_content: row.rating_content || [],
      platform_specific_data: row.platform_specific_data,
      located_on: row.located_on || [],
      image_url: row.image_url,
      image_landscape_url: row.image_landscape_url,
      image_portrait_url: row.image_portrait_url,
      image_screenshot_url: row.image_screenshot_url,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Export singleton instance
export const videoGamesDbService = new VideoGamesDbService(process.env.DATABASE_URL || '');
export default videoGamesDbService;

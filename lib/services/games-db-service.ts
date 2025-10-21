import { Pool, PoolClient } from 'pg';
import { BoardGame, GameFilters } from '@/types';

class GamesDbService {
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
   * Get all games from PostgreSQL
   */
  async getAllGames(): Promise<BoardGame[]> {
    try {
      const result = await this.pool.query(`
        SELECT
          id,
          name,
          description,
          categories,
          year_released,
          complexity,
          min_players,
          max_players,
          best_player_amount,
          date_of_acquisition,
          latest_check_date,
          latest_check_status,
          latest_check_notes,
          total_checks,
          sleeved,
          box_wrapped,
          game_expansions_link
        FROM games
        ORDER BY name ASC
      `);

      return result.rows.map((row) => ({
        id: row.id,
        fields: {
          'Game Name': row.name,
          'Description': row.description,
          'Categories': row.categories || [],
          'Year Released': row.year_released,
          'Complexity': row.complexity,
          'Min Players': row.min_players,
          'Max. Players': row.max_players,
          'Best Player Amount': row.best_player_amount,
          'Date of Aquisition': row.date_of_acquisition,
          'Latest Check Date': row.latest_check_date,
          'Latest Check Status': row.latest_check_status ? [row.latest_check_status] : [],
          'Latest Check Notes': row.latest_check_notes || [],
          'Total Checks': row.total_checks,
          'Sleeved': row.sleeved,
          'Box Wrapped': row.box_wrapped,
          'Game Expansions Link': row.game_expansions_link || [],
        },
      }));
    } catch (error) {
      console.error('Error fetching all games from PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Get all games with images in a single query (optimized)
   */
  async getAllGamesWithImages(): Promise<any[]> {
    try {
      // Single query with LEFT JOIN to get all games and their images
      // Filter out expansions - only show base games in main gallery
      const result = await this.pool.query(`
        SELECT
          g.id AS game_id,
          g.name,
          g.description,
          g.categories,
          g.year_released,
          g.complexity,
          g.min_players,
          g.max_players,
          g.best_player_amount,
          g.date_of_acquisition,
          g.latest_check_date,
          g.latest_check_status,
          g.latest_check_notes,
          g.total_checks,
          g.sleeved,
          g.box_wrapped,
          g.game_expansions_link,
          COALESCE(
            json_agg(
              json_build_object(
                'url', gi.url,
                'fileName', gi.file_name,
                'hash', gi.hash
              ) ORDER BY gi.id
            ) FILTER (WHERE gi.id IS NOT NULL),
            '[]'::json
          ) AS images
        FROM games g
        LEFT JOIN game_images gi ON g.id = gi.game_id
        WHERE g.base_game_id IS NULL
        GROUP BY g.id
        ORDER BY g.name ASC
      `);

      return result.rows.map((row) => ({
        id: row.game_id,
        fields: {
          'Game Name': row.name,
          'Description': row.description,
          'Categories': row.categories || [],
          'Year Released': row.year_released,
          'Complexity': row.complexity,
          'Min Players': row.min_players,
          'Max. Players': row.max_players,
          'Best Player Amount': row.best_player_amount,
          'Date of Aquisition': row.date_of_acquisition,
          'Latest Check Date': row.latest_check_date,
          'Latest Check Status': row.latest_check_status ? [row.latest_check_status] : [],
          'Latest Check Notes': row.latest_check_notes || [],
          'Total Checks': row.total_checks,
          'Sleeved': row.sleeved,
          'Box Wrapped': row.box_wrapped,
          'Game Expansions Link': row.game_expansions_link || [],
        },
        images: row.images || [],
      }));
    } catch (error) {
      console.error('Error fetching all games with images from PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Get a single game by ID
   */
  async getGameById(id: string): Promise<BoardGame | null> {
    try {
      const result = await this.pool.query(
        `SELECT
          id, name, description, categories, year_released, complexity,
          min_players, max_players, best_player_amount, date_of_acquisition,
          latest_check_date, latest_check_status, latest_check_notes, total_checks,
          sleeved, box_wrapped, base_game_id, game_expansions_link
        FROM games WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        fields: {
          'Game Name': row.name,
          'Description': row.description,
          'Categories': row.categories || [],
          'Year Released': row.year_released,
          'Complexity': row.complexity,
          'Min Players': row.min_players,
          'Max. Players': row.max_players,
          'Best Player Amount': row.best_player_amount,
          'Date of Aquisition': row.date_of_acquisition,
          'Latest Check Date': row.latest_check_date,
          'Latest Check Status': row.latest_check_status ? [row.latest_check_status] : [],
          'Latest Check Notes': row.latest_check_notes || [],
          'Total Checks': row.total_checks,
          'Sleeved': row.sleeved,
          'Box Wrapped': row.box_wrapped,
          'Game Expansions Link': row.game_expansions_link || [],
        },
      };
    } catch (error) {
      console.error('Error fetching game by ID from PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Get games by search term
   */
  async searchGames(searchTerm: string): Promise<BoardGame[]> {
    try {
      const result = await this.pool.query(
        `SELECT
          id, name, description, categories, year_released, complexity,
          min_players, max_players, best_player_amount, date_of_acquisition,
          latest_check_date, latest_check_status, latest_check_notes, total_checks,
          sleeved, box_wrapped, base_game_id, game_expansions_link
        FROM games
        WHERE (name ILIKE $1 OR description ILIKE $1)
          AND base_game_id IS NULL
        ORDER BY name ASC`,
        [`%${searchTerm}%`]
      );

      return result.rows.map((row) => ({
        id: row.id,
        fields: {
          'Game Name': row.name,
          'Description': row.description,
          'Categories': row.categories || [],
          'Year Released': row.year_released,
          'Complexity': row.complexity,
          'Min Players': row.min_players,
          'Max. Players': row.max_players,
          'Best Player Amount': row.best_player_amount,
          'Date of Aquisition': row.date_of_acquisition,
          'Latest Check Date': row.latest_check_date,
          'Latest Check Status': row.latest_check_status ? [row.latest_check_status] : [],
          'Latest Check Notes': row.latest_check_notes || [],
          'Total Checks': row.total_checks,
          'Sleeved': row.sleeved,
          'Box Wrapped': row.box_wrapped,
          'Game Expansions Link': row.game_expansions_link || [],
        },
      }));
    } catch (error) {
      console.error('Error searching games in PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Get games by category
   */
  async getGamesByCategory(category: string): Promise<BoardGame[]> {
    try {
      const result = await this.pool.query(
        `SELECT
          id, name, description, categories, year_released, complexity,
          min_players, max_players, best_player_amount, date_of_acquisition,
          latest_check_date, latest_check_status, latest_check_notes, total_checks,
          sleeved, box_wrapped, base_game_id, game_expansions_link
        FROM games
        WHERE categories::text ILIKE $1
          AND base_game_id IS NULL
        ORDER BY name ASC`,
        [`%${category}%`]
      );

      return result.rows.map((row) => ({
        id: row.id,
        fields: {
          'Game Name': row.name,
          'Description': row.description,
          'Categories': row.categories || [],
          'Year Released': row.year_released,
          'Complexity': row.complexity,
          'Min Players': row.min_players,
          'Max. Players': row.max_players,
          'Best Player Amount': row.best_player_amount,
          'Date of Aquisition': row.date_of_acquisition,
          'Latest Check Date': row.latest_check_date,
          'Latest Check Status': row.latest_check_status ? [row.latest_check_status] : [],
          'Latest Check Notes': row.latest_check_notes || [],
          'Total Checks': row.total_checks,
          'Sleeved': row.sleeved,
          'Box Wrapped': row.box_wrapped,
          'Game Expansions Link': row.game_expansions_link || [],
        },
      }));
    } catch (error) {
      console.error('Error fetching games by category from PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Get random game
   */
  async getRandomGame(): Promise<BoardGame | null> {
    try {
      const result = await this.pool.query(
        `SELECT
          id, name, description, categories, year_released, complexity,
          min_players, max_players, best_player_amount, date_of_acquisition,
          latest_check_date, latest_check_status, latest_check_notes, total_checks,
          sleeved, box_wrapped, base_game_id, game_expansions_link
        FROM games
        WHERE base_game_id IS NULL
        ORDER BY RANDOM()
        LIMIT 1`
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        fields: {
          'Game Name': row.name,
          'Description': row.description,
          'Categories': row.categories || [],
          'Year Released': row.year_released,
          'Complexity': row.complexity,
          'Min Players': row.min_players,
          'Max. Players': row.max_players,
          'Best Player Amount': row.best_player_amount,
          'Date of Aquisition': row.date_of_acquisition,
          'Latest Check Date': row.latest_check_date,
          'Latest Check Status': row.latest_check_status ? [row.latest_check_status] : [],
          'Latest Check Notes': row.latest_check_notes || [],
          'Total Checks': row.total_checks,
          'Sleeved': row.sleeved,
          'Box Wrapped': row.box_wrapped,
          'Game Expansions Link': row.game_expansions_link || [],
        },
      };
    } catch (error) {
      console.error('Error fetching random game from PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Get expansions for a specific game
   */
  async getExpansions(gameId: string): Promise<BoardGame[]> {
    try {
      const result = await this.pool.query(
        `SELECT
          id, name, description, categories, year_released, complexity,
          min_players, max_players, best_player_amount, date_of_acquisition,
          latest_check_date, latest_check_status, latest_check_notes, total_checks,
          sleeved, box_wrapped, base_game_id
        FROM games
        WHERE base_game_id = $1
        ORDER BY name ASC`,
        [gameId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        fields: {
          'Game Name': row.name,
          'Description': row.description,
          'Categories': row.categories || [],
          'Year Released': row.year_released,
          'Complexity': row.complexity,
          'Min Players': row.min_players,
          'Max. Players': row.max_players,
          'Best Player Amount': row.best_player_amount,
          'Date of Aquisition': row.date_of_acquisition,
          'Latest Check Date': row.latest_check_date,
          'Latest Check Status': row.latest_check_status ? [row.latest_check_status] : [],
          'Latest Check Notes': row.latest_check_notes || [],
          'Total Checks': row.total_checks,
          'Sleeved': row.sleeved,
          'Box Wrapped': row.box_wrapped,
          'Base Game ID': row.base_game_id,
        },
      }));
    } catch (error) {
      console.error('Error fetching expansions from PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Get game images
   */
  async getGameImages(gameId: string): Promise<Array<{ id: string; url: string; fileName: string; hash: string }>> {
    try {
      const result = await this.pool.query(
        `SELECT id, file_name, url, hash FROM game_images WHERE game_id = $1 ORDER BY created_at DESC`,
        [gameId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        url: row.url,
        fileName: row.file_name,
        hash: row.hash,
      }));
    } catch (error) {
      console.error('Error fetching game images from PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Create a new game
   */
  async createGame(gameData: {
    id: string;
    name: string;
    description?: string;
    categories?: string[];
    mechanisms?: string[];
    yearReleased?: number;
    minPlayers?: string;
    maxPlayers?: string;
    bestPlayerAmount?: string;
    complexity?: number;
    costPrice?: number;
    gameSize?: string;
    deposit?: number;
    isExpansion?: boolean;
    baseGameId?: string;
    bggId?: string;
    dateOfAcquisition?: string;
  }): Promise<{ id: string }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Insert game record with base_game_id for expansion support
      const result = await client.query(
        `INSERT INTO games (
          id, name, description, categories, mechanisms, year_released,
          min_players, max_players, best_player_amount, complexity,
          cost_price, game_size, deposit, base_game_id,
          bgg_id, date_of_acquisition, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW()
        ) RETURNING id`,
        [
          gameData.id,
          gameData.name,
          gameData.description || null,
          JSON.stringify(gameData.categories || []),
          JSON.stringify(gameData.mechanisms || []),
          gameData.yearReleased || null,
          gameData.minPlayers || null,
          gameData.maxPlayers || null,
          gameData.bestPlayerAmount || null,
          gameData.complexity || null,
          gameData.costPrice || null,
          gameData.gameSize || null,
          gameData.deposit || null,
          gameData.baseGameId || null,
          gameData.bggId || null,
          gameData.dateOfAcquisition || new Date().toISOString().split('T')[0],
        ]
      );

      await client.query('COMMIT');
      return { id: result.rows[0].id };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating game in PostgreSQL:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Add an image to a game
   */
  async addGameImage(gameId: string, imageUrl: string, hash: string): Promise<void> {
    try {
      // Generate file name from URL
      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1] || 'image.jpg';

      await this.pool.query(
        `INSERT INTO game_images (game_id, file_name, url, hash, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [gameId, fileName, imageUrl, hash]
      );
    } catch (error) {
      console.error('Error adding game image to PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Update game metadata
   */
  async updateGame(
    gameId: string,
    updates: {
      name?: string;
      description?: string;
      categories?: string[];
      year_released?: number;
      complexity?: number;
      min_players?: string;
      max_players?: string;
      best_player_amount?: string;
      date_of_acquisition?: string;
      latest_check_date?: string;
      latest_check_status?: string[];
      latest_check_notes?: string[];
      total_checks?: number;
      sleeved?: boolean;
      box_wrapped?: boolean;
    }
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      const setClauses = [];
      const values: any[] = [];
      let paramCount = 1;

      if (updates.name !== undefined) {
        setClauses.push(`name = $${paramCount++}`);
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        setClauses.push(`description = $${paramCount++}`);
        values.push(updates.description);
      }
      if (updates.categories !== undefined) {
        setClauses.push(`categories = $${paramCount++}`);
        values.push(JSON.stringify(updates.categories));
      }
      if (updates.year_released !== undefined) {
        setClauses.push(`year_released = $${paramCount++}`);
        values.push(updates.year_released);
      }
      if (updates.complexity !== undefined) {
        setClauses.push(`complexity = $${paramCount++}`);
        values.push(updates.complexity);
      }
      if (updates.min_players !== undefined) {
        setClauses.push(`min_players = $${paramCount++}`);
        values.push(updates.min_players);
      }
      if (updates.max_players !== undefined) {
        setClauses.push(`max_players = $${paramCount++}`);
        values.push(updates.max_players);
      }
      if (updates.best_player_amount !== undefined) {
        setClauses.push(`best_player_amount = $${paramCount++}`);
        values.push(updates.best_player_amount);
      }
      if (updates.date_of_acquisition !== undefined) {
        setClauses.push(`date_of_acquisition = $${paramCount++}`);
        values.push(updates.date_of_acquisition);
      }
      if (updates.latest_check_date !== undefined) {
        setClauses.push(`latest_check_date = $${paramCount++}`);
        values.push(updates.latest_check_date);
      }
      if (updates.latest_check_status !== undefined) {
        setClauses.push(`latest_check_status = $${paramCount++}`);
        values.push(JSON.stringify(updates.latest_check_status));
      }
      if (updates.latest_check_notes !== undefined) {
        setClauses.push(`latest_check_notes = $${paramCount++}`);
        values.push(JSON.stringify(updates.latest_check_notes));
      }
      if (updates.total_checks !== undefined) {
        setClauses.push(`total_checks = $${paramCount++}`);
        values.push(updates.total_checks);
      }
      if (updates.sleeved !== undefined) {
        setClauses.push(`sleeved = $${paramCount++}`);
        values.push(updates.sleeved);
      }
      if (updates.box_wrapped !== undefined) {
        setClauses.push(`box_wrapped = $${paramCount++}`);
        values.push(updates.box_wrapped);
      }

      if (setClauses.length === 0) return;

      setClauses.push(`updated_at = NOW()`);
      values.push(gameId);

      await client.query(
        `UPDATE games SET ${setClauses.join(', ')} WHERE id = $${paramCount}`,
        values
      );
    } finally {
      client.release();
    }
  }

  /**
   * Delete a game and all associated data (images, content checks, etc.)
   * Cascading deletes should be handled by database foreign key constraints
   */
  async deleteGame(gameId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Delete associated images first (or rely on cascade)
      await client.query('DELETE FROM game_images WHERE game_id = $1', [gameId]);

      // Delete the game record (this should cascade to other related records)
      const result = await client.query('DELETE FROM games WHERE id = $1 RETURNING id', [gameId]);

      if (result.rowCount === 0) {
        throw new Error('Game not found');
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting game:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get total count of images in database
   */
  async getImageCount(): Promise<number> {
    try {
      const result = await this.pool.query('SELECT COUNT(*) FROM game_images');
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Error getting image count:', error);
      return 0;
    }
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

export default GamesDbService;

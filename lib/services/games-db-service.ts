import { Pool, PoolClient } from 'pg';
import { BoardGame, GameFilters } from '@/types';

class GamesDbService {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
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
          acquisition_date,
          latest_check_date,
          latest_check_status,
          latest_check_notes,
          total_checks,
          sleeved,
          box_wrapped,
          is_expansion,
          game_expansions_link
        FROM games
        ORDER BY name ASC
      `);

      return result.rows.map((row) => ({
        id: row.id,
        fields: {
          'Game Name': row.name,
          'Description': row.description,
          'Categories': JSON.parse(row.categories),
          'Year Released': row.year_released,
          'Complexity': row.complexity,
          'Min Players': row.min_players,
          'Max. Players': row.max_players,
          'Best Player Amount': row.best_player_amount,
          'Date of Aquisition': row.acquisition_date,
          'Latest Check Date': row.latest_check_date,
          'Latest Check Status': JSON.parse(row.latest_check_status),
          'Latest Check Notes': JSON.parse(row.latest_check_notes),
          'Total Checks': row.total_checks,
          'Sleeved': row.sleeved,
          'Box Wrapped': row.box_wrapped,
          'Expansion': row.is_expansion,
          'Game Expansions Link': JSON.parse(row.game_expansions_link),
        },
      }));
    } catch (error) {
      console.error('Error fetching all games from PostgreSQL:', error);
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
          min_players, max_players, best_player_amount, acquisition_date,
          latest_check_date, latest_check_status, latest_check_notes, total_checks,
          sleeved, box_wrapped, is_expansion, game_expansions_link
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
          'Categories': JSON.parse(row.categories),
          'Year Released': row.year_released,
          'Complexity': row.complexity,
          'Min Players': row.min_players,
          'Max. Players': row.max_players,
          'Best Player Amount': row.best_player_amount,
          'Date of Aquisition': row.acquisition_date,
          'Latest Check Date': row.latest_check_date,
          'Latest Check Status': JSON.parse(row.latest_check_status),
          'Latest Check Notes': JSON.parse(row.latest_check_notes),
          'Total Checks': row.total_checks,
          'Sleeved': row.sleeved,
          'Box Wrapped': row.box_wrapped,
          'Expansion': row.is_expansion,
          'Game Expansions Link': JSON.parse(row.game_expansions_link),
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
          min_players, max_players, best_player_amount, acquisition_date,
          latest_check_date, latest_check_status, latest_check_notes, total_checks,
          sleeved, box_wrapped, is_expansion, game_expansions_link
        FROM games
        WHERE name ILIKE $1 OR description ILIKE $1
        ORDER BY name ASC`,
        [`%${searchTerm}%`]
      );

      return result.rows.map((row) => ({
        id: row.id,
        fields: {
          'Game Name': row.name,
          'Description': row.description,
          'Categories': JSON.parse(row.categories),
          'Year Released': row.year_released,
          'Complexity': row.complexity,
          'Min Players': row.min_players,
          'Max. Players': row.max_players,
          'Best Player Amount': row.best_player_amount,
          'Date of Aquisition': row.acquisition_date,
          'Latest Check Date': row.latest_check_date,
          'Latest Check Status': JSON.parse(row.latest_check_status),
          'Latest Check Notes': JSON.parse(row.latest_check_notes),
          'Total Checks': row.total_checks,
          'Sleeved': row.sleeved,
          'Box Wrapped': row.box_wrapped,
          'Expansion': row.is_expansion,
          'Game Expansions Link': JSON.parse(row.game_expansions_link),
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
          min_players, max_players, best_player_amount, acquisition_date,
          latest_check_date, latest_check_status, latest_check_notes, total_checks,
          sleeved, box_wrapped, is_expansion, game_expansions_link
        FROM games
        WHERE categories::text ILIKE $1
        ORDER BY name ASC`,
        [`%${category}%`]
      );

      return result.rows.map((row) => ({
        id: row.id,
        fields: {
          'Game Name': row.name,
          'Description': row.description,
          'Categories': JSON.parse(row.categories),
          'Year Released': row.year_released,
          'Complexity': row.complexity,
          'Min Players': row.min_players,
          'Max. Players': row.max_players,
          'Best Player Amount': row.best_player_amount,
          'Date of Aquisition': row.acquisition_date,
          'Latest Check Date': row.latest_check_date,
          'Latest Check Status': JSON.parse(row.latest_check_status),
          'Latest Check Notes': JSON.parse(row.latest_check_notes),
          'Total Checks': row.total_checks,
          'Sleeved': row.sleeved,
          'Box Wrapped': row.box_wrapped,
          'Expansion': row.is_expansion,
          'Game Expansions Link': JSON.parse(row.game_expansions_link),
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
          min_players, max_players, best_player_amount, acquisition_date,
          latest_check_date, latest_check_status, latest_check_notes, total_checks,
          sleeved, box_wrapped, is_expansion, game_expansions_link
        FROM games
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
          'Categories': JSON.parse(row.categories),
          'Year Released': row.year_released,
          'Complexity': row.complexity,
          'Min Players': row.min_players,
          'Max. Players': row.max_players,
          'Best Player Amount': row.best_player_amount,
          'Date of Aquisition': row.acquisition_date,
          'Latest Check Date': row.latest_check_date,
          'Latest Check Status': JSON.parse(row.latest_check_status),
          'Latest Check Notes': JSON.parse(row.latest_check_notes),
          'Total Checks': row.total_checks,
          'Sleeved': row.sleeved,
          'Box Wrapped': row.box_wrapped,
          'Expansion': row.is_expansion,
          'Game Expansions Link': JSON.parse(row.game_expansions_link),
        },
      };
    } catch (error) {
      console.error('Error fetching random game from PostgreSQL:', error);
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
      acquisition_date?: string;
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
      if (updates.acquisition_date !== undefined) {
        setClauses.push(`acquisition_date = $${paramCount++}`);
        values.push(updates.acquisition_date);
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
   * Close the connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

export default GamesDbService;

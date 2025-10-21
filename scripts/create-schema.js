const { Pool } = require('pg');

// Get connection URL from command line argument or environment variable
const connectionUrl = process.argv[2] || process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

console.log('📦 PostgreSQL Schema Setup Script');
console.log('==================================\n');
console.log('Connection URL:', connectionUrl.split('@')[1] || 'local');

const pool = new Pool({
  connectionString: connectionUrl,
});

async function createSchema() {
  const client = await pool.connect();
  try {
    console.log('\n1️⃣  Creating games table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS games (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        categories TEXT[],
        year_released INTEGER,
        complexity DECIMAL(3,1),
        min_players INTEGER,
        max_players INTEGER,
        best_player_amount INTEGER,
        date_of_acquisition TIMESTAMP,
        latest_check_date TIMESTAMP,
        latest_check_status VARCHAR(50),
        latest_check_notes TEXT[],
        total_checks INTEGER DEFAULT 0,
        sleeved BOOLEAN,
        box_wrapped BOOLEAN,
        game_expansions_link TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('   ✓ Games table created');

    console.log('\n2️⃣  Creating game_images table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_images (
        id SERIAL PRIMARY KEY,
        game_id VARCHAR(50) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        file_name VARCHAR(255),
        file_size INTEGER,
        file_type VARCHAR(50),
        hash VARCHAR(32),
        url TEXT,
        width INTEGER,
        height INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(game_id, hash)
      );
    `);
    console.log('   ✓ Game images table created');

    console.log('\n3️⃣  Creating play_logs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS play_logs (
        id VARCHAR(50) PRIMARY KEY,
        game_id VARCHAR(50) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        staff_list_id VARCHAR(50) NOT NULL,
        session_date TIMESTAMP,
        notes TEXT,
        duration_hours DECIMAL(5,1),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('   ✓ Play logs table created');

    console.log('\n4️⃣  Creating content_checks table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS content_checks (
        id VARCHAR(50) PRIMARY KEY,
        game_id VARCHAR(50) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        inspector_id VARCHAR(50),
        check_date TIMESTAMP,
        status VARCHAR(50),
        missing_pieces TEXT,
        box_condition VARCHAR(50),
        card_condition VARCHAR(50),
        is_fake BOOLEAN,
        notes TEXT,
        sleeved_at_check BOOLEAN,
        box_wrapped_at_check BOOLEAN,
        photos TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('   ✓ Content checks table created');

    console.log('\n5️⃣  Creating staff_knowledge table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_knowledge (
        id VARCHAR(50) PRIMARY KEY,
        staff_member_id VARCHAR(50) NOT NULL,
        game_id VARCHAR(50) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        confidence_level VARCHAR(50),
        can_teach BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(staff_member_id, game_id)
      );
    `);
    console.log('   ✓ Staff knowledge table created');

    console.log('\n6️⃣  Creating indexes for performance...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_games_name ON games(name);
      CREATE INDEX IF NOT EXISTS idx_games_categories ON games USING GIN(categories);
      CREATE INDEX IF NOT EXISTS idx_game_images_game_id ON game_images(game_id);
      CREATE INDEX IF NOT EXISTS idx_play_logs_game_id ON play_logs(game_id);
      CREATE INDEX IF NOT EXISTS idx_play_logs_staff_id ON play_logs(staff_list_id);
      CREATE INDEX IF NOT EXISTS idx_play_logs_date ON play_logs(session_date DESC);
      CREATE INDEX IF NOT EXISTS idx_content_checks_game_id ON content_checks(game_id);
      CREATE INDEX IF NOT EXISTS idx_content_checks_date ON content_checks(check_date DESC);
      CREATE INDEX IF NOT EXISTS idx_staff_knowledge_staff_id ON staff_knowledge(staff_member_id);
      CREATE INDEX IF NOT EXISTS idx_staff_knowledge_game_id ON staff_knowledge(game_id);
    `);
    console.log('   ✓ Indexes created');

    console.log('\n7️⃣  Creating full-text search indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_games_search ON games
        USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));
    `);
    console.log('   ✓ Full-text search indexes created');

    console.log('\n✅ Schema created successfully!');
    console.log('\n📊 Tables created:');
    console.log('   • games (board game catalog)');
    console.log('   • game_images (image metadata)');
    console.log('   • play_logs (game play sessions)');
    console.log('   • content_checks (content check history)');
    console.log('   • staff_knowledge (staff expertise)');
    console.log('   • staff_list (already exists)\n');

  } catch (error) {
    console.error('❌ Error creating schema:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

createSchema();

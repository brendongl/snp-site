const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway',
  ssl: false
});

// BGG API helper with rate limiting
const BGG_API_BASE = 'https://boardgamegeek.com/xmlapi2';
const BGG_DELAY_MS = 2000; // 2 second delay between requests

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchBGGData(bggId) {
  if (!bggId) return null;

  try {
    const url = `${BGG_API_BASE}/thing?id=${bggId}&stats=1`;
    const response = await fetch(url);

    if (!response.ok) {
      console.log(`  ⚠️  BGG API error for ID ${bggId}: ${response.status}`);
      return null;
    }

    const xml = await response.text();

    // Parse XML (simple regex parsing for our needs)
    const description = xml.match(/<description>(.*?)<\/description>/s)?.[1]?.trim() || null;

    // Extract categories
    const categoryMatches = [...xml.matchAll(/<link type="boardgamecategory"[^>]*value="([^"]+)"/g)];
    const categories = categoryMatches.map(m => m[1]);

    // Extract mechanisms
    const mechanismMatches = [...xml.matchAll(/<link type="boardgamemechanic"[^>]*value="([^"]+)"/g)];
    const mechanisms = mechanismMatches.map(m => m[1]);

    // Extract complexity (averageweight)
    const complexityMatch = xml.match(/<averageweight value="([^"]+)"/);
    const complexity = complexityMatch ? parseFloat(complexityMatch[1]) : null;

    return {
      description,
      categories,
      mechanisms,
      complexity
    };
  } catch (error) {
    console.log(`  ⚠️  Error fetching BGG data for ID ${bggId}:`, error.message);
    return null;
  }
}

// Load Airtable CSV
function loadAirtableCSV(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',');

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < headers.length) continue;

    const row = {};
    headers.forEach((header, idx) => {
      row[header.trim()] = values[idx]?.trim() || null;
    });
    data.push(row);
  }

  return data;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

// Clean currency values
function parseCurrency(value) {
  if (!value) return null;
  // Remove currency symbols and commas
  const cleaned = value.replace(/[₫,]/g, '').trim();
  return cleaned ? parseFloat(cleaned) : null;
}

// Match Airtable record to Postgres game
function findAirtableMatch(game, airtableData) {
  // First try exact name match
  let match = airtableData.find(row =>
    row['Game Name']?.toLowerCase().trim() === game.name?.toLowerCase().trim()
  );

  if (match) return { match, method: 'name' };

  // Try BGG ID match
  if (game.bgg_id) {
    match = airtableData.find(row =>
      row['bggID']?.trim() === game.bgg_id?.trim()
    );
    if (match) return { match, method: 'bgg_id' };
  }

  return { match: null, method: null };
}

// Merge arrays preserving unique values
function mergeArrays(existing, newItems) {
  if (!existing) existing = [];
  if (!newItems) newItems = [];

  const merged = [...existing];

  for (const item of newItems) {
    if (!merged.includes(item)) {
      merged.push(item);
    }
  }

  return merged;
}

async function syncGamesData() {
  console.log('='.repeat(80));
  console.log('SYNCING GAMES DATA FROM BGG AND AIRTABLE');
  console.log('='.repeat(80));

  const stats = {
    total: 0,
    bggFetched: 0,
    bggFailed: 0,
    descriptionsAdded: 0,
    categoriesMerged: 0,
    mechanismsMerged: 0,
    complexityUpdated: 0,
    depositAdded: 0,
    gameSizeAdded: 0,
    costPriceAdded: 0,
    airtableMatched: 0,
    airtableNotMatched: 0,
  };

  const missingDataReport = {
    missingDescription: [],
    missingCategories: [],
    missingMechanisms: [],
    missingComplexity: [],
    missingDeposit: [],
    missingGameSize: [],
    missingCostPrice: [],
    airtableNotFound: []
  };

  try {
    // Load Airtable data
    console.log('\n📋 Loading Airtable CSV...');
    const csvPath = path.join('C:', 'Users', 'Brendon', 'Documents', 'Claude', 'snp-site', 'exports', 'bgrental.csv');
    const airtableData = loadAirtableCSV(csvPath);
    console.log(`✓ Loaded ${airtableData.length} records from Airtable`);

    // Fetch all games from Postgres
    console.log('\n📊 Fetching games from Postgres...');
    const result = await pool.query(`
      SELECT id, name, bgg_id, description, categories, mechanisms, complexity,
             deposit, game_size, cost_price
      FROM games
      ORDER BY name
    `);

    const games = result.rows;
    stats.total = games.length;
    console.log(`✓ Found ${games.length} games in Postgres`);

    console.log('\n🔄 Starting sync process...\n');

    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      console.log(`[${i + 1}/${games.length}] Processing: ${game.name}`);

      let needsUpdate = false;
      const updates = {
        description: game.description,
        categories: game.categories || [],
        mechanisms: game.mechanisms || [],
        complexity: game.complexity,
        deposit: game.deposit,
        game_size: game.game_size,
        cost_price: game.cost_price
      };

      // === FETCH BGG DATA ===
      let bggData = null;
      if (game.bgg_id) {
        console.log(`  🔍 Fetching BGG data (ID: ${game.bgg_id})...`);
        bggData = await fetchBGGData(game.bgg_id);
        await sleep(BGG_DELAY_MS); // Rate limiting

        if (bggData) {
          stats.bggFetched++;

          // Update description if missing
          if (!game.description && bggData.description) {
            updates.description = bggData.description;
            needsUpdate = true;
            stats.descriptionsAdded++;
            console.log(`  ✓ Added description`);
          }

          // Merge categories (preserve existing + add new from BGG)
          if (bggData.categories && bggData.categories.length > 0) {
            const mergedCategories = mergeArrays(game.categories, bggData.categories);
            if (JSON.stringify(mergedCategories) !== JSON.stringify(game.categories)) {
              updates.categories = mergedCategories;
              needsUpdate = true;
              stats.categoriesMerged++;
              console.log(`  ✓ Merged categories: ${game.categories?.length || 0} → ${mergedCategories.length}`);
            }
          }

          // Merge mechanisms (preserve existing + add new from BGG)
          if (bggData.mechanisms && bggData.mechanisms.length > 0) {
            const mergedMechanisms = mergeArrays(game.mechanisms, bggData.mechanisms);
            if (JSON.stringify(mergedMechanisms) !== JSON.stringify(game.mechanisms)) {
              updates.mechanisms = mergedMechanisms;
              needsUpdate = true;
              stats.mechanismsMerged++;
              console.log(`  ✓ Merged mechanisms: ${game.mechanisms?.length || 0} → ${mergedMechanisms.length}`);
            }
          }

          // Update complexity (always use BGG value for precision)
          if (bggData.complexity !== null && bggData.complexity !== game.complexity) {
            updates.complexity = bggData.complexity;
            needsUpdate = true;
            stats.complexityUpdated++;
            console.log(`  ✓ Updated complexity: ${game.complexity} → ${bggData.complexity}`);
          }
        } else {
          stats.bggFailed++;
        }
      } else {
        console.log(`  ⚠️  No BGG ID available`);
      }

      // === FETCH AIRTABLE DATA ===
      const { match: airtableMatch, method } = findAirtableMatch(game, airtableData);

      if (airtableMatch) {
        stats.airtableMatched++;
        console.log(`  ✓ Matched Airtable record (via ${method})`);

        // Update deposit
        if (!game.deposit && airtableMatch['Deposit']) {
          const deposit = parseCurrency(airtableMatch['Deposit']);
          if (deposit) {
            updates.deposit = deposit;
            needsUpdate = true;
            stats.depositAdded++;
            console.log(`  ✓ Added deposit: ${deposit}`);
          }
        }

        // Update game_size
        if (!game.game_size && airtableMatch['Game Size (Rental)']) {
          const gameSize = parseInt(airtableMatch['Game Size (Rental)']);
          if (gameSize) {
            updates.game_size = gameSize;
            needsUpdate = true;
            stats.gameSizeAdded++;
            console.log(`  ✓ Added game_size: ${gameSize}`);
          }
        }

        // Update cost_price
        if (!game.cost_price && airtableMatch['Cost Price']) {
          const costPrice = parseCurrency(airtableMatch['Cost Price']);
          if (costPrice) {
            updates.cost_price = costPrice;
            needsUpdate = true;
            stats.costPriceAdded++;
            console.log(`  ✓ Added cost_price: ${costPrice}`);
          }
        }
      } else {
        stats.airtableNotMatched++;
        console.log(`  ⚠️  No Airtable match found`);
        missingDataReport.airtableNotFound.push({
          id: game.id,
          name: game.name,
          bgg_id: game.bgg_id
        });
      }

      // === UPDATE DATABASE ===
      if (needsUpdate) {
        await pool.query(`
          UPDATE games
          SET description = $1,
              categories = $2,
              mechanisms = $3,
              complexity = $4,
              deposit = $5,
              game_size = $6,
              cost_price = $7
          WHERE id = $8
        `, [
          updates.description,
          updates.categories,
          updates.mechanisms,
          updates.complexity,
          updates.deposit,
          updates.game_size,
          updates.cost_price,
          game.id
        ]);
        console.log(`  ✓ Database updated`);
      } else {
        console.log(`  - No changes needed`);
      }

      // Track missing data for final report
      if (!updates.description) {
        missingDataReport.missingDescription.push({ id: game.id, name: game.name, bgg_id: game.bgg_id });
      }
      if (!updates.categories || updates.categories.length === 0) {
        missingDataReport.missingCategories.push({ id: game.id, name: game.name, bgg_id: game.bgg_id });
      }
      if (!updates.mechanisms || updates.mechanisms.length === 0) {
        missingDataReport.missingMechanisms.push({ id: game.id, name: game.name, bgg_id: game.bgg_id });
      }
      if (updates.complexity === null) {
        missingDataReport.missingComplexity.push({ id: game.id, name: game.name, bgg_id: game.bgg_id });
      }
      if (!updates.deposit) {
        missingDataReport.missingDeposit.push({ id: game.id, name: game.name, bgg_id: game.bgg_id });
      }
      if (!updates.game_size) {
        missingDataReport.missingGameSize.push({ id: game.id, name: game.name, bgg_id: game.bgg_id });
      }
      if (!updates.cost_price) {
        missingDataReport.missingCostPrice.push({ id: game.id, name: game.name, bgg_id: game.bgg_id });
      }

      console.log('');
    }

    // === GENERATE REPORTS ===
    console.log('\n' + '='.repeat(80));
    console.log('SYNC COMPLETE - GENERATING REPORTS');
    console.log('='.repeat(80));

    console.log('\n📊 STATISTICS:');
    console.table(stats);

    // Save detailed CSV report
    const csvReport = generateCSVReport(missingDataReport);
    const reportCsvPath = path.join('C:', 'Users', 'Brendon', 'Documents', 'Claude', 'snp-site', 'GAMES_MISSING_DATA_REPORT.csv');
    fs.writeFileSync(reportCsvPath, csvReport);
    console.log(`\n✓ CSV report saved: ${reportCsvPath}`);

    // Save markdown summary
    const mdReport = generateMarkdownReport(stats, missingDataReport);
    const mdPath = path.join('C:', 'Users', 'Brendon', 'Documents', 'Claude', 'snp-site', 'GAMES_SYNC_REPORT.md');
    fs.writeFileSync(mdPath, mdReport);
    console.log(`✓ Markdown report saved: ${mdPath}`);

  } catch (error) {
    console.error('\n❌ Error during sync:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

function generateCSVReport(missingDataReport) {
  let csv = 'Type,Game ID,Game Name,BGG ID\n';

  for (const [type, games] of Object.entries(missingDataReport)) {
    const label = type.replace(/([A-Z])/g, ' $1').trim();
    for (const game of games) {
      csv += `"${label}","${game.id}","${game.name}","${game.bgg_id || ''}"\n`;
    }
  }

  return csv;
}

function generateMarkdownReport(stats, missingDataReport) {
  let md = '# Games Sync Report\n\n';
  md += `**Date**: ${new Date().toLocaleString()}\n\n`;
  md += '---\n\n';

  md += '## Summary Statistics\n\n';
  md += `- **Total games processed**: ${stats.total}\n`;
  md += `- **BGG data fetched**: ${stats.bggFetched}\n`;
  md += `- **BGG fetch failed**: ${stats.bggFailed}\n`;
  md += `- **Descriptions added**: ${stats.descriptionsAdded}\n`;
  md += `- **Categories merged**: ${stats.categoriesMerged}\n`;
  md += `- **Mechanisms merged**: ${stats.mechanismsMerged}\n`;
  md += `- **Complexity scores updated**: ${stats.complexityUpdated}\n`;
  md += `- **Deposits added**: ${stats.depositAdded}\n`;
  md += `- **Game sizes added**: ${stats.gameSizeAdded}\n`;
  md += `- **Cost prices added**: ${stats.costPriceAdded}\n`;
  md += `- **Airtable matches**: ${stats.airtableMatched}\n`;
  md += `- **Airtable not matched**: ${stats.airtableNotMatched}\n\n`;

  md += '---\n\n';
  md += '## Missing Data Summary\n\n';

  for (const [type, games] of Object.entries(missingDataReport)) {
    const label = type.replace(/([A-Z])/g, ' $1').trim();
    md += `### ${label} (${games.length} games)\n\n`;

    if (games.length === 0) {
      md += '*None*\n\n';
    } else if (games.length <= 20) {
      md += '| Game Name | BGG ID |\n';
      md += '|-----------|--------|\n';
      for (const game of games) {
        md += `| ${game.name} | ${game.bgg_id || 'N/A'} |\n`;
      }
      md += '\n';
    } else {
      md += `*See CSV report for full list (${games.length} entries)*\n\n`;
      // Show first 10
      md += '| Game Name | BGG ID |\n';
      md += '|-----------|--------|\n';
      for (const game of games.slice(0, 10)) {
        md += `| ${game.name} | ${game.bgg_id || 'N/A'} |\n`;
      }
      md += `| ... and ${games.length - 10} more |\n\n`;
    }
  }

  return md;
}

// Run the sync
syncGamesData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

# Airtable to PostgreSQL Migration Troubleshooting Guide

This guide helps debug and resolve issues when migrating data or adding new fields from Airtable to PostgreSQL.

## Quick Diagnostic Checklist

When you encounter a "column does not exist" error or data isn't syncing, run through this checklist:

```bash
# 1. Verify PostgreSQL columns exist
DATABASE_URL="postgresql://..." node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'games'
  ORDER BY column_name
\`).then(res => {
  console.log('PostgreSQL Columns:');
  res.rows.forEach(r => console.log(\`  - \${r.column_name}: \${r.data_type}\`));
  pool.end();
});
"

# 2. Check Airtable field names (case-sensitive!)
# Use Airtable MCP or check the web interface

# 3. Verify database connection string
echo $DATABASE_URL

# 4. Test a single record update
# (see "Test Single Record Update" section below)
```

## Common Issues and Solutions

### Issue 1: "column X does not exist"

**Cause:** The PostgreSQL schema is missing the column.

**Solution:**
1. Create a migration script to add the column
2. Verify the column was added
3. Check column naming (snake_case in DB vs camelCase in code)

**Example Migration Script:**
```javascript
// scripts/add-column-example.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function addColumn() {
  const client = await pool.connect();
  try {
    // Add column
    await client.query(`
      ALTER TABLE games
      ADD COLUMN IF NOT EXISTS my_field VARCHAR(255)
    `);

    console.log('✓ Column added');

    // Verify it exists
    const verify = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'games'
        AND column_name = 'my_field'
    `);

    if (verify.rows.length > 0) {
      console.log('✓ Verified: Column exists');
    } else {
      console.log('✗ ERROR: Column not found!');
    }

  } finally {
    await client.release();
    await pool.end();
  }
}

addColumn();
```

**Run:**
```bash
DATABASE_URL="postgresql://..." node scripts/add-column-example.js
```

### Issue 2: Backfill claims success but data is NULL

**Likely Causes:**
1. Airtable field name is wrong (case-sensitive!)
2. Airtable has no data in those fields
3. Transaction didn't commit
4. Wrong database connection string

**Debugging Steps:**

**Step 1: Verify Airtable field names**
```javascript
// Use Airtable MCP to list exact field names
// fields['BGG ID'] vs fields['bggID'] - case matters!
```

**Step 2: Check if Airtable has data**
```javascript
// Query Airtable to see if data exists
const Airtable = require('airtable');
const base = new Airtable({ apiKey: 'xxx' }).base('baseId');

base('tableName').select({ maxRecords: 3 }).firstPage((err, records) => {
  records.forEach(record => {
    console.log('Field names:', Object.keys(record.fields));
    console.log('Sample data:', record.fields);
  });
});
```

**Step 3: Test single record update**
```javascript
// scripts/test-single-update.js
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function test() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update a known game
    await client.query(`
      UPDATE games
      SET my_field = $1
      WHERE name = $2
    `, ['test_value', 'Catan']);

    await client.query('COMMIT');
    console.log('✓ Update committed');

    // Verify with new connection
    await client.release();
    const client2 = await pool.connect();

    const result = await client2.query(
      'SELECT name, my_field FROM games WHERE name = $1',
      ['Catan']
    );

    console.log('Result:', result.rows[0]);

    if (result.rows[0].my_field === 'test_value') {
      console.log('✓ SUCCESS: Data persisted!');
    } else {
      console.log('✗ FAILED: Data not persisted!');
    }

    await client2.release();
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

test();
```

**Step 4: Verify database connection**
```bash
# Make sure you're using the correct database
echo $DATABASE_URL

# Should match your Railway/production database:
# postgresql://postgres:password@host:port/railway
```

### Issue 3: "AIRTABLE_API_KEY not found"

**Cause:** Environment variable not set in shell.

**Solution:**
```bash
# Option 1: Pass inline
AIRTABLE_API_KEY="patXXX..." node scripts/backfill.js

# Option 2: Export first
export AIRTABLE_API_KEY="patXXX..."
node scripts/backfill.js

# Option 3: Use Airtable MCP (already has API key)
# Rewrite backfill script to use MCP tools instead of Airtable SDK
```

### Issue 4: Field name mismatch between Airtable and code

**Problem:** Airtable uses different casing than expected.

**Examples:**
- Airtable: `bggID` vs Code expects: `BGG ID`
- Airtable: `Game Size (Rental)` vs Code expects: `Game Size`

**How to find correct names:**

**Method 1: Airtable MCP**
```javascript
// Use mcp__airtable__describe_table to get exact field names
// Lists all fields with correct casing
```

**Method 2: Query Airtable directly**
```javascript
const Airtable = require('airtable');
const base = new Airtable({ apiKey: 'xxx' }).base('baseId');

base('tableName').find('recordId', (err, record) => {
  console.log('Available fields:');
  Object.keys(record.fields).forEach(field => {
    console.log(`  - "${field}"`);
  });
});
```

**Method 3: Check Airtable web interface**
- Open base in browser
- Click field header to see exact field name

### Issue 5: Data types don't match

**Problem:** PostgreSQL column type doesn't accept Airtable data.

**Common mismatches:**
- Airtable number → PostgreSQL expects string
- Airtable array → PostgreSQL expects TEXT[]
- Airtable currency → PostgreSQL DECIMAL

**Solution:**
```javascript
// Always convert types explicitly
const updateValue = fields['My Field']
  ? fields['My Field'].toString()  // Convert to string
  : null;                           // Handle missing values

// For arrays
const arrayValue = fields['Categories'] || [];

// For numbers/currency
const priceValue = fields['Cost Price'] || null;  // Already a number
```

## Standard Migration Process

Follow this process for all future migrations:

### Phase 1: Plan the Migration

1. **Identify required fields** from Airtable
2. **Check exact field names** (use Airtable MCP or web UI)
3. **Determine PostgreSQL column types**
   - Text → `VARCHAR(255)` or `TEXT`
   - Number → `INTEGER` or `DECIMAL(10,2)`
   - Array → `TEXT[]`
   - Boolean → `BOOLEAN`
   - Date → `TIMESTAMP` or `DATE`
4. **Choose naming convention**
   - Airtable: "My Field Name" (human-readable)
   - PostgreSQL: `my_field_name` (snake_case)
   - TypeScript: `myFieldName` (camelCase)

### Phase 2: Create Migration Script

```javascript
// scripts/add-[feature-name]-columns.js
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const COLUMNS_TO_ADD = [
  { name: 'my_field', type: 'VARCHAR(255)', default: null },
  { name: 'another_field', type: 'INTEGER', default: null },
  { name: 'array_field', type: 'TEXT[]', default: 'ARRAY[]::TEXT[]' },
];

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Adding columns...\n');

    for (const col of COLUMNS_TO_ADD) {
      const defaultClause = col.default ? `DEFAULT ${col.default}` : '';

      await client.query(`
        ALTER TABLE games
        ADD COLUMN IF NOT EXISTS ${col.name} ${col.type} ${defaultClause}
      `);

      console.log(`✓ Added ${col.name}`);
    }

    // Verify columns exist
    console.log('\nVerifying columns...\n');

    const verify = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'games'
        AND column_name = ANY($1)
    `, [COLUMNS_TO_ADD.map(c => c.name)]);

    if (verify.rows.length === COLUMNS_TO_ADD.length) {
      console.log('✓ All columns verified!\n');
      verify.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.log('✗ Some columns missing!');
      process.exit(1);
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
}

migrate();
```

### Phase 3: Create Backfill Script

```javascript
// scripts/backfill-[feature-name].js
const { Pool } = require('pg');
const Airtable = require('airtable');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base('baseId');

async function backfill() {
  let client;
  try {
    // 1. Fetch all records from Airtable
    console.log('1️⃣  Fetching from Airtable...');
    const airtableRecords = [];

    await base('tableName').select({ view: 'viewName' })
      .eachPage((records, fetchNextPage) => {
        records.forEach(r => airtableRecords.push(r));
        fetchNextPage();
      });

    console.log(`   ✓ Fetched ${airtableRecords.length} records\n`);

    // 2. Start transaction
    client = await pool.connect();
    await client.query('BEGIN');
    console.log('2️⃣  Starting transaction...\n');

    // 3. Update PostgreSQL
    console.log('3️⃣  Backfilling...');
    let updated = 0;
    let skipped = 0;

    for (const record of airtableRecords) {
      const fields = record.fields;
      const gameName = fields['Game Name'];

      if (!gameName) {
        skipped++;
        continue;
      }

      // Find game in PostgreSQL
      const pgResult = await client.query(
        'SELECT id FROM games WHERE name = $1 LIMIT 1',
        [gameName]
      );

      if (pgResult.rows.length === 0) {
        console.log(`   ⚠️  Not found: ${gameName}`);
        skipped++;
        continue;
      }

      const gameId = pgResult.rows[0].id;

      // Update with Airtable data
      // NOTE: Use exact field names from Airtable!
      await client.query(`
        UPDATE games
        SET
          my_field = $1,
          another_field = $2,
          updated_at = NOW()
        WHERE id = $3
      `, [
        fields['Exact Airtable Field Name'] || null,
        fields['Another Field'] || null,
        gameId
      ]);

      updated++;

      if (updated % 50 === 0) {
        console.log(`   ... updated ${updated} games`);
      }
    }

    // 4. COMMIT
    await client.query('COMMIT');
    console.log('\n   ✓ COMMITTED\n');

    console.log(`   ✓ Updated ${updated} games`);
    console.log(`   ℹ️  Skipped ${skipped} games\n`);
    console.log('✅ Backfill completed!\n');

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
      console.log('\n   ⚠️  ROLLED BACK\n');
    }
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

backfill();
```

### Phase 4: Verification Script

```javascript
// scripts/verify-[feature-name].js
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verify() {
  const client = await pool.connect();
  try {
    console.log('🔍 Verifying Backfill\n');
    console.log('========================\n');

    // Check field population
    const fields = [
      { col: 'my_field', label: 'My Field' },
      { col: 'another_field', label: 'Another Field' },
    ];

    console.log('1️⃣  Field population:\n');

    for (const field of fields) {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM games
        WHERE ${field.col} IS NOT NULL
      `);
      const count = parseInt(result.rows[0].count);
      console.log(`   ${field.label.padEnd(20)}: ${count} games`);
    }

    // Sample data
    console.log('\n2️⃣  Sample data:\n');

    const sample = await client.query(`
      SELECT name, my_field, another_field
      FROM games
      WHERE my_field IS NOT NULL
      LIMIT 10
    `);

    if (sample.rows.length === 0) {
      console.log('   ⚠️  NO DATA FOUND!\n');
    } else {
      sample.rows.forEach(row => {
        console.log(`   - ${row.name}`);
        console.log(`     my_field: ${row.my_field}`);
        console.log(`     another_field: ${row.another_field}`);
      });
    }

    // Total games
    const total = await client.query('SELECT COUNT(*) FROM games');
    console.log(`\n3️⃣  Total games: ${total.rows[0].count}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.release();
    await pool.end();
  }
}

verify();
```

### Phase 5: Run Migration

```bash
# 1. Add columns
DATABASE_URL="postgresql://..." node scripts/add-[feature-name]-columns.js

# 2. Run backfill
AIRTABLE_API_KEY="patXXX..." \
DATABASE_URL="postgresql://..." \
node scripts/backfill-[feature-name].js

# 3. Verify results
DATABASE_URL="postgresql://..." node scripts/verify-[feature-name].js
```

### Phase 6: Update TypeScript Types

```typescript
// types/index.ts

export interface BoardGame {
  // ... existing fields ...
  myField?: string;       // Add new fields
  anotherField?: number;
}

export interface CreateGameInput {
  // ... existing fields ...
  myField?: string;       // For Add Game dialog
  anotherField?: number;
}
```

### Phase 7: Update Application Code

1. **Update database service** (`lib/services/games-db-service.ts`)
   - Add new fields to `createGame()` method
   - Add new fields to SQL INSERT/UPDATE statements

2. **Update API routes** (`app/api/games/create/route.ts`)
   - Accept new fields from request body
   - Pass to database service

3. **Update UI components** (`components/features/games/AddGameDialog.tsx`)
   - Add form fields for new data
   - Include in form submission

4. **Test the flow**
   - Add a new game via UI
   - Verify fields are saved
   - Check PostgreSQL directly

## Useful Debugging Commands

```bash
# Check PostgreSQL column names and types
DATABASE_URL="..." node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'games'
  ORDER BY column_name
\`).then(res => {
  res.rows.forEach(r => console.log(r));
  pool.end();
});
"

# Count games with specific field populated
DATABASE_URL="..." node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT COUNT(*) FROM games WHERE my_field IS NOT NULL')
  .then(res => {
    console.log('Games with data:', res.rows[0].count);
    pool.end();
  });
"

# Sample games with new fields
DATABASE_URL="..." node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT name, my_field FROM games WHERE my_field IS NOT NULL LIMIT 5')
  .then(res => {
    console.log(res.rows);
    pool.end();
  });
"

# Check if specific game exists
DATABASE_URL="..." node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\`SELECT id, name FROM games WHERE name = 'Catan'\`)
  .then(res => {
    console.log(res.rows);
    pool.end();
  });
"
```

## Real-World Example: The Barcelona Issue

**Problem:** Adding Barcelona game failed with "column mechanisms does not exist"

**Root Cause:** Multiple missing columns that weren't in PostgreSQL schema

**Solution Process:**
1. Added `mechanisms` column (TEXT[])
2. Discovered more missing columns: `cost_price`, `game_size`, `deposit`, `bgg_id`, `min_playtime`, `max_playtime`
3. Created migration to add all columns
4. Fixed Airtable field name case: `fields['bggID']` not `fields['BGG ID']`
5. Ran backfill with correct AIRTABLE_API_KEY
6. Verified 360/362 games updated successfully

**Lessons Learned:**
- Check ALL form fields, not just the one that errored
- Use Airtable MCP to verify exact field names (case-sensitive)
- Always verify backfill with a query, don't trust console output alone
- Test single record updates to isolate transaction issues

## Quick Reference: Field Name Mapping

Common Airtable → PostgreSQL mappings:

| Airtable Field | PostgreSQL Column | Type |
|---|---|---|
| `Game Name` | `name` | VARCHAR |
| `bggID` | `bgg_id` | VARCHAR |
| `Cost Price` | `cost_price` | DECIMAL(10,2) |
| `Game Size (Rental)` | `game_size` | VARCHAR(10) |
| `Deposit` | `deposit` | DECIMAL(10,2) |
| `Date of Aquisition` | `date_of_acquisition` | DATE |
| `Min Players` | `min_players` | VARCHAR(10) |
| `Max. Players` | `max_players` | VARCHAR(10) |
| `Categories` | `categories` | TEXT[] |

**Key Points:**
- Airtable uses human-readable names with spaces
- PostgreSQL uses snake_case
- TypeScript uses camelCase
- Airtable field names are case-sensitive!

---

## When in Doubt

1. **Read Airtable field names directly** (use MCP or web UI)
2. **Test with a single game** before bulk backfill
3. **Verify with a new connection** after COMMIT
4. **Check column types match** between Airtable and PostgreSQL
5. **Use explicit transactions** (BEGIN → updates → COMMIT)

This guide should help resolve 99% of Airtable → PostgreSQL migration issues quickly!

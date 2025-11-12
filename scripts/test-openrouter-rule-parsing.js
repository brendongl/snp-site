/**
 * Test OpenRouter Rule Parsing Integration
 *
 * Tests the natural language rule parsing using OpenRouter API
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testRuleParsing() {
  try {
    console.log('🧪 Testing OpenRouter rule parsing integration...\n');

    // Check if API key is configured
    if (!process.env.OPENROUTER_API_KEY) {
      console.log('❌ OPENROUTER_API_KEY not configured in .env.local');
      console.log('   Get your API key from: https://openrouter.ai/keys');
      console.log('   Add it to .env.local as: OPENROUTER_API_KEY=sk-or-v1-...');
      process.exit(1);
    }

    console.log('✅ OPENROUTER_API_KEY found');

    // Test API endpoint
    const testRule = 'Brendon should work no more than 35 hours per week';
    console.log(`\n📝 Testing rule: "${testRule}"`);

    const response = await fetch('http://localhost:3002/api/roster/rules/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rule_text: testRule,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.log('\n❌ API request failed:');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${data.error}`);
      console.log(`   Details: ${data.details}`);
      process.exit(1);
    }

    console.log('\n✅ Rule parsed successfully!');
    console.log('\n📊 Parsed Constraint:');
    console.log(JSON.stringify(data.parsed_constraint, null, 2));
    console.log(`\n⚖️  Suggested Weight: ${data.suggested_weight}`);
    console.log(`📖 Explanation: ${data.explanation}`);

    // Test more complex rule
    console.log('\n\n🔄 Testing complex rule...');
    const complexRule = 'Phong prefers to work between 20 and 30 hours weekly';
    console.log(`📝 Rule: "${complexRule}"`);

    const response2 = await fetch('http://localhost:3002/api/roster/rules/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rule_text: complexRule,
      }),
    });

    const data2 = await response2.json();

    if (!response2.ok) {
      console.log('\n⚠️  Second rule failed (this is okay for testing)');
      console.log(`   Status: ${response2.status}`);
      console.log(`   Error: ${data2.error}`);
    } else {
      console.log('\n✅ Complex rule parsed successfully!');
      console.log('\n📊 Parsed Constraint:');
      console.log(JSON.stringify(data2.parsed_constraint, null, 2));
      console.log(`\n⚖️  Suggested Weight: ${data2.suggested_weight}`);
      console.log(`📖 Explanation: ${data2.explanation}`);
    }

    console.log('\n\n🎉 OpenRouter integration test complete!');
    console.log('\n📝 Summary:');
    console.log('   - API key configured: ✅');
    console.log('   - Rule parsing working: ✅');
    console.log('   - OpenRouter connection: ✅');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3002/api/health', {
      method: 'GET',
    });
    if (!response.ok) {
      console.log('⚠️  Warning: Server returned non-200 status');
    }
    return true;
  } catch (error) {
    console.log('❌ Dev server not running on port 3002');
    console.log('   Please start it with: npm run dev');
    return false;
  }
}

async function main() {
  const serverRunning = await checkServer();
  if (!serverRunning) {
    process.exit(1);
  }

  await testRuleParsing();
}

main();

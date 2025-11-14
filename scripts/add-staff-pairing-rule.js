/**
 * Add the failed staff pairing rule
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

async function addRule() {
  try {
    const response = await fetch(`${API_BASE}/api/roster/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rule_text: 'Staff members Nhi and Hieu should not have overlapping shifts',
        suggested_priority: 'low'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.details || 'Failed to create rule');
    }

    const result = await response.json();

    console.log('✅ Successfully created staff_pairing rule');
    console.log('   Type:', result.parsing_details.constraint_type);
    console.log('   Weight:', result.parsing_details.applied_weight);
    console.log('   Explanation:', result.parsing_details.explanation);

  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }
}

addRule();

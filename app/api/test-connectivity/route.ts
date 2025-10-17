import { NextResponse } from 'next/server';

export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: [] as any[]
  };

  // Test 1: DNS Resolution
  try {
    const dns = await import('dns').then(m => m.promises);
    await dns.resolve('api.airtable.com');
    results.tests.push({
      name: 'DNS Resolution',
      status: 'PASS',
      message: 'Successfully resolved api.airtable.com'
    });
  } catch (error) {
    results.tests.push({
      name: 'DNS Resolution',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Test 2: HTTP Connectivity (with timeout)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch('https://api.airtable.com', {
      signal: controller.signal,
      method: 'GET'
    });

    clearTimeout(timeout);

    results.tests.push({
      name: 'HTTP Connectivity',
      status: response.ok ? 'PASS' : 'WARN',
      message: `Reached api.airtable.com (HTTP ${response.status})`,
      statusCode: response.status
    });
  } catch (error) {
    results.tests.push({
      name: 'HTTP Connectivity',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
      cause: (error as any)?.cause?.code
    });
  }

  // Test 3: Airtable API with Auth
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_GAMES_BASE_ID}/${process.env.AIRTABLE_GAMES_TABLE_ID}?maxRecords=1`,
      {
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    results.tests.push({
      name: 'Airtable API Auth',
      status: response.ok ? 'PASS' : 'FAIL',
      message: `Airtable API responded with HTTP ${response.status}`,
      statusCode: response.status
    });
  } catch (error) {
    results.tests.push({
      name: 'Airtable API Auth',
      status: 'FAIL',
      error: error instanceof Error ? error.message : 'Unknown error',
      cause: (error as any)?.cause?.code
    });
  }

  // Overall status
  const allPassed = results.tests.every(t => t.status === 'PASS');
  const anyFailed = results.tests.some(t => t.status === 'FAIL');

  return NextResponse.json({
    overall: anyFailed ? 'UNHEALTHY' : allPassed ? 'HEALTHY' : 'DEGRADED',
    ...results,
    recommendations: anyFailed ? [
      'If DNS fails: Add --dns 8.8.8.8 --dns 8.8.4.4 to Docker run command',
      'If HTTP fails: Try switching Docker to Host network mode',
      'If Airtable API fails: Check API key and base/table IDs in environment variables'
    ] : []
  });
}
